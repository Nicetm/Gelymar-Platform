const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { insertFile, getFiles, RenameFile, createDefaultFilesForOrder } = require('../services/file.service');
const { 
  generateRecepcionOrden,
  generateAvisoEmbarque,
  generateAvisoEntrega,
  generateAvisoDisponibilidad,
  getWeekOfYear,
  formatDateByLanguage
} = require('../pdf-generator/generator');

const fileService = require('../services/file.service');
const emailService = require('../services/email.service');
const orderService = require('../services/order.service');
const documentFileService = require('../services/documentFile.service');
const { logger } = require('../utils/logger');
const { cleanDirectoryName } = require('../utils/directoryUtils');
const { validateFilePath, setSecureFilePermissions } = require('../utils/filePermissions');


const DOC_NAME_MAP_ES = {
  'Order Receipt Notice': 'Aviso de Recepcion de Orden',
  'Shipment Notice': 'Aviso de Embarque',
  'Order Delivery Notice': 'Aviso de Entrega',
  'Availability Notice': 'Aviso de Disponibilidad de Orden'
};

const FILE_ID_NAME_MAP = {
  9: 'Order Receipt Notice',
  19: 'Shipment Notice',
  15: 'Order Delivery Notice',
  6: 'Availability Notice'
};


function getDocumentDisplayName(documentName, lang) {
  if (lang === 'es') {
    return DOC_NAME_MAP_ES[documentName] || documentName;
  }
  return documentName;
}

function resolveDocumentName(file) {
  if (file && file.file_id && FILE_ID_NAME_MAP[file.file_id]) {
    return FILE_ID_NAME_MAP[file.file_id];
  }
  return file?.name || '';
}

function sanitizeFileNamePart(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePONumber(value) {
  if (!value) return '-';
  const normalized = String(value).replace(/^GEL\s*/i, '').trim();
  return normalized || '-';
}

function buildDocumentFileBaseName(documentName, file, pdfData, lang) {
  const docName = sanitizeFileNamePart(getDocumentDisplayName(documentName, lang)) || 'Documento';
  const customerName = sanitizeFileNamePart(pdfData?.customerName || file.customer_name) || 'Cliente';
  const poNumber = normalizePONumber(pdfData?.orderNumber || file.oc);
  const poLabel = sanitizeFileNamePart(`PO ${poNumber}`) || 'PO -';
  return `${docName} - ${customerName} - ${poLabel}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mapea el nombre del documento al generador correspondiente
 * @param {string} documentName - Nombre del documento
 * @returns {Function} Función generadora correspondiente
 */
function getDocumentGenerator(documentName) {
  const generators = {
    'Order Receipt Notice': generateRecepcionOrden,
    'Shipment Notice': generateAvisoEmbarque,
    'Order Delivery Notice': generateAvisoEntrega,
    'Availability Notice': generateAvisoDisponibilidad
  };
  
  return generators[documentName] || generateRecepcionOrden; // Fallback si no encuentra
}

/**
 * Obtiene datos reales de la BD para generar el PDF
 * @param {Object} file - Datos del archivo
 * @param {string} lang - Idioma ('es' o 'en')
 * @returns {Object} Datos formateados para el template
 */
async function getPDFData(file, lang = 'es') {
  const order = await documentFileService.getOrderWithCustomerForPdf(file.order_id);
  const orderDetail = await documentFileService.getOrderDetailForPdf(file.order_id);
  const documentName = resolveDocumentName(file);

  let orderItems = [];
  if (order?.pc && order?.oc) {
    orderItems = await documentFileService.getOrderItemsByPcOcFactura(order.pc, order.oc, order.factura);
  }

  if (!orderItems.length && order?.id) {
    orderItems = await documentFileService.getOrderItemsByOrderId(order.id);
  }

  // Fechas actuales
  const currentDate = new Date();
  const receptionDate = currentDate.toLocaleDateString('es-CL');
  const shipmentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL'); // +7 días
  const estimatedDeparture = new Date(currentDate.getTime() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL'); // +10 días
  const estimatedArrival = new Date(currentDate.getTime() + 25 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL'); // +25 días
  const estimatedDelivery = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL'); // +30 días

  // Ruta opcional de firma
  const signaturePath = path.join(__dirname, '../pdf-generator/assets/firma_carla.png');

  const resolvePdfDate = (...values) => {
    for (const value of values) {
      if (!value) continue;
      const normalized =
        value instanceof Date
          ? value.toISOString().slice(0, 10)
          : String(value).trim();
      if (!normalized || normalized === '0' || normalized.toLowerCase() === 'null') {
        continue;
      }
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) {
        return normalized;
      }
    }
    return null;
  };

  const etd = resolvePdfDate(orderDetail?.fecha_etd_factura, orderDetail?.fecha_etd);
  const eta = resolvePdfDate(orderDetail?.fecha_eta_factura, orderDetail?.fecha_eta);

  const hasFactura =
    order?.factura !== null &&
    order?.factura !== undefined &&
    order?.factura !== '' &&
    order?.factura !== 0 &&
    order?.factura !== '0';
  const shippingMethod = hasFactura
    ? (orderDetail?.medio_envio_factura || orderDetail?.medio_envio_ov)
    : (orderDetail?.medio_envio_ov || orderDetail?.medio_envio_factura);

  const baseData = {
    title: documentName,
    subtitle: `Documento generado para ${order?.customer_name || file.customer_name}`,
    customerName: order?.customer_name || file.customer_name,
    internalOrderNumber: order?.pc || '-',
    orderNumber: order?.oc ? order.oc.replace(/^GEL\s*/i, '') : '-',
    tipo: orderDetail?.tipo || '-',
    responsiblePerson: 'Sistema Gelymar',
    destinationPort: orderDetail?.puerto_destino || '-',
    incoterm: orderDetail?.incoterm || '-',
    shippingMethod: shippingMethod || '-',
    etd,
    eta,
    currency: orderDetail?.currency || 'USD',
    paymentCondition: orderDetail?.condicion_venta || '-',
    additionalCharge: orderDetail?.gasto_adicional_flete_factura,
    incotermDeliveryDate: getWeekOfYear(orderDetail?.fecha_incoterm, lang),
    receptionDate,
    shipmentDate,
    estimatedDeparture,
    estimatedArrival,
    estimatedDelivery,
    signImagePath: fs.existsSync(signaturePath) ? signaturePath : null,
    items: orderItems.map(item => ({
      descripcion: item.descripcion || item.item_name || 'Producto',
      kg_solicitados: item.kg_solicitados || 1,
      unit_price: item.unit_price || 0,
      factura: item.factura || '-'
    }))
  };

  // Datos específicos según el tipo de documento
  const specificData = {
    'Order Receipt Notice': {
      ...baseData,
      processingStatus: 'En Proceso',
      serviceType: 'Logística Integral',
      origin: 'Chile',
      destination: 'Internacional',
      priority: 'Normal',
      shippingMethod: baseData.shippingMethod
    },
    'Shipment Notice': {
      ...baseData,
      portOfShipment: 'Puerto de Valparaíso',
      vesselName: 'M/V Gelymar Express',
      containerNumber: `GEL-${Math.floor(Math.random() * 900000) + 100000}`,
      portOfDestination: 'Puerto de Destino',
      cargoType: 'Mercancía General',
      totalWeight: orderItems.reduce((sum, item) => sum + (item.kg_solicitados || 0), 0),
      totalVolume: orderItems.reduce((sum, item) => sum + (item.volumen || 0), 0),
      specialInstructions: 'Manejar con cuidado. Mercancía frágil.',
      shippingMethod: baseData.shippingMethod
    },
    'Order Delivery Notice': {
      ...baseData,
      items: orderItems,
      processingStatus: 'Entregado',
      serviceType: 'Servicio Logístico Completo',
      dimensions: 'Variable según producto',
      factura: orderDetail?.factura || '-',
      shippingMethod: baseData.shippingMethod
    },
    'Availability Notice': {
      ...baseData,
      items: orderItems,
      processingStatus: 'Disponible',
      serviceType: 'Servicio Logístico Completo',
      origin: 'Chile',
      destination: 'Internacional',
      priority: 'Normal',
      shippingMethod: baseData.shippingMethod
    }
  };

  // Agregar traducciones según el tipo de documento
  const { getDocumentTranslations } = require('../pdf-generator/i18n');
  let translationKey = 'aviso_recepcion'; // Default
  
  if (documentName === 'Shipment Notice') {
    translationKey = 'aviso_embarque';
  } else if (documentName === 'Order Delivery Notice') {
    translationKey = 'aviso_entrega';
  } else if (documentName === 'Availability Notice') {
    translationKey = 'aviso_disponibilidad';
  }
  
  const translations = getDocumentTranslations(translationKey, lang);
  
  const result = specificData[documentName] || baseData;
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
    const order = await documentFileService.getOrderPcOcById(folder_id);
    
    if (!order) {
      logger.warn(`Orden no encontrada ID: ${folder_id}`);
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Obtener el file_identifier para esta orden (el mas reciente)
    const latestFile = await documentFileService.getLatestFileIdentifierByOrderId(folder_id);

    // Limpiar nombres de directorios para la ruta en la BD
    const cleanClientName = cleanDirectoryName(client_name);
    const cleanSubfolder = cleanDirectoryName(subfolder);
    
    // Si no hay file_identifier, generar uno nuevo
    let fileIdentifier = latestFile?.file_identifier;
    
    if (!fileIdentifier) {
      // Buscar el último identificador usado para este PC
      const lastPCFile = await documentFileService.getLastFileIdentifierByPc(order.pc);
      
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
      is_generated: 0,
      file_id: req.body.file_id || null
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
      const customerCheck = await documentFileService.getCustomerCheckForViewFile(id, userId);
      
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
    
  try {
    // Verificar token temporal
    if (!global.tempTokens || !global.tempTokens.has(token)) {
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
  const { id } = req.params;
  const { token } = req.query;
  
  try {
    // Verificar token JWT
    if (!token) {
      return res.status(401).json({ message: 'Token requerido' });
    }
    
    // Verificar token JWT
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Obtener información del archivo
    const file = await fileService.getFileById(id);
    if (!file) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    // Verificar que el usuario tenga acceso al archivo
    const userId = decoded.id;
    const userRole = decoded.role;
    
    // Si es admin, puede acceder a todos los archivos
    if (userRole !== 'admin') {
      // Primero obtener el customer del usuario
      const userCustomer = await documentFileService.getUserCustomerByUserId(userId);
      
      if (!userCustomer) {
        return res.status(403).json({ message: 'No tienes permisos para acceder a este archivo' });
      }
      
      // Verificar que el archivo pertenece a una orden del customer
      const customerCheck = await documentFileService.getFileCustomerCheck(id, userCustomer.id);
      
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
      const customerCheck = await documentFileService.getCustomerCheckForDownload(id, userId);
      
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
    const customer = await documentFileService.getCustomerByUuid(customerUuid);

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
  const { lang: frontendLang = 'es' } = req.body; // Recibir idioma del frontend como fallback

  try {
    const file = await fileService.getFileById(id);
    if (!file) {
      logger.warn(`Archivo no encontrado ID: ${id}`);
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    // Usar el idioma de la BD (country_lang) o el del frontend como fallback
    const lang = file.lang || frontendLang;

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
    const documentName = resolveDocumentName(file);
    const generator = getDocumentGenerator(documentName);

    // Obtener datos reales de la BD
    const pdfData = await getPDFData(file, lang);

    const baseName = buildDocumentFileBaseName(documentName, file, pdfData, lang);
    const fileName = `${baseName}.pdf`;
    const filePath = path.join(customerFolder, fileName);
    
    // Generar el PDF con el generador y datos correspondientes
    await generator(filePath, pdfData);

    const updateData = {
      id: file.id,
      name: baseName,
      status_id: 2,
      updated_at: new Date(),
      fecha_generacion: new Date(),
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

    const { emails: emailsFromBody, lang: requestedLang, cco_emails: ccoFromBody } = req.body || {};
    const overrideEmails = Array.isArray(emailsFromBody)
      ? emailsFromBody.map((email) => (typeof email === 'string' ? email.trim() : '')).filter(Boolean)
      : [];
    const overrideCco = Array.isArray(ccoFromBody)
      ? ccoFromBody.map((email) => (typeof email === 'string' ? email.trim() : '')).filter(Boolean)
      : [];

    const sendOptions = {};
    if (requestedLang) {
      sendOptions.lang = requestedLang;
    }
    if (overrideEmails.length) {
      sendOptions.recipients = overrideEmails;
    }
    if (overrideCco.length) {
      sendOptions.ccoRecipients = overrideCco;
    }

    await emailService.sendFileToClient(file, sendOptions);

    await fileService.updateFile({
      id: id,
      status_id: 3,
      updated_at: new Date(),
      fecha_envio: new Date(),
      path: file.path 
    });

    logger.info(`Archivo enviado correctamente: ${file.name}`);
    res.json({ message: 'Documento enviado correctamente' });
  } catch (err) {
    logger.error(`Error al enviar archivo: ${err.message}`);
    
    if (err.name === 'EmailPermissionError') {
      const validationMode = err.validationMode === 0 ? 0 : 1;
      const reasonLabel = validationMode === 0 ? 'SH Docs' : 'Reports';
      const blockedEmails = Array.isArray(err.blockedEmails)
        ? err.blockedEmails.filter((email) => typeof email === 'string' && email.trim())
        : [];
      const message = blockedEmails.length
        ? `Los siguientes correos no tienen habilitado ${reasonLabel}: ${blockedEmails.join(', ')}`
        : `No hay correos con ${reasonLabel} habilitado para este tipo de documento.`;
      return res.status(400).json({
        message,
        error: 'EMAIL_PERMISSION_DENIED',
        reason: reasonLabel,
        emails: blockedEmails
      });
    }

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
 * @route POST /api/files/regenerate/:id
 * @desc Regenera el PDF del archivo sin cambiar el status_id
 * @access Protegido (requiere JWT)
 */
exports.regenerateFile = async (req, res) => {
  const { id } = req.params;
  const { lang: frontendLang = 'es' } = req.body;

  try {
    const file = await fileService.getFileById(id);
    if (!file) {
      logger.warn(`Archivo no encontrado ID: ${id}`);
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    // Usar el idioma de la BD (country_lang) o el del frontend como fallback
    const lang = file.lang || frontendLang;

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
    const documentName = resolveDocumentName(file);
    const generator = getDocumentGenerator(documentName);

    // Obtener datos reales de la BD
    const pdfData = await getPDFData(file, lang);

    const baseName = buildDocumentFileBaseName(documentName, file, pdfData, lang);
    const versionPrefix = `${baseName}_v`;
    const versionRegex = new RegExp(`^${escapeRegExp(baseName)}_v(\\d+)\\.pdf$`);

    // Generar nombre de archivo con versión
    // Buscar archivos existentes con patrón _v*
    const existingFiles = fs.readdirSync(customerFolder).filter(f =>
      f.startsWith(versionPrefix) && f.endsWith('.pdf')
    );
    
    let version = 1;
    if (existingFiles.length > 0) {
      // Extraer números de versión existentes
      const versions = existingFiles.map(f => {
        const match = f.match(versionRegex);
        return match ? parseInt(match[1], 10) : 0;
      }).filter(v => v > 0);
      
      // Encontrar el siguiente número disponible
      if (versions.length > 0) {
        version = Math.max(...versions) + 1;
      }
    }
    
    const recordName = `${versionPrefix}${version}`;
    const fileName = `${recordName}.pdf`;
    const filePath = path.join(customerFolder, fileName);
    
    // Generar el PDF con el generador y datos correspondientes
    await generator(filePath, pdfData);

    // Duplicar el archivo con la nueva versión
    const newFileId = await fileService.duplicateFile(id, path.relative(FILE_SERVER_ROOT, filePath), recordName);

    logger.info(`Archivo regenerado correctamente ID: ${id} - Versión: ${fileName} - Nuevo ID: ${newFileId}`);
    res.json({ 
      message: 'Documento regenerado correctamente',
      fileName: fileName,
      filePath: path.relative(FILE_SERVER_ROOT, filePath),
      newFileId: newFileId
    });
  } catch (err) {
    logger.error(`Error al regenerar archivo: ${err.message}`);
    res.status(500).json({ message: 'Error al regenerar el documento' });
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
    // El archivo ya fue duplicado en regenerateFile, solo enviar
    const file = await fileService.getFileById(id);
    if (!file) throw new Error('Error al obtener archivo para enviar');

    const { emails: emailsFromBody, lang: requestedLang, cco_emails: ccoFromBody } = req.body || {};
    const overrideEmails = Array.isArray(emailsFromBody)
      ? emailsFromBody.map((email) => (typeof email === 'string' ? email.trim() : '')).filter(Boolean)
      : [];
    const overrideCco = Array.isArray(ccoFromBody)
      ? ccoFromBody.map((email) => (typeof email === 'string' ? email.trim() : '')).filter(Boolean)
      : [];

    const sendOptions = {};
    if (requestedLang) {
      sendOptions.lang = requestedLang;
    }
    if (overrideEmails.length) {
      sendOptions.recipients = overrideEmails;
    }
    if (overrideCco.length) {
      sendOptions.ccoRecipients = overrideCco;
    }

    await emailService.sendFileToClient(file, sendOptions);

    await fileService.updateFile({
      id: id,
      fecha_reenvio: new Date(),
      updated_at: new Date()
    });

    logger.info(`Archivo reenviado correctamente ID: ${id}`);
    res.json({ message: 'Documento reenviado y enviado por correo correctamente' });
  } catch (err) {
    logger.error(`Error al reenviar archivo: ${err.message}`);
    
    if (err.name === 'EmailPermissionError') {
      const validationMode = err.validationMode === 0 ? 0 : 1;
      const reasonLabel = validationMode === 0 ? 'SH Docs' : 'Reports';
      const blockedEmails = Array.isArray(err.blockedEmails)
        ? err.blockedEmails.filter((email) => typeof email === 'string' && email.trim())
        : [];
      const message = blockedEmails.length
        ? `Los siguientes correos no tienen habilitado ${reasonLabel}: ${blockedEmails.join(', ')}`
        : `No hay correos con ${reasonLabel} habilitado para este tipo de documento.`;
      return res.status(400).json({
        message,
        error: 'EMAIL_PERMISSION_DENIED',
        reason: reasonLabel,
        emails: blockedEmails
      });
    }

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
    const order = await documentFileService.getOrderWithCustomerForDefaultFiles(orderId);

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

// Nuevo endpoint para procesar órdenes nuevas y enviar recepción de orden
exports.processNewOrdersAndSendReception = async (req, res) => {
  try {
    const {
      getOrdersReadyForOrderReceiptNotice,
      getReceptionFile,
      getReportEmailsAndLang,
      isSendOrderReceptionEnabled,
      getSendFromDate
    } = require('../services/checkOrderReception.service');
    const { sendFileToClient } = require('../services/email.service');
    const fs = require('fs');
    const path = require('path');

    const automaticReceptionEnabled = await isSendOrderReceptionEnabled();
    const sendFromDate = await getSendFromDate('sendAutomaticOrderReception');

    const orders = await getOrdersReadyForOrderReceiptNotice(sendFromDate);

    if (orders.length === 0) {
      return res.status(200).json({
        message: 'No hay órdenes nuevas para procesar',
        processed: 0
      });
    }

    let processed = 0;
    let errors = 0;
    let skipped = 0;

    for (const orderRow of orders) {
      try {
        if (!orderRow.receipt_file_id) {
          await fileService.createDefaultFilesForOrder(
            orderRow.id,
            orderRow.customer_name,
            orderRow.pc,
            orderRow.oc
          );
        }

        const receptionFile = await getReceptionFile(orderRow.id);
        if (!receptionFile) {
          console.error(`No se encontró archivo de recepción para orden ${orderRow.id}`);
          errors++;
          continue;
        }

        const { reportEmails, customerLang } = await getReportEmailsAndLang(orderRow.customer_id);

        if (reportEmails.length === 0) {
          console.error(`No se encontraron emails con reports=true para cliente ${orderRow.customer_id}`);
          errors++;
          continue;
        }

        const file = await fileService.getFileById(receptionFile.id);
        if (!file) {
          console.error(`No se encontró archivo con ID ${receptionFile.id} para orden ${orderRow.id}`);
          errors++;
          continue;
        }

        const FILE_SERVER_ROOT = process.env.FILE_SERVER_ROOT || '/var/www/html';
        const cleanCustomerName = cleanDirectoryName(file.customer_name);
        const cleanFolderName = cleanDirectoryName(file.pc);
        const folderName = file.file_identifier ? `${cleanFolderName}_${file.file_identifier}` : cleanFolderName;
        const customerFolder = path.join(FILE_SERVER_ROOT, 'uploads', cleanCustomerName, folderName);

        if (!fs.existsSync(customerFolder)) {
          fs.mkdirSync(customerFolder, { recursive: true });
        }
        const documentName = resolveDocumentName(file);
        const generator = getDocumentGenerator(documentName);

        const pdfData = await getPDFData(file, customerLang);

        const baseName = buildDocumentFileBaseName(documentName, file, pdfData, customerLang);
        const fileName = `${baseName}.pdf`;
        const filePath = path.join(customerFolder, fileName);

        let updateData;

        try {
          await generator(filePath, pdfData);

            updateData = {
              id: file.id,
              name: baseName,
              status_id: 3,
              is_visible_to_client: 1,
              updated_at: new Date(),
              fecha_generacion: new Date(),
              path: path.relative(FILE_SERVER_ROOT, filePath)
          };

          await fileService.updateFile(updateData);
        } catch (pdfError) {
          console.error(`Error generando PDF para orden ${orderRow.id}:`, pdfError.message);
          errors++;
          continue;
        }

          const fileData = {
            id: file.id,
            name: baseName,
            path: updateData.path,
            customer_name: file.customer_name,
            customer_id: file.customer_id,
            lang: customerLang
          };

        if (automaticReceptionEnabled) {
          await sendFileToClient(fileData, { recipients: reportEmails });

          await fileService.updateFile({
            id: file.id,
            fecha_envio: new Date(),
            updated_at: new Date()
          });

          processed++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error procesando orden ${orderRow.id}:`, error.message);
        errors++;
      }
    }

    res.status(200).json({
      message: 'Procesamiento de órdenes nuevas completado',
      processed,
      errors,
      skipped,
      total: orders.length
    });

  } catch (error) {
    console.error('Error en processNewOrdersAndSendReception:', error);
    res.status(500).json({
      message: 'Error al procesar órdenes nuevas',
      error: error.message
    });
  }
};

exports.processShipmentNotices = async (req, res) => {
  try {
    const {
      getOrdersReadyForShipmentNotice,
      getShipmentFile
    } = require('../services/checkShipmentNotice.service');
      const {
        getReportEmailsAndLang,
        isSendOrderShipmentEnabled,
        getSendFromDate
      } = require('../services/checkOrderReception.service');
    const { sendFileToClient } = require('../services/email.service');
    const fs = require('fs');
    const path = require('path');

      const automaticReceptionEnabled = await isSendOrderShipmentEnabled();
      const sendFromDate = await getSendFromDate('sendAutomaticOrderShipment');

      const orders = await getOrdersReadyForShipmentNotice(sendFromDate);
    if (!orders.length) {
      return res.status(200).json({
        message: 'No hay ordenes listas para Shipment Notice',
        processed: 0
      });
    }

    let processed = 0;
    let errors = 0;
    let skipped = 0;
    const skipReasons = {
      missing_eta: 0,
      already_sent: 0,
      disabled_config: 0
    };

    for (const orderRow of orders) {
      try {
        if (!orderRow.etd || !orderRow.eta) {
          skipped++;
          continue;
        }

          if (!orderRow.shipment_file_id) {
            try {
              await fileService.createDefaultFilesForOrder(
                orderRow.id,
                orderRow.customer_name,
                orderRow.pc,
                orderRow.oc
              );
            } catch (fileError) {
              if (fileError.message !== 'Ya existen archivos para esta orden') {
                throw fileError;
              }
            }
          }

        const shipmentFile = await getShipmentFile(orderRow.id);
        if (!shipmentFile) {
          errors++;
          continue;
        }

        if (shipmentFile.fecha_envio) {
          skipped++;
          continue;
        }

        const file = await fileService.getFileById(shipmentFile.id);
        if (!file) {
          errors++;
          continue;
        }

        const { reportEmails, customerLang } = await getReportEmailsAndLang(orderRow.customer_id);
        if (reportEmails.length === 0) {
          errors++;
          continue;
        }

        const FILE_SERVER_ROOT = process.env.FILE_SERVER_ROOT || '/var/www/html';
        const cleanCustomerName = cleanDirectoryName(file.customer_name);
        const cleanFolderName = cleanDirectoryName(file.pc);
        const folderName = file.file_identifier ? `${cleanFolderName}_${file.file_identifier}` : cleanFolderName;
        const customerFolder = path.join(FILE_SERVER_ROOT, 'uploads', cleanCustomerName, folderName);

        if (!fs.existsSync(customerFolder)) {
          fs.mkdirSync(customerFolder, { recursive: true });
        }
        const documentName = resolveDocumentName(file);
        const generator = getDocumentGenerator(documentName);
        const pdfData = await getPDFData(file, customerLang);

        const baseName = buildDocumentFileBaseName(documentName, file, pdfData, customerLang);
        const fileName = `${baseName}.pdf`;
        const filePath = path.join(customerFolder, fileName);

        let updateData;
        try {
          await generator(filePath, pdfData);
          updateData = {
            id: file.id,
            name: baseName,
            status_id: 3,
            is_visible_to_client: 1,
            updated_at: new Date(),
            fecha_generacion: new Date(),
            path: path.relative(FILE_SERVER_ROOT, filePath)
          };


          await fileService.updateFile(updateData);
        } catch (pdfError) {
          errors++;
          continue;
        }

        const fileData = {
          id: file.id,
          name: baseName,
          path: updateData.path,
          customer_name: file.customer_name,
          customer_id: file.customer_id,
          lang: customerLang
        };

        if (automaticReceptionEnabled) {
          await sendFileToClient(fileData, { recipients: reportEmails });
          await fileService.updateFile({
            id: file.id,
            fecha_envio: new Date(),
            updated_at: new Date()
          });
          processed++;
        } else {
          skipReasons.disabled_config++;
          skipped++;
        }
      } catch (error) {
        errors++;
      }
    }

    res.status(200).json({
      message: 'Procesamiento de Shipment Notice completado',
      processed,
      skipped,
      errors
    });
  } catch (error) {
    logger.error(`Error en processShipmentNotices: ${error.message}`);
    res.status(500).json({ message: 'Error procesando Shipment Notice' });
  }
};

exports.processOrderDeliveryNotices = async (req, res) => {
  try {
    const {
      getOrdersReadyForOrderDeliveryNotice,
      getOrderDeliveryFile
    } = require('../services/checkOrderDeliveryNotice.service');
    const {
      getReportEmailsAndLang,
      isSendOrderDeliveryEnabled,
      getSendFromDate
    } = require('../services/checkOrderReception.service');
    const { sendFileToClient } = require('../services/email.service');
    const fs = require('fs');
    const path = require('path');

    const automaticReceptionEnabled = await isSendOrderDeliveryEnabled();
    const sendFromDate = await getSendFromDate('sendAutomaticOrderDelivery');

    const orders = await getOrdersReadyForOrderDeliveryNotice(sendFromDate);
    if (!orders.length) {
      return res.status(200).json({
        message: 'No hay ordenes listas para Order Delivery Notice',
        processed: 0
      });
    }

    let processed = 0;
    let errors = 0;
    let skipped = 0;
    const skipReasons = {
      missing_eta: 0,
      already_sent: 0
    };

    for (const orderRow of orders) {
      try {
        if (!orderRow.eta) {
          logger.warn(`Order Delivery Notice omitida: orden ${orderRow.id} sin ETA`);
          console.warn(`[Order Delivery Notice] Omitida: orden ${orderRow.id} sin ETA`);
          skipReasons.missing_eta++;
          skipped++;
          continue;
        }

          if (!orderRow.delivery_file_id) {
            try {
              await fileService.createDefaultFilesForOrder(
                orderRow.id,
                orderRow.customer_name,
                orderRow.pc,
                orderRow.oc
              );
            } catch (fileError) {
              if (fileError.message !== 'Ya existen archivos para esta orden') {
                throw fileError;
              }
            }
          }

          const deliveryFile = await getOrderDeliveryFile(orderRow.id);
          if (!deliveryFile) {
            logger.error(`Order Delivery Notice sin archivo: orden ${orderRow.id}`);
            console.error(`[Order Delivery Notice] Sin archivo: orden ${orderRow.id}`);
            errors++;
            continue;
          }

        if (deliveryFile.fecha_envio) {
            skipReasons.already_sent++;
            skipped++;
            continue;
          }

          const file = await fileService.getFileById(deliveryFile.id);
          if (!file) {
            logger.error(`Order Delivery Notice file no encontrado: order_file ${deliveryFile.id} orden ${orderRow.id}`);
            console.error(`[Order Delivery Notice] File no encontrado: order_file ${deliveryFile.id} orden ${orderRow.id}`);
            errors++;
            continue;
          }

          const { reportEmails, customerLang } = await getReportEmailsAndLang(orderRow.customer_id);
          if (reportEmails.length === 0) {
            logger.warn(`Order Delivery Notice sin emails report: cliente ${orderRow.customer_id} orden ${orderRow.id}`);
            console.warn(`[Order Delivery Notice] Sin emails report: cliente ${orderRow.customer_id} orden ${orderRow.id}`);
            errors++;
            continue;
          }

        const FILE_SERVER_ROOT = process.env.FILE_SERVER_ROOT || '/var/www/html';
        const cleanCustomerName = cleanDirectoryName(file.customer_name);
        const cleanFolderName = cleanDirectoryName(file.pc);
        const folderName = file.file_identifier ? `${cleanFolderName}_${file.file_identifier}` : cleanFolderName;
        const customerFolder = path.join(FILE_SERVER_ROOT, 'uploads', cleanCustomerName, folderName);

        if (!fs.existsSync(customerFolder)) {
          fs.mkdirSync(customerFolder, { recursive: true });
        }
        const documentName = resolveDocumentName(file);
        const generator = getDocumentGenerator(documentName);
        const pdfData = await getPDFData(file, customerLang);

        const baseName = buildDocumentFileBaseName(documentName, file, pdfData, customerLang);
        const fileName = `${baseName}.pdf`;
        const filePath = path.join(customerFolder, fileName);

        let updateData;
        try {
          await generator(filePath, pdfData);
          updateData = {
            id: file.id,
            name: baseName,
            status_id: 3,
            is_visible_to_client: 1,
            updated_at: new Date(),
            fecha_generacion: new Date(),
            path: path.relative(FILE_SERVER_ROOT, filePath)
          };
          await fileService.updateFile(updateData);
          } catch (pdfError) {
            logger.error(`Error generando Order Delivery Notice: orden ${orderRow.id} - ${pdfError.message}`);
            console.error(`[Order Delivery Notice] Error generando PDF: orden ${orderRow.id} - ${pdfError.message}`);
            errors++;
            continue;
          }

        const fileData = {
          id: file.id,
          name: baseName,
          path: updateData.path,
          customer_name: file.customer_name,
          customer_id: file.customer_id,
          lang: customerLang
        };

        if (automaticReceptionEnabled) {
          await sendFileToClient(fileData, { recipients: reportEmails });
          await fileService.updateFile({
            id: file.id,
            fecha_envio: new Date(),
            updated_at: new Date()
          });
          processed++;
        } else {
          skipped++;
        }
        } catch (error) {
          logger.error(`Error procesando Order Delivery Notice: orden ${orderRow.id} - ${error.message}`);
          console.error(`[Order Delivery Notice] Error procesando: orden ${orderRow.id} - ${error.message}`);
          errors++;
        }
      }

    res.status(200).json({
      message: 'Procesamiento de Order Delivery Notice completado',
      processed,
      skipped,
      errors,
      automatic_enabled: automaticReceptionEnabled,
      skip_reasons: skipReasons
    });
  } catch (error) {
    logger.error(`Error en processOrderDeliveryNotices: ${error.message}`);
    res.status(500).json({ message: 'Error procesando Order Delivery Notice' });
  }
};

exports.processAvailabilityNotices = async (req, res) => {
  try {
    const {
      getOrdersReadyForAvailabilityNotice,
      getAvailabilityFile
    } = require('../services/checkAvailabilityNotice.service');
    const {
      getReportEmailsAndLang,
      isSendOrderAvailabilityEnabled,
      getSendFromDate
    } = require('../services/checkOrderReception.service');
    const { sendFileToClient } = require('../services/email.service');
    const fs = require('fs');
    const path = require('path');

    const automaticReceptionEnabled = await isSendOrderAvailabilityEnabled();
    const sendFromDate = await getSendFromDate('sendAutomaticOrderAvailability');

    const orders = await getOrdersReadyForAvailabilityNotice(sendFromDate);
    if (!orders.length) {
      return res.status(200).json({
        message: 'No hay ordenes listas para Availability Notice',
        processed: 0
      });
    }

    let processed = 0;
    let errors = 0;
    let skipped = 0;

    for (const orderRow of orders) {
      try {
          if (!orderRow.availability_file_id) {
            try {
              await fileService.createDefaultFilesForOrder(
                orderRow.id,
                orderRow.customer_name,
                orderRow.pc,
                orderRow.oc
              );
            } catch (fileError) {
              if (fileError.message !== 'Ya existen archivos para esta orden') {
                throw fileError;
              }
            }
          }

        const availabilityFile = await getAvailabilityFile(orderRow.id);
        if (!availabilityFile) {
          errors++;
          continue;
        }

        if (availabilityFile.fecha_envio) {
          skipped++;
          continue;
        }

        const file = await fileService.getFileById(availabilityFile.id);
        if (!file) {
          errors++;
          continue;
        }

        const { reportEmails, customerLang } = await getReportEmailsAndLang(orderRow.customer_id);
        if (reportEmails.length === 0) {
          errors++;
          continue;
        }

        const FILE_SERVER_ROOT = process.env.FILE_SERVER_ROOT || '/var/www/html';
        const cleanCustomerName = cleanDirectoryName(file.customer_name);
        const cleanFolderName = cleanDirectoryName(file.pc);
        const folderName = file.file_identifier ? `${cleanFolderName}_${file.file_identifier}` : cleanFolderName;
        const customerFolder = path.join(FILE_SERVER_ROOT, 'uploads', cleanCustomerName, folderName);

        if (!fs.existsSync(customerFolder)) {
          fs.mkdirSync(customerFolder, { recursive: true });
        }
        const documentName = resolveDocumentName(file);
        const generator = getDocumentGenerator(documentName);
        const pdfData = await getPDFData(file, customerLang);

        const baseName = buildDocumentFileBaseName(documentName, file, pdfData, customerLang);
        const fileName = `${baseName}.pdf`;
        const filePath = path.join(customerFolder, fileName);

        let updateData;
        try {
          await generator(filePath, pdfData);
          updateData = {
            id: file.id,
            name: baseName,
            status_id: 3,
            is_visible_to_client: 1,
            updated_at: new Date(),
            fecha_generacion: new Date(),
            path: path.relative(FILE_SERVER_ROOT, filePath)
          };
          await fileService.updateFile(updateData);
        } catch (pdfError) {
          errors++;
          continue;
        }

        const fileData = {
          id: file.id,
          name: baseName,
          path: updateData.path,
          customer_name: file.customer_name,
          customer_id: file.customer_id,
          lang: customerLang
        };

        if (automaticReceptionEnabled) {
          await sendFileToClient(fileData, { recipients: reportEmails });
          await fileService.updateFile({
            id: file.id,
            fecha_envio: new Date(),
            updated_at: new Date()
          });
          processed++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
      }
    }

    res.status(200).json({
      message: 'Procesamiento de Availability Notice completado',
      processed,
      skipped,
      errors
    });
  } catch (error) {
    logger.error(`Error en processAvailabilityNotices: ${error.message}`);
    res.status(500).json({ message: 'Error procesando Availability Notice' });
  }
};

