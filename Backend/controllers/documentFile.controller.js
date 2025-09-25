const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { insertFile, getFiles, RenameFile, deleteFileById, createDefaultFilesForOrder } = require('../services/file.service');
const { poolPromise } = require('../config/db');
const { 
  generateRO, 
  generateInvoice, 
  generateBL,
  generateRecepcionOrden,
  generateAvisoEmbarque,
  generateAvisoRecepcionOrden
} = require('../pdf-generator/generator');

const fileService = require('../services/file.service');
const emailService = require('../services/email.service');
const PDFDocument = require('pdfkit');
const { logger } = require('../utils/logger');
const { cleanDirectoryName } = require('../utils/directoryUtils');
const { validateFilePath, setSecureFilePermissions } = require('../utils/filePermissions');

/**
 * Mapea el nombre del documento al generador correspondiente
 * @param {string} documentName - Nombre del documento
 * @returns {Function} Función generadora correspondiente
 */
function getDocumentGenerator(documentName) {
  const generators = {
    'Recepcion de orden': generateRecepcionOrden,
    'Aviso de Embarque': generateAvisoEmbarque,
    'Aviso de entrega': generateAvisoRecepcionOrden
  };
  
  return generators[documentName] || generateRO; // Fallback a RO si no encuentra
}

/**
 * Obtiene datos reales de la BD para generar el PDF
 * @param {Object} file - Datos del archivo
 * @param {string} lang - Idioma ('es' o 'en')
 * @returns {Object} Datos formateados para el template
 */
async function getPDFData(file, lang = 'es') {
  const pool = await poolPromise;
  
  // Obtener datos de la orden
  const [[order]] = await pool.query(`
    SELECT o.*, c.name as customer_name, c.email as customer_email
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.id = ?
  `, [file.order_id]);

  // Obtener datos de la orden detalle
  const [[orderDetail]] = await pool.query(`
    SELECT * FROM order_detail WHERE order_id = ?
  `, [file.order_id]);

  // Obtener items de la orden usando la misma query que order.service.js
  const [orderItems] = await pool.query(`
    SELECT DISTINCT
      oi.id,
      oi.order_id,
      oi.item_id,
      oi.kg_solicitados,
      oi.unit_price,
      oi.volumen,
      oi.tipo,
      oi.mercado,
      oi.kg_despachados,
      oi.kg_facturados,
      oi.fecha_etd,
      oi.fecha_eta,
      i.item_code,
      i.item_name,
      i.unidad_medida
    FROM order_items oi
    JOIN items i ON oi.item_id = i.id
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.pc = ? AND o.oc = ? AND (oi.factura = ? OR (oi.factura IS NULL AND ? IS NULL))
    ORDER BY oi.id
  `, [order.pc, order.oc, order.factura, order.factura]);

  // Fechas actuales
  const currentDate = new Date();
  const receptionDate = currentDate.toLocaleDateString('es-CL');
  const shipmentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL'); // +7 días
  const estimatedDeparture = new Date(currentDate.getTime() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL'); // +10 días
  const estimatedArrival = new Date(currentDate.getTime() + 25 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL'); // +25 días
  const estimatedDelivery = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL'); // +30 días

  // Datos base para todos los templates
  const baseData = {
    title: file.name,
    subtitle: `Documento generado para ${order?.customer_name || file.customer_name}`,
    customerName: order?.customer_name || file.customer_name,
    internalOrderNumber: order?.pc || 'N/A',
    orderNumber: order?.oc,
    responsiblePerson: 'Sistema Gelymar',
    destinationPort: orderDetail?.puerto_destino || 'N/A',
    incoterm: orderDetail?.incoterm || 'N/A',
    shippingMethod: orderDetail?.medio_envio_factura || 'N/A',
    currency: orderDetail?.currency || 'N/A',
    incotermDeliveryDate: orderDetail?.semana_42 || 'N/A',
    paymentCondition: orderDetail?.condicion_venta || 'N/A',
    receptionDate,
    shipmentDate,
    estimatedDeparture,
    estimatedArrival,
    estimatedDelivery,
    items: orderItems.map(item => ({
      product: item.item_name || 'Producto',
      quantity: item.kg_solicitados || 1,
      price: item.unit_price || 0
    }))
  };

  // Datos específicos según el tipo de documento
  const specificData = {
    'Recepcion de orden': {
      ...baseData,
      processingStatus: 'En Proceso',
      serviceType: 'Logística Integral',
      origin: 'Chile',
      destination: 'Internacional',
      priority: 'Normal'
    },
    'Aviso de Embarque': {
      ...baseData,
      portOfShipment: 'Puerto de Valparaíso',
      vesselName: 'M/V Gelymar Express',
      containerNumber: `GEL-${Math.floor(Math.random() * 900000) + 100000}`,
      portOfDestination: 'Puerto de Destino',
      cargoType: 'Mercancía General',
      totalWeight: orderItems.reduce((sum, item) => sum + (item.kg_solicitados || 0), 0),
      totalVolume: orderItems.reduce((sum, item) => sum + (item.volumen || 0), 0),
      specialInstructions: 'Manejar con cuidado. Mercancía frágil.'
    },
    'Aviso de entrega': {
      ...baseData,
      items: orderItems,
      processingStatus: 'Recibido y Validado',
      serviceType: 'Servicio Logístico Completo',
      origin: 'Chile',
      destination: 'Internacional',
      priority: 'Normal',
      cargoType: 'Mercancía General',
      estimatedWeight: orderItems.reduce((sum, item) => sum + (item.kg_solicitados || 0), 0),
      estimatedVolume: orderItems.reduce((sum, item) => sum + (item.volumen || 0), 0),
      packageCount: orderItems.length,
      dimensions: 'Variable según producto'
    }
  };

  // Agregar traducciones
  const { getDocumentTranslations } = require('../pdf-generator/i18n');
  const translations = getDocumentTranslations('aviso_recepcion', lang);
  
  const result = specificData[file.name] || baseData;
  return {
    ...result,
    translations,
    lang
  };
}

/**
 * Configuración de almacenamiento para Multer
 * Usa memoryStorage para manejar la ruta correcta en handleUpload
 */
const storage = multer.memoryStorage();

/**
 * Filtro de archivos aceptados por extensión
 */
const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Tipo de archivo no permitido'), false);
};

// Middleware de subida de archivos
const upload = multer({ storage, fileFilter });

// Middleware listo para una sola subida bajo el campo 'file'
exports.uploadFile = upload.single('file');

/**
 * @route POST /api/files/upload
 * @desc Procesa la carga física del archivo y registra su metadata en la base de datos
 * @access Protegido (requiere JWT)
 */
exports.handleUpload = async (req, res) => {
  try {
    const {
      customer_id, folder_id, client_name, subfolder, name, is_visible_to_customer
    } = req.body;
    const file = req.file;

    logger.info(`DEBUG - handleUpload recibido:`, {
      customer_id, folder_id, client_name, subfolder, name, is_visible_to_customer,
      file: file ? { originalname: file.originalname, path: file.path, size: file.size } : null
    });

    if (!file || !customer_id || !folder_id || !client_name || !subfolder) {
      logger.warn('Faltan parámetros obligatorios en handleUpload');
      return res.status(400).json({ message: 'Faltan parámetros obligatorios' });
    }

    // Obtener los datos de la orden para pc y oc
    const pool = await poolPromise;
    const [[order]] = await pool.query('SELECT pc, oc FROM orders WHERE id = ?', [folder_id]);
    
    if (!order) {
      logger.warn(`Orden no encontrada ID: ${folder_id}`);
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Obtener el file_identifier para esta orden (el más reciente)
    const [[latestFile]] = await pool.query(`
      SELECT file_identifier 
      FROM files 
      WHERE order_id = ? AND file_identifier IS NOT NULL
      ORDER BY file_identifier DESC 
      LIMIT 1
    `, [folder_id]);

    // Limpiar nombres de directorios para la ruta en la BD
    const cleanClientName = cleanDirectoryName(client_name);
    const cleanSubfolder = cleanDirectoryName(subfolder);
    
    // Si no hay file_identifier, generar uno nuevo
    let fileIdentifier = latestFile?.file_identifier;
    
    if (!fileIdentifier) {
      // Buscar el último identificador usado para este PC
      const [[lastPCFile]] = await pool.query(`
        SELECT file_identifier 
        FROM files 
        WHERE pc = ? AND file_identifier IS NOT NULL
        ORDER BY file_identifier DESC 
        LIMIT 1
      `, [order.pc]);
      
      fileIdentifier = lastPCFile ? lastPCFile.file_identifier + 1 : 1;
    }
    
    const folderName = `${cleanSubfolder}_${fileIdentifier}`;
    
    // Crear el directorio físico con la ruta correcta
    const basePath = process.env.FILE_SERVER_ROOT || '/var/www/html';
    const physicalDirPath = path.join(basePath, 'uploads', cleanClientName, folderName);
    const filePath = path.join('uploads', cleanClientName, folderName, file.originalname);

    // Crear directorio si no existe
    try {
      fs.mkdirSync(physicalDirPath, { recursive: true });
    } catch (error) {
      logger.error(`Error creando directorio: ${error.message}`);
      return res.status(500).json({ message: 'Error creando directorio' });
    }

    // Validar ruta de archivo para prevenir path traversal
    if (!validateFilePath(filePath, basePath)) {
      logger.warn(`Intento de upload con ruta insegura: ${filePath}`);
      return res.status(400).json({ message: 'Ruta de archivo inválida' });
    }

    // Guardar el archivo desde el buffer de memoria
    const physicalFilePath = path.join(physicalDirPath, file.originalname);
    try {
      fs.writeFileSync(physicalFilePath, file.buffer);
    } catch (error) {
      logger.error(`Error guardando archivo: ${error.message}`);
      return res.status(500).json({ message: 'Error guardando archivo' });
    }

    // Establecer permisos seguros para el archivo subido
    await setSecureFilePermissions(physicalFilePath);

    const fileData = {
      customer_id,
      order_id: folder_id,
      pc: order.pc,
      oc: order.oc,
      name: name,
      path: filePath,
      file_identifier: fileIdentifier,
      status_id: 2,
      is_visible_to_customer: is_visible_to_customer,
    };

    await insertFile(fileData);
    
    logger.info(`Archivo subido y registrado correctamente: ${file.originalname}`);
    res.status(201).json({ message: 'Archivo subido y registrado con éxito' });
  } catch (err) {
    logger.error(`Error al subir archivo: ${err.message}`);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

/**
 * @route GET /api/files/view/:id
 * @desc Genera un token temporal para visualizar un archivo
 * @access Protegido (requiere JWT)
 */
exports.viewFile = async (req, res) => {
  const { id } = req.params;
  
  try {
    const pool = await poolPromise;
    
    // Obtener información del archivo
    const file = await fileService.getFileById(id);
    if (!file) {
      logger.warn(`Archivo no encontrado ID: ${id}`);
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    // Verificar que el usuario tenga acceso al archivo
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Si es admin, puede acceder a todos los archivos
    if (userRole !== 'admin') {
      // Verificar que el archivo pertenece a un cliente del usuario
      const [[customerCheck]] = await pool.query(`
        SELECT c.id 
        FROM customers c
        JOIN orders o ON c.id = o.customer_id
        JOIN files f ON o.id = f.order_id
        JOIN users u ON u.email = c.rut
        WHERE f.id = ? AND u.id = ?
      `, [id, userId]);
      
      if (!customerCheck) {
        logger.warn(`Usuario ${userId} intentó acceder a archivo ${id} sin permisos`);
        return res.status(403).json({ message: 'No tienes permisos para acceder a este archivo' });
      }
    }
    
    // Generar token temporal (válido por 5 minutos)
    const crypto = require('crypto');
    const tempToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
    
    // Guardar token temporal en memoria (en producción usar Redis)
    if (!global.tempTokens) {
      global.tempTokens = new Map();
    }
    global.tempTokens.set(tempToken, {
      fileId: id,
      userId: userId,
      expiresAt: expiresAt
    });
    
    // Limpiar tokens expirados
    for (const [token, data] of global.tempTokens.entries()) {
      if (data.expiresAt < new Date()) {
        global.tempTokens.delete(token);
      }
    }
    
    const viewUrl = `/api/files/temp-view/${tempToken}`;
    console.log(`🔍 [viewFile] Generando URL: ${viewUrl}`);
    console.log(`🔍 [viewFile] Token generado: ${tempToken}`);
    
    res.json({ 
      viewUrl: viewUrl,
      filename: file.name,
      token: tempToken
    });

  } catch (error) {
    logger.error(`Error en viewFile ${id}: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route GET /api/files/temp-view/:token
 * @desc Visualiza un archivo usando token temporal
 * @access Público (solo con token válido)
 */
exports.tempViewFile = async (req, res) => {
  const { token } = req.params;
  
  console.log(`🔍 [tempViewFile] URL completa: ${req.originalUrl}`);
  console.log(`🔍 [tempViewFile] Parámetros:`, req.params);
  
  try {
    console.log(`🔍 [tempViewFile] Token recibido: ${token}`);
    console.log(`🔍 [tempViewFile] Tokens disponibles:`, global.tempTokens ? Array.from(global.tempTokens.keys()) : 'No hay tokens');
    
    // Verificar token temporal
    if (!global.tempTokens || !global.tempTokens.has(token)) {
      console.log(`❌ [tempViewFile] Token no válido: ${token}`);
      return res.status(404).json({ message: 'Token no válido o expirado' });
    }
    
    const tokenData = global.tempTokens.get(token);
    
    // Verificar expiración
    if (tokenData.expiresAt < new Date()) {
      global.tempTokens.delete(token);
      return res.status(404).json({ message: 'Token expirado' });
    }
    
    // Obtener información del archivo
    const file = await fileService.getFileById(tokenData.fileId);
    if (!file) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }
    
    const basePath = process.env.FILE_SERVER_ROOT || '/var/www/html';
    const filePath = path.join(basePath, file.path);
    
    // Verificar que el archivo existe físicamente
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo no encontrado en el servidor' });
    }

    // Verificar que la ruta es segura
    if (!validateFilePath(file.path, basePath)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    // Establecer headers para visualización (no descarga)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + file.name + '.pdf"');
    
    // Enviar el archivo
    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error(`Error enviando archivo ${tokenData.fileId}: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error al cargar archivo' });
        }
      }
    });

  } catch (error) {
    logger.error(`Error en tempViewFile ${token}: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route GET /api/files/view-with-token/:id
 * @desc Visualiza un archivo usando token JWT como parámetro de consulta
 * @access Público (solo con token válido)
 */
exports.viewWithToken = async (req, res) => {
  console.log(`🔍 [viewWithToken] ENDPOINT LLAMADO - URL: ${req.originalUrl}`);
  const { id } = req.params;
  const { token } = req.query;
  
  console.log(`🔍 [viewWithToken] Iniciando - id: ${id}, token: ${token ? 'presente' : 'ausente'}`);
  
  try {
    // Verificar token JWT
    if (!token) {
      console.log(`🔍 [viewWithToken] No hay token`);
      return res.status(401).json({ message: 'Token requerido' });
    }
    
    // Verificar token JWT
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`🔍 [viewWithToken] Token decodificado:`, decoded);
    
    // Obtener información del archivo
    const file = await fileService.getFileById(id);
    console.log(`🔍 [viewWithToken] Archivo encontrado:`, file ? 'Sí' : 'No');
    if (!file) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    // Verificar que el usuario tenga acceso al archivo
    const userId = decoded.id;
    const userRole = decoded.role;
    console.log(`🔍 [viewWithToken] userId: ${userId}, userRole: ${userRole}`);
    
    // Si es admin, puede acceder a todos los archivos
    if (userRole !== 'admin') {
      const pool = await poolPromise;
      
      console.log(`🔍 [viewWithToken] Debug - userId: ${userId}, userRole: ${userRole}, fileId: ${id}`);
      
             // Primero obtener el customer del usuario
             const userCustomerQuery = `
               SELECT c.id, c.rut, c.name 
               FROM customers c
               JOIN users u ON u.email = c.rut
               WHERE u.id = ?
             `;
             console.log(`🔍 [viewWithToken] Query userCustomer:`, userCustomerQuery);
             console.log(`🔍 [viewWithToken] Parámetros userCustomer:`, [userId]);
             
             const [[userCustomer]] = await pool.query(userCustomerQuery, [userId]);
             
             console.log(`🔍 [viewWithToken] userCustomer result:`, userCustomer);
      
      if (!userCustomer) {
        console.log(`🔍 [viewWithToken] No se encontró customer para usuario ${userId}`);
        return res.status(403).json({ message: 'No tienes permisos para acceder a este archivo' });
      }
      
             // Verificar que el archivo pertenece a una orden del customer
             const customerCheckQuery = `
               SELECT f.id, f.name, o.id as order_id, c.id as customer_id
               FROM files f
               JOIN orders o ON f.order_id = o.id
               JOIN customers c ON o.customer_id = c.id
               WHERE f.id = ? AND c.id = ?
             `;
             console.log(`🔍 [viewWithToken] Query customerCheck:`, customerCheckQuery);
             console.log(`🔍 [viewWithToken] Parámetros customerCheck:`, [id, userCustomer.id]);
             
             const [[customerCheck]] = await pool.query(customerCheckQuery, [id, userCustomer.id]);
             
             console.log(`🔍 [viewWithToken] customerCheck result:`, customerCheck);
      
      if (!customerCheck) {
        return res.status(403).json({ message: 'No tienes permisos para acceder a este archivo' });
      }
    }
    
    const basePath = process.env.FILE_SERVER_ROOT || '/var/www/html';
    const filePath = path.join(basePath, file.path);
    
    // Verificar que el archivo existe físicamente
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo no encontrado en el servidor' });
    }

    // Verificar que la ruta es segura
    if (!validateFilePath(file.path, basePath)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    // Establecer headers para visualización (no descarga)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + file.name + '.pdf"');
    
    // Enviar el archivo
    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error(`Error enviando archivo ${id}: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error al cargar archivo' });
        }
      }
    });

  } catch (error) {
    logger.error(`Error en viewWithToken ${id}: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route GET /api/files/download/:id
 * @desc Descarga un archivo de forma segura (requiere autenticación)
 * @access Protegido (requiere JWT)
 */
exports.downloadFile = async (req, res) => {
  const { id } = req.params;
  
  try {
    const pool = await poolPromise;
    
    // Obtener información del archivo
    const file = await fileService.getFileById(id);
    if (!file) {
      logger.warn(`Archivo no encontrado ID: ${id}`);
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    // Verificar que el usuario tenga acceso al archivo
    // Obtener información del usuario autenticado
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Si es admin, puede acceder a todos los archivos
    if (userRole !== 'admin') {
      // Verificar que el archivo pertenece a un cliente del usuario
      // La relación es: users.email = customers.rut
      const [[customerCheck]] = await pool.query(`
        SELECT c.id 
        FROM customers c
        JOIN orders o ON c.id = o.customer_id
        JOIN files f ON o.id = f.order_id
        JOIN users u ON u.email = c.rut
        WHERE f.id = ? AND u.id = ?
      `, [id, userId]);
      
      if (!customerCheck) {
        logger.warn(`Usuario ${userId} intentó acceder a archivo ${id} sin permisos`);
        return res.status(403).json({ message: 'No tienes permisos para acceder a este archivo' });
      }
    }
    
    const basePath = process.env.FILE_SERVER_ROOT || '/var/www/html';
    const filePath = path.join(basePath, file.path);
    
    // Verificar que el archivo existe físicamente
    if (!fs.existsSync(filePath)) {
      logger.warn(`Archivo físico no encontrado: ${filePath}`);
      return res.status(404).json({ message: 'Archivo no encontrado en el servidor' });
    }

    // Verificar que la ruta es segura
    if (!validateFilePath(file.path, basePath)) {
      logger.warn(`Intento de acceso a ruta insegura: ${file.path}`);
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    // Establecer headers para la descarga
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // Enviar el archivo
    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error(`Error enviando archivo ${id}: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error al descargar archivo' });
        }
      }
    });

  } catch (error) {
    logger.error(`Error en downloadFile ${id}: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route GET /api/files/:customerUuid?f=folderId
 * @desc Obtiene todos los archivos de una carpeta específica de un cliente dado su UUID
 * @access Protegido (requiere JWT)
 */
exports.getFilesByCustomerAndFolder = async (req, res) => {
  const { customerUuid } = req.params;
  const folderId = req.query.f;

  try {
    const pool = await poolPromise;
    const [[customer]] = await pool.query(`SELECT id FROM customers WHERE uuid = ?`, [customerUuid]);

    if (!customer) {
      logger.warn(`Cliente no encontrado UUID: ${customerUuid}`);
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    const files = await getFiles(customer.id, folderId);
    res.json(files);
  } catch (err) {
    logger.error(`Error al obtener archivos: ${err.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route PUT /api/files/rename/:id
 * @desc Modifica el nombre de un archivo existente
 * @access Protegido (requiere JWT)
 */
exports.RenameFile = async (req, res) => {
  const { id } = req.params;
  const { name, visible } = req.body;

  if (!name || !id) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const result = await RenameFile(id, name, visible);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Archivo no encontrado' });
    res.json({ success: true, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en la BD' });
  }
};

/**
 * @route POST /api/files/generate/:id
 * @desc Genera el archivo PDF para el registro de archivo solicitado
 * @access Protegido (requiere JWT)
 */
exports.generateFile = async (req, res) => {
  const { id } = req.params;
  const { lang = 'es' } = req.body; // Recibir idioma del frontend

  try {
    const file = await fileService.getFileById(id);
    if (!file) {
      logger.warn(`Archivo no encontrado ID: ${id}`);
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    const FILE_SERVER_ROOT = process.env.FILE_SERVER_ROOT || '/var/www/html';
    // Limpiar nombres de directorios para evitar problemas con caracteres especiales
    const cleanCustomerName = cleanDirectoryName(file.customer_name);
    const cleanFolderName = cleanDirectoryName(file.pc);
    
    // Usar file_identifier si existe, sino usar solo PC
    const folderName = file.file_identifier ? `${cleanFolderName}_${file.file_identifier}` : cleanFolderName;
    const customerFolder = path.join(FILE_SERVER_ROOT, 'uploads', cleanCustomerName, folderName);
    
    // Crear directorio si no existe
    if (!fs.existsSync(customerFolder)) {
      fs.mkdirSync(customerFolder, { recursive: true });
      logger.info(`Directorio creado: ${customerFolder}`);
    }

    const fileName = `${file.name}.pdf`;
    const filePath = path.join(customerFolder, fileName);

    // Obtener el generador correspondiente según el nombre del documento
    const generator = getDocumentGenerator(file.name);
    
    // Obtener datos reales de la BD
    const pdfData = await getPDFData(file, lang);
    
    // Generar el PDF con el generador y datos correspondientes
    await generator(filePath, pdfData);

    const updateData = {
      id: file.id,
      status_id: 2,
      updated_at: new Date(),
      path: path.relative(FILE_SERVER_ROOT, filePath)
    };

    await fileService.updateFile(updateData);

    logger.info(`Archivo generado exitosamente: ${fileName}`);
    return res.json({ message: 'Archivo generado exitosamente', path: updateData.path });

  } catch (error) {
    logger.error(`Error al generar archivo: ${error.message}`);
    return res.status(500).json({ message: 'Error al generar el archivo' });
  }
};

/**
 * @route POST /api/files/send/:id
 * @desc Envía el archivo por correo al cliente
 * @access Protegido (requiere JWT)
 */
exports.sendFile = async (req, res) => {
  const { id } = req.params;

  try {
    const file = await fileService.getFileById(id);
    
    if (!file) {
      logger.warn(`Archivo no encontrado para enviar: ${id}`);
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    // Mostrar información del archivo en consola para depuración
    if (process.env.NODE_ENV === 'development') {
      console.log('Archivo a enviar:', file);
    }

    // Verificar que haya emails disponibles antes de intentar enviar
    const emails = [];
    if (file.customer_email) emails.push(file.customer_email);
    if (file.contact_emails) emails.push(...file.contact_emails.split(',').filter(email => email.trim()));
    
    console.log('Emails encontrados:', emails);
    
    if (emails.length === 0) {
      console.log('No hay emails disponibles, retornando error 400');
      return res.status(400).json({ 
        message: 'El cliente no tiene configurado una casilla de email',
        error: 'NO_EMAIL_CONFIGURED'
      });
    }

    await emailService.sendFileToClient(file);

    await fileService.updateFile({
      id: id,
      status_id: 3,
      updated_at: new Date(),
      path: file.path 
    });

    logger.info(`Archivo enviado correctamente: ${file.name}`);
    res.json({ message: 'Documento enviado correctamente' });
  } catch (err) {
    logger.error(`Error al enviar archivo: ${err.message}`);
    
    // Si es error de emails no configurados, retornar mensaje específico
    if (err.message.includes('No hay emails disponibles')) {
      return res.status(400).json({ 
        message: 'El cliente no tiene configurado una casilla de email',
        error: 'NO_EMAIL_CONFIGURED'
      });
    }
    
    res.status(500).json({ message: 'Error al enviar documento' });
  }
};

/**
 * @route DELETE /api/files/delete
 * @desc Elimina un archivo del sistema de archivos y su registro en la base de datos
 * @access Protegido (requiere JWT)
 */
exports.deleteFileById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const file = await fileService.getFileById(id);

    if (!file) {
      logger.warn(`Archivo no encontrado en BD: ${file}`);
      return res.status(404).json({ message: 'Archivo no encontrado en la base de datos' });
    }
    
    if (typeof file.path === 'string' && file.path.trim()) {
      const fullPath = path.join(process.env.FILE_SERVER_ROOT || '/var/www/html', file.path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        logger.info(`Archivo físico eliminado: ${fullPath}`);
      }
    }
    await fileService.deleteFileById(file.id);
    
    logger.info(`Archivo eliminado correctamente: ${file.name}`);
    res.json({ message: `Archivo ${file.name} eliminado correctamente` });
  } catch (error) {
    logger.error(`Error al eliminar archivo: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

/**
 * @route POST /api/files/resend/:id
 * @desc Duplica y reenvía el archivo por correo al cliente
 * @access Protegido (requiere JWT)
 */
exports.resendFile = async (req, res) => {
  const { id } = req.params;

  try {
    const newFileId = await fileService.duplicateFile(id);
    const newFile = await fileService.getFileById(newFileId);
    if (!newFile) throw new Error('Error al obtener nuevo archivo para enviar');
    

    await emailService.sendFileToClient(newFile);

    logger.info(`Archivo reenviado correctamente ID: ${newFileId}`);
    res.json({ message: 'Documento reenviado y enviado por correo correctamente' });
  } catch (err) {
    logger.error(`Error al reenviar archivo: ${err.message}`);
    res.status(500).json({ message: 'Error al reenviar y enviar el documento' });
  }
};

/**
 * @route POST /api/files/create-default/:orderId
 * @desc Crea archivos por defecto para una orden específica
 * @access Protegido (requiere JWT)
 */
exports.createDefaultFiles = async (req, res) => {
  const { orderId } = req.params;

  try {
    // Obtener información de la orden y cliente
    const pool = await poolPromise;
    const [[order]] = await pool.query(`
      SELECT o.*, c.name as customer_name 
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `, [orderId]);

    if (!order) {
      logger.warn(`Orden no encontrada ID: ${orderId}`);
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Crear archivos por defecto
    const result = await createDefaultFilesForOrder(
      orderId,
      order.customer_name,
      order.pc,
      order.oc
    );

    logger.info(`Archivos por defecto creados para orden ${orderId}: ${result.filesCreated} archivos`);
    res.status(201).json(result);

  } catch (error) {
    logger.error(`Error creando archivos por defecto para orden ${orderId}: ${error.message}`);
    res.status(500).json({ 
      message: 'Error al crear archivos por defecto', 
      error: error.message 
    });
  }
};
