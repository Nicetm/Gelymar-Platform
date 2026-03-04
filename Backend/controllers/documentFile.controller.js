const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { container } = require('../config/container');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');
const { getSqlPool, sql } = require('../config/sqlserver');
const { 
  generateRecepcionOrden,
  generateAvisoEmbarque,
  generateAvisoEntrega,
  generateAvisoDisponibilidad,
  getWeekOfYear,
  formatDateByLanguage
} = require('../pdf-generator/generator');

const fileService = container.resolve('fileService');
const emailService = container.resolve('emailService');
const orderService = container.resolve('orderService');
const documentFileService = container.resolve('documentFileService');
const customerService = container.resolve('customerService');
const checkOrderReceptionService = container.resolve('checkOrderReceptionService');
const checkShipmentNoticeService = container.resolve('checkShipmentNoticeService');
const checkOrderDeliveryNoticeService = container.resolve('checkOrderDeliveryNoticeService');
const checkAvailabilityNoticeService = container.resolve('checkAvailabilityNoticeService');
const documentEventService = container.resolve('documentEventService');
const { normalizeRut } = require('../utils/rut.util');
const { cleanDirectoryName } = require('../utils/directoryUtils');
const { validateFilePath, setSecureFilePermissions } = require('../utils/filePermissions');

const logDocEvent = async (payload) => {
  try {
    await documentEventService.logDocumentEvent(payload);
  } catch (error) {
    logger.error(`[documentEvent] ${error.message}`);
  }
};


const DOC_NAME_MAP_ES = {
  'Order Receipt Notice': 'Aviso de Recepcion de Orden',
  'Shipment Notice': 'Aviso de Embarque',
  'Order Delivery Notice': 'Aviso de Entrega',
  'Availability Notice': 'Aviso de Disponibilidad de Orden'
};
const DOC_NAME_MAP_ES_TO_EN = Object.entries(DOC_NAME_MAP_ES).reduce((acc, [en, es]) => {
  acc[String(es).trim().toLowerCase()] = en;
  return acc;
}, {});

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
  if (file?.name) {
    const normalized = String(file.name).trim().toLowerCase();
    if (DOC_NAME_MAP_ES_TO_EN[normalized]) {
      return DOC_NAME_MAP_ES_TO_EN[normalized];
    }
    return file.name;
  }
  return '';
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
  const rawDocName = documentName || getDocumentDisplayName(documentName, lang) || 'Documento';
  const docName = sanitizeFileNamePart(rawDocName) || 'Documento';
  const customerName = sanitizeFileNamePart(pdfData?.customerName || file.customer_name) || '';
  const poNumber = normalizePONumber(pdfData?.orderNumber || file.oc);
  const poLabel = poNumber && poNumber !== '-' ? sanitizeFileNamePart(`PO ${poNumber}`) : '';
  const parts = [docName];
  if (customerName) parts.push(customerName);
  if (poLabel) parts.push(poLabel);
  return parts.join(' - ');
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
  // REFACTORING: Removed id_nro_ov_mas_factura parameter - no longer needed
  const order = await documentFileService.getOrderWithCustomerForPdf(
    file.pc,
    file.oc,
    file.factura
  );
  const orderDetail = await documentFileService.getOrderDetailForPdf(
    file.pc,
    file.oc,
    file.factura
  );
  const documentName = resolveDocumentName(file);

  let resolvedOrder = order;
  if ((!resolvedOrder || !resolvedOrder.pc || !resolvedOrder.oc || !resolvedOrder.customer_name) && file?.pc) {
    try {
      const sqlHeader = file.oc
        ? await orderService.getOrderByPcOc(String(file.pc), String(file.oc))
        : await orderService.getOrderByPc(String(file.pc));
      if (sqlHeader) {
        resolvedOrder = {
          ...(resolvedOrder || {}),
          pc: sqlHeader.pc || resolvedOrder?.pc,
          oc: sqlHeader.oc || resolvedOrder?.oc,
          customer_name: sqlHeader.customer_name || resolvedOrder?.customer_name,
          factura: sqlHeader.factura ?? resolvedOrder?.factura,
          fecha_factura: sqlHeader.fecha_factura ?? resolvedOrder?.fecha_factura,
        };
      }
    } catch (err) {
      logger.warn(`No se pudo resolver orden desde SQL para PDF pc=${file?.pc} oc=${file?.oc}: ${err.message}`);
    }
  }

  // REFACTORING: Removed resolveIdNroOvMasFactura call - id_nro_ov_mas_factura no longer exists
  let orderItems = [];
  if (resolvedOrder?.pc) {
    orderItems = await documentFileService.getOrderItemsByPcOcFactura(
      resolvedOrder.pc,
      resolvedOrder.oc,
      resolvedOrder.factura
    );
  }

  if (process.env.LOG_PDF_DATA === 'true') {
    logger.info(
      `[getPDFData] doc=${documentName || 'N/A'} file_id=${file?.file_id || 'N/A'} file_name=${file?.name || 'N/A'} pc=${resolvedOrder?.pc || file?.pc || 'N/A'} oc=${resolvedOrder?.oc || file?.oc || 'N/A'} factura=${resolvedOrder?.factura ?? file?.factura ?? 'N/A'} items=${orderItems.length} first=${orderItems[0] ? `sol=${orderItems[0].kg_solicitados ?? 'N/A'} fac=${orderItems[0].kg_facturados ?? 'N/A'}` : 'N/A'}`
    );
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
    resolvedOrder?.factura !== null &&
    resolvedOrder?.factura !== undefined &&
    resolvedOrder?.factura !== '' &&
    resolvedOrder?.factura !== 0 &&
    resolvedOrder?.factura !== '0';
  const shippingMethod = hasFactura
    ? (orderDetail?.medio_envio_factura || orderDetail?.medio_envio_ov)
    : (orderDetail?.medio_envio_ov || orderDetail?.medio_envio_factura);

  const additionalCharge = hasFactura
    ? orderDetail?.gasto_adicional_flete_factura
    : orderDetail?.gasto_adicional_flete;

  const baseData = {
    title: documentName,
    subtitle: `Documento generado para ${resolvedOrder?.customer_name || file.customer_name}`,
    customerName: resolvedOrder?.customer_name || file.customer_name,
    internalOrderNumber: resolvedOrder?.pc || '-',
    orderNumber: resolvedOrder?.oc ? resolvedOrder.oc.replace(/^GEL\s*/i, '') : '-',
    tipo: orderDetail?.tipo || '-',
    responsiblePerson: 'Sistema Gelymar',
    destinationPort: orderDetail?.puerto_destino || '-',
    incoterm: orderDetail?.incoterm || '-',
    shippingMethod: shippingMethod || '-',
    etd,
    eta,
    currency: orderDetail?.currency || 'USD',
    paymentCondition: orderDetail?.condicion_venta || '-',
    additionalCharge,
    hasFactura,
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
      kg_facturados: item.kg_facturados || 0,
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
      customer_id,
      folder_id,
      client_name,
      subfolder,
      name,
      is_visible_to_customer,
      pc,
      oc,
      idNroOvMasFactura: bodyIdNroOvMasFactura,
      id_nro_ov_mas_factura: bodyIdNroOvMasFacturaSnake
    } = req.body;
    const file = req.file;

    if (process.env.LOG_UPLOAD_DEBUG === 'true') {
      logger.info(`DEBUG - handleUpload recibido:`, {
        customer_id,
        folder_id,
        client_name,
        subfolder,
        name,
        is_visible_to_customer,
        pc,
        oc,
        idNroOvMasFactura: bodyIdNroOvMasFactura || bodyIdNroOvMasFacturaSnake,
        file: file ? { originalname: file.originalname, path: file.path, size: file.size } : null
      });
    }

    const orderPc = (pc || subfolder || '').trim();
    const orderOc = (oc || '').trim();
    const idFromBody = bodyIdNroOvMasFactura || bodyIdNroOvMasFacturaSnake || null;

    if (!file || !customer_id || !client_name || !orderPc) {
      logger.warn('Faltan parámetros obligatorios en handleUpload');
      return res.status(400).json({ message: t('documentFile.missing_required_params', req.lang || 'es') });
    }

    let order = null;
    if (folder_id && folder_id !== 'null' && folder_id !== 'undefined') {
      order = await documentFileService.getOrderPcOcById(folder_id);
    }
    if (!order && orderPc && orderOc) {
      order = await documentFileService.getOrderByPcOc(orderPc, orderOc);
    }
    if (!order && orderPc) {
      order = await documentFileService.getOrderByPc(orderPc);
    }
    if (!order) {
      order = { pc: orderPc, oc: orderOc || null };
    }

    let resolvedFactura = null;
    let resolvedId = idFromBody;

    if (resolvedId) {
      const orderWithId = await documentFileService.getOrderWithCustomerForDefaultFiles(order.pc, resolvedId);
      if (orderWithId) {
        if (!order.oc && orderWithId.oc) {
          order.oc = orderWithId.oc;
        }
        resolvedFactura = orderWithId.factura ?? resolvedFactura;
        resolvedId = orderWithId.id_nro_ov_mas_factura || resolvedId;
      }
    } else {
      const orderWithMeta = await documentFileService.getOrderWithCustomerForDefaultFiles(order.pc);
      if (orderWithMeta) {
        if (!order.oc && orderWithMeta.oc) {
          order.oc = orderWithMeta.oc;
        }
        resolvedFactura = orderWithMeta.factura ?? resolvedFactura;
        resolvedId = orderWithMeta.id_nro_ov_mas_factura || resolvedId;
      }
    }

    // Obtener el file_identifier para esta orden (el mas reciente)
    const latestFile = await documentFileService.getLastFileIdentifierByPc(order.pc);

    // Limpiar nombres de directorios para la ruta en la BD
    const cleanClientName = cleanDirectoryName(client_name);
    const cleanSubfolder = cleanDirectoryName(orderPc);
    
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
      return res.status(500).json({ message: t('documentFile.create_directory_error', req.lang || 'es') });
    }

    // Validar ruta de archivo para prevenir path traversal
    if (!validateFilePath(filePath, basePath)) {
      logger.warn(`Intento de upload con ruta insegura: ${filePath}`);
      return res.status(400).json({ message: t('documentFile.invalid_file_path', req.lang || 'es') });
    }

    // Guardar el archivo desde el buffer de memoria
    const physicalFilePath = path.join(physicalDirPath, file.originalname);
    try {
      fs.writeFileSync(physicalFilePath, file.buffer);
    } catch (error) {
      logger.error(`Error guardando archivo: ${error.message}`);
      return res.status(500).json({ message: t('documentFile.save_file_error', req.lang || 'es') });
    }

    // Establecer permisos seguros para el archivo subido
    await setSecureFilePermissions(physicalFilePath);

    const fileData = {
      customer_id,
      pc: order.pc,
      oc: order.oc,
      factura: resolvedFactura,
      id_nro_ov_mas_factura: resolvedId,
      name: name,
      path: filePath,
      file_identifier: fileIdentifier,
      status_id: 2,
      is_visible_to_customer: is_visible_to_customer,
      is_generated: 0,
      file_id: req.body.file_id || null
    };

    await fileService.insertFile(fileData);
    
    logger.info(`[handleUpload] source=manual Archivo subido pc=${order.pc || 'N/A'} oc=${order.oc || 'N/A'} factura=${resolvedFactura ?? 'N/A'} id=${resolvedId || 'N/A'} name=${file.originalname}`);
    res.status(201).json({ message: t('documentFile.file_uploaded_success', req.lang || 'es') });
  } catch (err) {
    logger.error(`Error al subir archivo: ${err.message}`);
    res.status(500).json({ message: t('documentFile.upload_error', req.lang || 'es'), error: err.message });
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
      return res.status(404).json({ message: t('documentFile.file_not_found', req.lang || 'es') });
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
        return res.status(403).json({ message: t('documentFile.no_permission', req.lang || 'es') });
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
    res.status(500).json({ message: t('documentFile.view_file_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('documentFile.token_invalid_expired', req.lang || 'es') });
    }
    
    const tokenData = global.tempTokens.get(token);
    
    // Verificar expiración
    if (tokenData.expiresAt < new Date()) {
      global.tempTokens.delete(token);
      return res.status(404).json({ message: t('documentFile.token_expired', req.lang || 'es') });
    }
    
    // Obtener información del archivo
    const file = await fileService.getFileById(tokenData.fileId);
    if (!file) {
      return res.status(404).json({ message: t('documentFile.file_not_found', req.lang || 'es') });
    }
    
    const basePath = process.env.FILE_SERVER_ROOT || '/var/www/html';
    const filePath = path.join(basePath, file.path);
    
    // Verificar que el archivo existe físicamente
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo no encontrado en el servidor' });
    }

    // Verificar que la ruta es segura
    if (!validateFilePath(file.path, basePath)) {
      return res.status(403).json({ message: t('documentFile.access_denied', req.lang || 'es') });
    }

    // Establecer headers para visualización (no descarga)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + file.name + '.pdf"');
    
    // Enviar el archivo
    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error(`Error enviando archivo ${tokenData.fileId}: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ message: t('documentFile.load_file_error', req.lang || 'es') });
        }
      }
    });

  } catch (error) {
    logger.error(`Error en tempViewFile ${token}: ${error.message}`);
    res.status(500).json({ message: t('documentFile.view_file_error', req.lang || 'es') });
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
      return res.status(401).json({ message: t('documentFile.token_required', req.lang || 'es') });
    }
    
    // Verificar token JWT
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Obtener información del archivo
    const file = await fileService.getFileById(id);
    if (!file) {
      return res.status(404).json({ message: t('documentFile.file_not_found', req.lang || 'es') });
    }

    // Verificar que el usuario tenga acceso al archivo
    const userId = decoded.id;
    const userRole = String(decoded.role || '').toLowerCase();
    const userRoleId = Number(decoded.roleId || decoded.role_id || 0);

    // Si es admin, puede acceder a todos los archivos
    if (userRole !== 'admin' && userRoleId !== 1) {
      if (userRole === 'seller' || userRoleId === 3) {
        const customerService = container.resolve('customerService');
        const customerRut = file?.customer_rut || file?.customerRut || file?.rut || null;
        const allowed = customerRut
          ? await customerService.sellerHasAccessToCustomerRut(decoded.rut, customerRut)
          : false;
        if (!allowed) {
          logger.warn(`[viewWithToken] acceso denegado seller=${decoded.rut || 'N/A'} fileId=${id} customerRut=${customerRut || 'N/A'}`);
          return res.status(403).json({ message: t('documentFile.no_permission', req.lang || 'es') });
        }
      } else {
        // Cliente: verificar que el archivo pertenece a su RUT
        const userCustomer = await documentFileService.getUserCustomerByUserId(userId);

        if (!userCustomer) {
          return res.status(403).json({ message: t('documentFile.no_permission', req.lang || 'es') });
        }

        const customerCheck = await documentFileService.getFileCustomerCheck(id, userCustomer.rut);

        if (!customerCheck) {
          return res.status(403).json({ message: t('documentFile.no_permission', req.lang || 'es') });
        }
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
      return res.status(403).json({ message: t('documentFile.access_denied', req.lang || 'es') });
    }

    // Establecer headers para visualización (no descarga)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + file.name + '.pdf"');
    
    // Enviar el archivo
    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error(`Error enviando archivo ${id}: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ message: t('documentFile.load_file_error', req.lang || 'es') });
        }
      }
    });

  } catch (error) {
    logger.error(`Error en viewWithToken ${id}: ${error.message}`);
    res.status(500).json({ message: t('documentFile.view_file_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('documentFile.file_not_found', req.lang || 'es') });
    }

    // Verificar que el usuario tenga acceso al archivo
    // Obtener información del usuario autenticado
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Si es admin, puede acceder a todos los archivos
    if (userRole !== 'admin') {
      // Verificar que el archivo pertenece a un cliente del usuario
      // La relación es: users.rut = clientes en SQL (jor_imp_CLI_01_softkey.Rut)
      const customerCheck = await documentFileService.getCustomerCheckForDownload(id, userId);
      
      if (!customerCheck) {
        logger.warn(`Usuario ${userId} intentó acceder a archivo ${id} sin permisos`);
        return res.status(403).json({ message: t('documentFile.no_permission', req.lang || 'es') });
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
      return res.status(403).json({ message: t('documentFile.access_denied', req.lang || 'es') });
    }

    // Establecer headers para la descarga
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // Enviar el archivo
    res.sendFile(filePath, (err) => {
      if (err) {
        logger.error(`Error enviando archivo ${id}: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ message: t('documentFile.load_file_error', req.lang || 'es') });
        }
      }
    });

  } catch (error) {
    logger.error(`Error en downloadFile ${id}: ${error.message}`);
    res.status(500).json({ message: t('documentFile.view_file_error', req.lang || 'es') });
  }
};

/**
 * @route GET /api/files/:customerRut?f=folderId
 * @desc Obtiene todos los archivos de una carpeta específica de un cliente dado su RUT
 * @access Protegido (requiere JWT)
 */
exports.getFilesByCustomerAndFolder = async (req, res) => {
  const { customerRut } = req.params;
  const pc = req.query.pc;
  const factura = req.query.factura || null;
  const idNroOvMasFactura = req.query.idov || req.query.idNroOvMasFactura || null;

  try {
    const user = req.user || {};
    const normalizeRutKey = normalizeRut;
    const userRole = String(user.role || '').toLowerCase();
    if (userRole === 'seller' || user.role_id === 3) {
      const allowed = await customerService.sellerHasAccessToCustomerRut(user.rut, customerRut);
      if (!allowed) {
        logger.warn(`[getFilesByCustomerAndFolder] acceso denegado seller=${user.rut || 'N/A'} rut=${customerRut}`);
        return res.status(403).json({ message: 'Acceso denegado' });
      }
    } else if (userRole === 'client' || user.role_id === 2) {
      if (normalizeRutKey(user.rut) !== normalizeRutKey(customerRut)) {
        logger.warn(`[getFilesByCustomerAndFolder] acceso denegado client=${user.rut || 'N/A'} rut=${customerRut}`);
        return res.status(403).json({ message: 'Acceso denegado' });
      }
    }
    const customer = await documentFileService.getCustomerByRut(customerRut);

    if (!customer) {
      logger.warn(`Cliente no encontrado RUT: ${customerRut}`);
      return res.status(404).json({ message: t('documentFile.customer_not_found', req.lang || 'es') });
    }

    if (!pc) {
      return res.status(400).json({ message: t('documentFile.pc_required', req.lang || 'es') });
    }

    logger.info(`[getFilesByCustomerAndFolder] Fetching files: pc=${pc} factura=${factura || 'NULL'}`);
    const files = await fileService.getFilesByPc(pc, factura);
    logger.info(`[getFilesByCustomerAndFolder] Found ${files.length} files`);
    res.json(files);
  } catch (err) {
    logger.error(`Error al obtener archivos: ${err.message}`);
    res.status(500).json({ message: t('errors.internal_server_error', req.lang || 'es') });
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

  if (!name || !id) return res.status(400).json({ message: t('documentFile.missing_data', req.lang || 'es') });

  try {
    const result = await fileService.RenameFile(id, name, visible);
    if (result.affectedRows === 0) return res.status(404).json({ message: t('documentFile.file_not_found', req.lang || 'es') });
    res.json({ success: true, name });
  } catch (err) {
    logger.error(`[DocumentFileController][RenameFile] Error: ${err.message}`);
    res.status(500).json({ message: t('documentFile.rename_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('documentFile.file_not_found', req.lang || 'es') });
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

    logger.info(`[generateFile] source=manual Archivo generado pc=${file.pc || 'N/A'} oc=${file.oc || 'N/A'} factura=${file.factura ?? 'N/A'} name=${fileName}`);
    await logDocEvent({
      source: 'manual',
      action: 'generate_pdf',
      process: 'generateFile',
      fileId: file.id,
      docType: documentName,
      pc: file.pc,
      oc: file.oc,
      factura: file.factura,
      customerRut: file.customer_rut || file.rut || null,
      userId: req.user?.id || null,
      status: 'ok'
    });
    return res.json({ message: t('documentFile.file_generated', req.lang || 'es'), path: updateData.path });

  } catch (error) {
    logger.error(`Error al generar archivo: ${error.message}`);
    return res.status(500).json({ message: t('documentFile.generate_file_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('documentFile.file_not_found', req.lang || 'es') });
    }
    logger.info(`[sendFile] source=manual file loaded id=${id} pc=${file.pc || 'N/A'} oc=${file.oc || 'N/A'} rut=${file.customer_rut || 'N/A'}`);

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

    logger.info(`[sendFile] source=manual Archivo enviado pc=${file.pc || 'N/A'} oc=${file.oc || 'N/A'} factura=${file.factura ?? 'N/A'} id=${file.id_nro_ov_mas_factura || 'N/A'} name=${file.name || 'N/A'}`);
    await logDocEvent({
      source: 'manual',
      action: 'send_email',
      process: 'sendFile',
      fileId: file.id,
      docType: file.name,
      pc: file.pc,
      oc: file.oc,
      factura: file.factura,
      customerRut: file.customer_rut || file.rut || null,
      userId: req.user?.id || null,
      status: 'ok'
    });
    res.json({ message: t('documentFile.document_sent', req.lang || 'es') });
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
        message: t('documentFile.no_email_configured', req.lang || 'es'),
        error: 'NO_EMAIL_CONFIGURED'
      });
    }
    
    res.status(500).json({ message: t('documentFile.send_file_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('documentFile.file_not_found_db', req.lang || 'es') });
    }
    
    if (typeof file.path === 'string' && file.path.trim()) {
      const fullPath = path.join(process.env.FILE_SERVER_ROOT || '/var/www/html', file.path);
      if (fs.existsSync(fullPath)) {
        const stat = fs.lstatSync(fullPath);
        if (stat.isFile()) {
          fs.unlinkSync(fullPath);
          logger.info(`Archivo físico eliminado: ${fullPath}`);
        } else {
          logger.warn(`Ruta no es archivo, se omite eliminación física: ${fullPath}`);
        }
      }
    }
    await fileService.deleteFileById(file.id);
    
    // Registrar evento en document_events
    await logDocEvent({
      source: 'manual',
      action: 'delete_record',
      process: 'deleteFileById',
      fileId: file.id,
      docType: file.name,
      pc: file.pc,
      oc: file.oc,
      factura: file.factura,
      customerRut: file.customerRut,
      userId: req.user?.id || null,
      status: 'ok'
    });
    
    logger.info(`[deleteFile] Archivo eliminado pc=${file.pc || 'N/A'} oc=${file.oc || 'N/A'} factura=${file.factura ?? 'N/A'} name=${file.name || 'N/A'}`);
    res.json({ message: `${t('documentFile.file_deleted', req.lang || 'es')} ${file.name}` });
  } catch (error) {
    logger.error(`Error al eliminar archivo: ${error.message}`);
    
    // Registrar evento de error en document_events
    await logDocEvent({
      source: 'manual',
      action: 'delete_record',
      process: 'deleteFileById',
      fileId: id,
      docType: null,
      pc: null,
      oc: null,
      factura: null,
      customerRut: null,
      userId: req.user?.id || null,
      status: 'error',
      message: error.message
    });
    
    res.status(500).json({ message: t('documentFile.delete_file_error', req.lang || 'es'), error: error.message });
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
      return res.status(404).json({ message: t('documentFile.file_not_found', req.lang || 'es') });
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
    await logDocEvent({
      source: 'manual',
      action: 'regenerate_pdf',
      process: 'regenerateFile',
      fileId: newFileId,
      docType: documentName,
      pc: file.pc,
      oc: file.oc,
      factura: file.factura,
      customerRut: file.customer_rut || file.rut || null,
      userId: req.user?.id || null,
      status: 'ok'
    });
    res.json({
      message: t('documentFile.document_regenerated', req.lang || 'es'),
      fileName: fileName,
      filePath: path.relative(FILE_SERVER_ROOT, filePath),
      newFileId: newFileId
    });
  } catch (err) {
    logger.error(`Error al regenerar archivo: ${err.message}`);
    res.status(500).json({ message: t('documentFile.regenerate_error', req.lang || 'es') });
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
      await logDocEvent({
        source: 'manual',
        action: 'resend_email',
        process: 'resendFile',
        fileId: file.id,
        docType: file.name,
        pc: file.pc,
        oc: file.oc,
        factura: file.factura,
        customerRut: file.customer_rut || file.rut || null,
        userId: req.user?.id || null,
        status: 'ok'
      });
      res.json({ message: t('documentFile.document_resent', req.lang || 'es') });
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

    res.status(500).json({ message: t('documentFile.resend_error', req.lang || 'es') });
  }
};

/**
 * @route POST /api/files/create-default/:orderId?
 * @desc Crea archivos por defecto para una orden específica
 * @access Protegido (requiere JWT)
 */
exports.createDefaultFiles = async (req, res) => {
  const { orderId } = req.params;
  const { pc, oc, factura, idNroOvMasFactura } = req.body || {};
  let logPc = pc || 'N/A';
  let logOc = oc || 'N/A';
  let logFactura = factura || null;
  let logCustomerRut = null;

  try {
    logger.info(`[createDefaultFiles] source=manual params orderId=${orderId || 'N/A'} body pc=${pc || 'N/A'} oc=${oc || 'N/A'} factura=${factura || 'N/A'} idNroOvMasFactura=${idNroOvMasFactura || 'N/A'}`);
    let result;
    const shipmentIncoterms = new Set(['CFR', 'CIF', 'CIP', 'DAP', 'DDP', 'CPT']);
    const availabilityIncoterms = new Set([
      'EWX',
      'FCA',
      'FOB',
      'FCA PORT',
      'FCA WAREHOUSE SANTIAGO',
      'FCA AIRPORT',
      'FCAWSTGO'
    ]);
    const isInList = (list, value) => list.has(String(value || '').trim().toUpperCase());
    const hasFacturaValue = (value) => (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      value !== 0 &&
      value !== '0'
    );
    const canCreateShipment = (orderMeta, facturaValue) => {
      if (!hasFacturaValue(facturaValue)) return false;
      const incoterm = orderMeta?.incoterm;
      const etd = orderMeta?.fecha_etd_factura;
      const eta = orderMeta?.fecha_eta_factura;
      const result = isInList(shipmentIncoterms, incoterm) && !!etd && !!eta;
      // DEBUG: Log para depurar
      logger.info(`[canCreateShipment] incoterm="${incoterm}" etd="${etd}" eta="${eta}" result=${result}`);
      return result;
    };
    const canCreateDelivery = (orderMeta, facturaValue) => {
      if (!hasFacturaValue(facturaValue)) return false;
      const eta = orderMeta?.fecha_eta_factura;
      const result = !!eta;
      // DEBUG: Log para depurar
      logger.info(`[canCreateDelivery] eta="${eta}" result=${result}`);
      return result;
    };
    const canCreateAvailability = (orderMeta, facturaValue) => {
      if (!hasFacturaValue(facturaValue)) return false;
      const incoterm = orderMeta?.incoterm;
      const result = isInList(availabilityIncoterms, incoterm);
      // DEBUG: Log para depurar el problema de Availability Notice
      logger.info(`[canCreateAvailability] incoterm="${incoterm}" isInList=${result} availabilityIncoterms=${Array.from(availabilityIncoterms).join(',')}`);
      return result;
    };

    if (orderId) {
      const order = await documentFileService.getOrderWithCustomerForDefaultFiles(
        orderId,
        idNroOvMasFactura || null
      );

      if (!order) {
        logger.warn(`Orden no encontrada ID: ${orderId}`);
        return res.status(404).json({ message: t('documentFile.order_not_found', req.lang || 'es') });
      }

      const orderMeta = idNroOvMasFactura
        ? await orderService.getOrderByPcId(order.pc, idNroOvMasFactura)
        : await orderService.getOrderByPcOc(order.pc, order.oc);
      const facturaValue = orderMeta?.factura ?? order.factura;
      
      // DEBUG: Log para ver qué incoterm tiene orderMeta
      logger.info(`[createDefaultFiles] DEBUG orderMeta.incoterm="${orderMeta?.incoterm}" facturaValue="${facturaValue}"`);
      
      const allowedDocs = [];
      if (!hasFacturaValue(facturaValue)) {
        allowedDocs.push('Order Receipt Notice');
      } else {
        if (canCreateShipment(orderMeta, facturaValue)) allowedDocs.push('Shipment Notice');
        if (canCreateDelivery(orderMeta, facturaValue)) allowedDocs.push('Order Delivery Notice');
        if (canCreateAvailability(orderMeta, facturaValue)) allowedDocs.push('Availability Notice');
      }
      
      logger.info(`[createDefaultFiles] DEBUG allowedDocs=${allowedDocs.join(', ')}`);

      result = await fileService.createDefaultFilesForPcOc(
        order.pc,
        order.oc,
        order.customer_name || 'Cliente',
        order.factura,
        allowedDocs  // Pasar allowedDocs correctamente
      );
      logPc = order.pc || logPc;
      logOc = order.oc || logOc;
      logFactura = order.factura;
      logCustomerRut = order.customer_rut;
    } else {
      if (!pc) {
        return res.status(400).json({ message: t('documentFile.pc_required', req.lang || 'es') });
      }

      let resolvedOc = oc;
      let orderData = null;
      
      // Si viene factura en el body, obtener los datos completos de la orden desde SQL Server
      if (factura !== undefined && factura !== null) {
        // Normalizar factura para la consulta
        const normalizedFactura = factura !== null && factura !== undefined && factura !== '' && factura !== 0 && factura !== '0'
          ? String(factura).trim()
          : null;
        
        // Obtener datos completos de la orden desde SQL Server (incluyendo incoterm, ETD, ETA)
        const sqlPool = await getSqlPool();
        const request = sqlPool.request();
        request.input('pc', sql.VarChar, String(pc).trim());
        
        let orderQuery;
        if (normalizedFactura) {
          request.input('factura', sql.VarChar, normalizedFactura);
          orderQuery = `
            SELECT TOP 1 
              h.Nro as pc,
              h.OC as oc,
              f.Factura as factura,
              h.Clausula as incoterm,
              c.Nombre as customer_name,
              c.Rut as rut,
              f.ETD_ENC_FA as fecha_etd_factura,
              f.ETA_ENC_FA as fecha_eta_factura
            FROM jor_imp_HDR_90_softkey h
            INNER JOIN jor_imp_CLI_01_softkey c ON h.Rut = c.Rut
            INNER JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
            WHERE h.Nro = @pc AND f.Factura = @factura
          `;
        } else {
          orderQuery = `
            SELECT TOP 1 
              h.Nro as pc,
              h.OC as oc,
              NULL as factura,
              h.Clausula as incoterm,
              c.Nombre as customer_name,
              c.Rut as rut,
              NULL as fecha_etd_factura,
              NULL as fecha_eta_factura
            FROM jor_imp_HDR_90_softkey h
            INNER JOIN jor_imp_CLI_01_softkey c ON h.Rut = c.Rut
            WHERE h.Nro = @pc
          `;
        }
        
        logger.info(`[createDefaultFiles] SQL SERVER QUERY: ${orderQuery.replace(/\s+/g, ' ')} | PARAMS: pc=${pc}, factura=${normalizedFactura || 'NULL'}`);
        const orderResult = await request.query(orderQuery);
        orderData = orderResult.recordset?.[0];
        logger.info(`[createDefaultFiles] SQL SERVER RESULT: ${JSON.stringify(orderData)}`);
        
        if (!orderData) {
          logger.warn(`Orden no encontrada para PC: ${pc}, Factura: ${factura}`);
          return res.status(404).json({ message: t('documentFile.order_not_found', req.lang || 'es') });
        }
        
        resolvedOc = orderData.oc || oc || '';
      } else if (idNroOvMasFactura) {
        orderData = await orderService.getOrderByPcId(pc, idNroOvMasFactura);
        resolvedOc = orderData?.oc || resolvedOc || '';
      } else if (!resolvedOc) {
        orderData = await orderService.getOrderByPc(pc);
        resolvedOc = orderData?.oc || '';
      } else {
        orderData = await orderService.getOrderByPcOc(pc, resolvedOc);
      }

      if (!orderData) {
        logger.warn(`Orden no encontrada PC/OC: ${pc} / ${resolvedOc || 'N/A'}`);
        return res.status(404).json({ message: t('documentFile.order_not_found', req.lang || 'es') });
      }

      // Usar factura del body si se proporciona, sino usar la de orderData
      const facturaValue = factura !== undefined ? factura : orderData?.factura;
      const allowedDocs = [];
      if (!hasFacturaValue(facturaValue)) {
        allowedDocs.push('Order Receipt Notice');
      } else {
        if (canCreateShipment(orderData, facturaValue)) allowedDocs.push('Shipment Notice');
        if (canCreateDelivery(orderData, facturaValue)) allowedDocs.push('Order Delivery Notice');
        if (canCreateAvailability(orderData, facturaValue)) allowedDocs.push('Availability Notice');
      }

      result = await fileService.createDefaultFilesForPcOc(
        orderData.pc,
        orderData.oc,
        orderData.customer_name || 'Cliente',
        facturaValue,  // Usar facturaValue en lugar de orderData.factura
        allowedDocs  // Pasar allowedDocs correctamente
      );
      logPc = orderData.pc || logPc;
      logOc = orderData.oc || logOc;
      logFactura = facturaValue;
      logCustomerRut = orderData.rut;
    }

    const createdNames = Array.isArray(result.files)
      ? result.files.map(file => file?.name).filter(Boolean).join(', ')
      : '';
    logger.info(`[createDefaultFiles] source=manual Archivos por defecto creados: orderId=${orderId || 'N/A'} pc=${logPc} oc=${logOc} files=${result.filesCreated}${createdNames ? ` names=${createdNames}` : ''}`);
    if (Array.isArray(result.files)) {
      for (const created of result.files) {
        await logDocEvent({
          source: 'manual',
          action: 'create_record',
          process: 'createDefaultFiles',
          fileId: created.id,
          docType: created.name,
          pc: logPc !== 'N/A' ? logPc : pc,
          oc: logOc !== 'N/A' ? logOc : oc,
          factura: logFactura,
          customerRut: logCustomerRut,
          userId: req.user?.id || null,
          status: 'ok'
        });
      }
    }
    res.status(201).json(result);

  } catch (error) {
    logger.error(`[createDefaultFiles] Error creando archivos por defecto orderId=${orderId || 'N/A'} pc=${logPc} oc=${logOc} id=${idNroOvMasFactura || 'N/A'}: ${error.message}`);
    
    if (error.code === 'NO_DOCUMENTS_ALLOWED') {
      // Debug logging para diagnosticar problemas de idioma
      if (process.env.LOG_LANGUAGE_DEBUG === 'true') {
        logger.info(`[createDefaultFiles] NO_DOCUMENTS_ALLOWED req.lang=${req.lang || 'N/A'} Accept-Language=${req.headers['accept-language'] || 'N/A'}`);
      }
      
      // Registrar evento en document_events
      await logDocEvent({
        source: 'manual',
        action: 'create_record',
        process: 'createDefaultFiles',
        fileId: null,
        docType: 'default_files',
        pc: logPc !== 'N/A' ? logPc : pc,
        oc: logOc !== 'N/A' ? logOc : oc,
        factura: error.details?.factura || logFactura,
        customerRut: logCustomerRut,
        userId: req.user?.id || null,
        status: 'error',
        message: 'No documents can be created: missing ETD/ETA dates or invalid Incoterm'
      });
      
      return res.status(error.status || 400).json({
        code: 'NO_DOCUMENTS_ALLOWED',
        message: t('documentFile.no_documents_allowed', req.lang || 'es')
      });
    }
    
    if (error.code === 'FILES_ALREADY_EXIST') {
      return res.status(error.status || 409).json({
        code: 'FILES_ALREADY_EXIST',
        message: t('documentFile.files_already_exist', req.lang || 'es')
      });
    }
    res.status(500).json({ 
      message: t('documentFile.create_default_files_error', req.lang || 'es'), 
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
    } = checkOrderReceptionService;
    const fs = require('fs');
    const path = require('path');

    const automaticReceptionEnabled = await isSendOrderReceptionEnabled();
    const sendFromDate = await getSendFromDate('sendAutomaticOrderReception');
    const { pc, factura } = req.body || {};
    logger.info(`[processOrderReception] start enabled=${automaticReceptionEnabled} from=${sendFromDate || 'N/A'} pc=${pc || 'N/A'} factura=${factura || 'N/A'}`);

    const orders = await getOrdersReadyForOrderReceiptNotice(sendFromDate, pc, factura);

    if (orders.length === 0) {
      return res.status(200).json({
        message: t('documentFile.no_new_orders', req.lang || 'es'),
        processed: 0
      });
    }

    let processed = 0;
    let errors = 0;
    let skipped = 0;

    for (const orderRow of orders) {
      try {
        // Ya no necesitamos crear el archivo porque viene de order_files con status_id = 2
        // El archivo ya fue creado por checkDefaultFiles y el PDF generado por generatePDFs

        const { reportEmails, customerLang } = await getReportEmailsAndLang(orderRow.customer_rut);

        if (reportEmails.length === 0) {
          logger.error(`[processOrderReception] No se encontraron emails reports=true para cliente ${orderRow.customer_rut}`);
          errors++;
          continue;
        }

        const file = await fileService.getFileById(orderRow.receipt_file_id);
        if (!file) {
          logger.error(`[processOrderReception] No se encontró archivo id=${orderRow.receipt_file_id} pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'}`);
          errors++;
          continue;
        }

        // Verificar que el PDF ya esté generado
        if (file.status_id !== 2) {
          logger.warn(`[processOrderReception] Archivo no tiene PDF generado (status_id=${file.status_id}) pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'}`);
          skipped++;
          continue;
        }

        const fileData = {
          id: file.id,
          name: file.name,
          path: file.path,
          pc: orderRow.pc,
          oc: orderRow.oc,
          rut: orderRow.customer_rut,
          customer_name: file.customer_name,
          customer_id: file.customer_id,
          lang: customerLang
        };

        if (automaticReceptionEnabled) {
          await emailService.sendFileToClient(fileData, { recipients: reportEmails });

          // Solo actualizar si el email se envió exitosamente
          await fileService.updateFile({
            id: file.id,
            status_id: 3,
            was_sent: 1,
            fecha_envio: new Date(),
            updated_at: new Date()
          });

          logger.info(`[processOrderReception] Email enviado pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} factura=${file.factura || 'N/A'} doc=Order Receipt Notice recipients=${reportEmails.length}`);
          await logDocEvent({
            source: 'cron',
            action: 'send_email',
            process: 'processOrderReception',
            fileId: file.id,
            docType: 'Order Receipt Notice',
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            status: 'ok'
          });
          processed++;
        } else {
          logger.info(`[processOrderReception] Email omitido (deshabilitado) pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} factura=${file.factura || 'N/A'} doc=Order Receipt Notice`);
          await logDocEvent({
            source: 'cron',
            action: 'send_email',
            process: 'processOrderReception',
            fileId: file.id,
            docType: 'Order Receipt Notice',
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            status: 'skip',
            message: 'disabled_config'
          });
          skipped++;
        }
      } catch (error) {
        logger.error(`[processOrderReception] Error procesando orden pc=${orderRow.pc}: ${error.message}`);
        
        // Registrar evento de error
        await logDocEvent({
          source: 'cron',
          action: 'send_email',
          process: 'processOrderReception',
          fileId: orderRow.receipt_file_id || null,
          docType: 'Order Receipt Notice',
          pc: orderRow.pc,
          oc: orderRow.oc,
          factura: orderRow.factura,
          customerRut: orderRow.customer_rut || null,
          userId: null,
          status: 'error',
          message: error.message
        });
        
        errors++;
      }
    }

    logger.info(`[processOrderReception] done processed=${processed} errors=${errors} skipped=${skipped} total=${orders.length}`);
    res.status(200).json({
      message: t('documentFile.processing_complete', req.lang || 'es'),
      processed,
      errors,
      skipped,
      total: orders.length
    });

  } catch (error) {
    logger.error(`[processOrderReception] Error: ${error.message}`);
    res.status(500).json({
      message: t('documentFile.processing_error', req.lang || 'es'),
      error: error.message
    });
  }
};

exports.processShipmentNotices = async (req, res) => {
  try {
    const {
      getOrdersReadyForShipmentNotice,
      getShipmentFile
    } = checkShipmentNoticeService;
    const {
      getReportEmailsAndLang,
      isSendOrderShipmentEnabled,
      getSendFromDate
    } = checkOrderReceptionService;
    const fs = require('fs');
    const path = require('path');

      const automaticReceptionEnabled = await isSendOrderShipmentEnabled();
      const sendFromDate = await getSendFromDate('sendAutomaticOrderShipment');
      const { pc, factura } = req.body || {};
      logger.info(`[processShipmentNotices] start enabled=${automaticReceptionEnabled} from=${sendFromDate || 'N/A'} pc=${pc || 'N/A'} factura=${factura || 'N/A'}`);

      const orders = await getOrdersReadyForShipmentNotice(sendFromDate, pc, factura);
    if (!orders.length) {
      return res.status(200).json({
        message: t('documentFile.no_orders_ready_shipment', req.lang || 'es'),
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
            logger.info(`[processShipmentNotices] Archivo creado automático pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} doc=Shipment Notice`);
            await logDocEvent({
              source: 'cron',
              action: 'create_record',
              process: 'processShipmentNotices',
              fileId: null,
              docType: 'Shipment Notice',
              pc: orderRow.pc,
              oc: orderRow.oc,
              factura: orderRow.factura,
              customerRut: orderRow.customer_rut || null,
              status: 'ok'
            });
          } catch (fileError) {
            if (fileError.code !== 'FILES_ALREADY_EXIST' && fileError.message !== 'FILES_ALREADY_EXIST') {
              throw fileError;
            }
          }
        }

          const shipmentFile = await getShipmentFile(orderRow.pc, orderRow.oc);
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

        const { reportEmails, customerLang } = await getReportEmailsAndLang(orderRow.customer_rut);
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
          logger.info(`[processShipmentNotices] PDF generado pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} factura=${file.factura || 'N/A'} id=${file.id_nro_ov_mas_factura || 'N/A'} doc=${documentName}`);
          await logDocEvent({
            source: 'cron',
            action: 'generate_pdf',
            process: 'processShipmentNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            status: 'ok'
          });
        } catch (pdfError) {
          logger.error(`[processShipmentNotices] Error generando PDF pc=${orderRow.pc}: ${pdfError.message}`);
          
          // Registrar evento de error
          await logDocEvent({
            source: 'cron',
            action: 'generate_pdf',
            process: 'processShipmentNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            userId: null,
            status: 'error',
            message: pdfError.message
          });
          
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
          await emailService.sendFileToClient(fileData, { recipients: reportEmails });
          await fileService.updateFile({
            id: file.id,
            fecha_envio: new Date(),
            updated_at: new Date()
          });
          logger.info(`[processShipmentNotices] Email enviado pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} factura=${file.factura || 'N/A'} doc=${documentName} recipients=${reportEmails.length}`);
          await logDocEvent({
            source: 'cron',
            action: 'send_email',
            process: 'processShipmentNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            idNroOvMasFactura: file.id_nro_ov_mas_factura,
            customerRut: orderRow.customer_rut || null,
            status: 'ok'
          });
          processed++;
        } else {
          logger.info(`[processShipmentNotices] Email omitido (deshabilitado) pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} factura=${file.factura || 'N/A'} doc=${documentName}`);
          await logDocEvent({
            source: 'cron',
            action: 'send_email',
            process: 'processShipmentNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            status: 'skip',
            message: 'disabled_config'
          });
          skipReasons.disabled_config++;
          skipped++;
        }
      } catch (error) {
        logger.error(`[processShipmentNotices] Error procesando orden ${orderRow.id}: ${error.message}`);
        
        // Registrar evento de error
        await logDocEvent({
          source: 'cron',
          action: 'generate_pdf',
          process: 'processShipmentNotices',
          fileId: orderRow.shipment_file_id || null,
          docType: 'Shipment Notice',
          pc: orderRow.pc,
          oc: orderRow.oc,
          factura: orderRow.factura,
          customerRut: orderRow.customer_rut || null,
          userId: null,
          status: 'error',
          message: error.message
        });
        
        errors++;
      }
    }

    logger.info(`[processShipmentNotices] done processed=${processed} skipped=${skipped} errors=${errors}`);
    res.status(200).json({
      message: t('documentFile.shipment_processing_complete', req.lang || 'es'),
      processed,
      skipped,
      errors
    });
  } catch (error) {
    logger.error(`Error en processShipmentNotices: ${error.message}`);
    res.status(500).json({ message: t('documentFile.shipment_processing_error', req.lang || 'es') });
  }
};

exports.processOrderDeliveryNotices = async (req, res) => {
  try {
    const {
      getOrdersReadyForOrderDeliveryNotice,
      getOrderDeliveryFile
    } = checkOrderDeliveryNoticeService;
    const {
      getReportEmailsAndLang,
      isSendOrderDeliveryEnabled,
      getSendFromDate
    } = checkOrderReceptionService;
    const fs = require('fs');
    const path = require('path');

    const automaticReceptionEnabled = await isSendOrderDeliveryEnabled();
    const sendFromDate = await getSendFromDate('sendAutomaticOrderDelivery');
    const { pc, factura, idNroOvMasFactura } = req.body || {};
    logger.info(`[processOrderDeliveryNotices] start enabled=${automaticReceptionEnabled} from=${sendFromDate || 'N/A'} pc=${pc || 'N/A'} factura=${factura || 'N/A'} id=${idNroOvMasFactura || 'N/A'}`);

    const orders = await getOrdersReadyForOrderDeliveryNotice(
      sendFromDate,
      pc,
      factura,
      idNroOvMasFactura
    );
    if (!orders.length) {
      return res.status(200).json({
        message: t('documentFile.no_orders_ready_delivery', req.lang || 'es'),
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
          logger.warn(`[processOrderDeliveryNotices] Omitida: orden ${orderRow.id} sin ETA`);
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
            logger.info(`[processOrderDeliveryNotices] Archivo creado automático pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} doc=Order Delivery Notice`);
            await logDocEvent({
              source: 'cron',
              action: 'create_record',
              process: 'processOrderDeliveryNotices',
              fileId: null,
              docType: 'Order Delivery Notice',
              pc: orderRow.pc,
              oc: orderRow.oc,
              factura: orderRow.factura,
              customerRut: orderRow.customer_rut || null,
              status: 'ok'
            });
          } catch (fileError) {
            if (fileError.code !== 'FILES_ALREADY_EXIST' && fileError.message !== 'FILES_ALREADY_EXIST') {
              throw fileError;
            }
          }
        }

        const deliveryFile = await getOrderDeliveryFile(orderRow.pc, orderRow.oc);
        if (!deliveryFile) {
          logger.error(`[processOrderDeliveryNotices] Sin archivo: orden ${orderRow.id}`);
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
          logger.error(`[processOrderDeliveryNotices] File no encontrado: order_file ${deliveryFile.id} orden ${orderRow.id}`);
          errors++;
          continue;
        }

          const { reportEmails, customerLang } = await getReportEmailsAndLang(orderRow.customer_rut);
        if (reportEmails.length === 0) {
          logger.warn(`[processOrderDeliveryNotices] Sin emails report: cliente ${orderRow.customer_rut} orden ${orderRow.id}`);
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
          logger.info(`[processOrderDeliveryNotices] PDF generado pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} factura=${file.factura || 'N/A'} id=${file.id_nro_ov_mas_factura || 'N/A'} doc=${documentName}`);
          await logDocEvent({
            source: 'cron',
            action: 'generate_pdf',
            process: 'processOrderDeliveryNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            idNroOvMasFactura: file.id_nro_ov_mas_factura,
            customerRut: orderRow.customer_rut || null,
            status: 'ok'
          });
        } catch (pdfError) {
          logger.error(`[processOrderDeliveryNotices] Error generando PDF orden ${orderRow.id}: ${pdfError.message}`);
          
          // Registrar evento de error
          await logDocEvent({
            source: 'cron',
            action: 'generate_pdf',
            process: 'processOrderDeliveryNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            userId: null,
            status: 'error',
            message: pdfError.message
          });
          
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
          await emailService.sendFileToClient(fileData, { recipients: reportEmails });
          await fileService.updateFile({
            id: file.id,
            fecha_envio: new Date(),
            updated_at: new Date()
          });
          await logDocEvent({
            source: 'cron',
            action: 'send_email',
            process: 'processOrderDeliveryNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            status: 'ok'
          });
          processed++;
        } else {
          await logDocEvent({
            source: 'cron',
            action: 'send_email',
            process: 'processOrderDeliveryNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            status: 'skip',
            message: 'disabled_config'
          });
          skipped++;
        }
      } catch (error) {
        logger.error(`[processOrderDeliveryNotices] Error procesando orden ${orderRow.id}: ${error.message}`);
        
        // Registrar evento de error
        await logDocEvent({
          source: 'cron',
          action: 'generate_pdf',
          process: 'processOrderDeliveryNotices',
          fileId: orderRow.delivery_file_id || null,
          docType: 'Order Delivery Notice',
          pc: orderRow.pc,
          oc: orderRow.oc,
          factura: orderRow.factura,
          customerRut: orderRow.customer_rut || null,
          userId: null,
          status: 'error',
          message: error.message
        });
        
        errors++;
      }
      }

    logger.info(`[processOrderDeliveryNotices] done processed=${processed} skipped=${skipped} errors=${errors}`);
    res.status(200).json({
      message: t('documentFile.delivery_processing_complete', req.lang || 'es'),
      processed,
      skipped,
      errors,
      automatic_enabled: automaticReceptionEnabled,
      skip_reasons: skipReasons
    });
  } catch (error) {
    logger.error(`Error en processOrderDeliveryNotices: ${error.message}`);
    res.status(500).json({ message: t('documentFile.delivery_processing_error', req.lang || 'es') });
  }
};

exports.processAvailabilityNotices = async (req, res) => {
  try {
    const {
      getOrdersReadyForAvailabilityNotice,
      getAvailabilityFile
    } = checkAvailabilityNoticeService;
    const {
      getReportEmailsAndLang,
      isSendOrderAvailabilityEnabled,
      getSendFromDate
    } = checkOrderReceptionService;
    const fs = require('fs');
    const path = require('path');

    const automaticReceptionEnabled = await isSendOrderAvailabilityEnabled();
    const sendFromDate = await getSendFromDate('sendAutomaticOrderAvailability');
    const { pc, factura } = req.body || {};
    logger.info(`[processAvailabilityNotices] start enabled=${automaticReceptionEnabled} from=${sendFromDate || 'N/A'} pc=${pc || 'N/A'} factura=${factura || 'N/A'}`);

    const orders = await getOrdersReadyForAvailabilityNotice(sendFromDate, pc, factura);
    if (!orders.length) {
      return res.status(200).json({
        message: t('documentFile.no_orders_ready_availability', req.lang || 'es'),
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
            logger.info(`[processAvailabilityNotices] Archivo creado automático pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} doc=Availability Notice`);
            await logDocEvent({
              source: 'cron',
              action: 'create_record',
              process: 'processAvailabilityNotices',
              fileId: null,
              docType: 'Availability Notice',
              pc: orderRow.pc,
              oc: orderRow.oc,
              factura: orderRow.factura,
              customerRut: orderRow.customer_rut || null,
              status: 'ok'
            });
          } catch (fileError) {
            if (fileError.code !== 'FILES_ALREADY_EXIST' && fileError.message !== 'FILES_ALREADY_EXIST') {
              throw fileError;
            }
          }
        }

        const availabilityFile = await getAvailabilityFile(orderRow.pc, orderRow.oc);
        if (!availabilityFile) {
          logger.error(`[processAvailabilityNotices] Sin archivo: orden ${orderRow.id}`);
          errors++;
          continue;
        }

        if (availabilityFile.fecha_envio) {
          skipped++;
          continue;
        }

        const file = await fileService.getFileById(availabilityFile.id);
        if (!file) {
          logger.error(`[processAvailabilityNotices] File no encontrado: order_file ${availabilityFile.id} orden ${orderRow.id}`);
          errors++;
          continue;
        }

        const { reportEmails, customerLang } = await getReportEmailsAndLang(orderRow.customer_rut);
        if (reportEmails.length === 0) {
          logger.warn(`[processAvailabilityNotices] Sin emails report: cliente ${orderRow.customer_rut} orden ${orderRow.id}`);
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
          logger.info(`[processAvailabilityNotices] PDF generado pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} factura=${file.factura || 'N/A'} id=${file.id_nro_ov_mas_factura || 'N/A'} doc=${documentName}`);
          await logDocEvent({
            source: 'cron',
            action: 'generate_pdf',
            process: 'processAvailabilityNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            idNroOvMasFactura: file.id_nro_ov_mas_factura,
            customerRut: orderRow.customer_rut || null,
            status: 'ok'
          });
        } catch (pdfError) {
          logger.error(`[processAvailabilityNotices] Error generando PDF orden ${orderRow.id}: ${pdfError.message}`);
          
          // Registrar evento de error
          await logDocEvent({
            source: 'cron',
            action: 'generate_pdf',
            process: 'processAvailabilityNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            userId: null,
            status: 'error',
            message: pdfError.message
          });
          
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
          await emailService.sendFileToClient(fileData, { recipients: reportEmails });
          await fileService.updateFile({
            id: file.id,
            fecha_envio: new Date(),
            updated_at: new Date()
          });
          logger.info(`[processAvailabilityNotices] Email enviado pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} factura=${file.factura || 'N/A'} doc=${documentName} recipients=${reportEmails.length}`);
          await logDocEvent({
            source: 'cron',
            action: 'send_email',
            process: 'processAvailabilityNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            status: 'ok'
          });
          processed++;
        } else {
          logger.info(`[processAvailabilityNotices] Email omitido (deshabilitado) pc=${orderRow.pc} oc=${orderRow.oc || 'N/A'} factura=${file.factura || 'N/A'} id=${file.id_nro_ov_mas_factura || 'N/A'} doc=${documentName}`);
          await logDocEvent({
            source: 'cron',
            action: 'send_email',
            process: 'processAvailabilityNotices',
            fileId: file.id,
            docType: documentName,
            pc: orderRow.pc,
            oc: orderRow.oc,
            factura: file.factura,
            customerRut: orderRow.customer_rut || null,
            status: 'skip',
            message: 'disabled_config'
          });
          skipped++;
        }
      } catch (error) {
        logger.error(`[processAvailabilityNotices] Error procesando orden ${orderRow.id}: ${error.message}`);
        
        // Registrar evento de error
        await logDocEvent({
          source: 'cron',
          action: 'generate_pdf',
          process: 'processAvailabilityNotices',
          fileId: orderRow.availability_file_id || null,
          docType: 'Availability Notice',
          pc: orderRow.pc,
          oc: orderRow.oc,
          factura: orderRow.factura,
          customerRut: orderRow.customer_rut || null,
          userId: null,
          status: 'error',
          message: error.message
        });
        
        errors++;
      }
    }

    logger.info(`[processAvailabilityNotices] done processed=${processed} skipped=${skipped} errors=${errors}`);
    res.status(200).json({
      message: t('documentFile.availability_processing_complete', req.lang || 'es'),
      processed,
      skipped,
      errors
    });
  } catch (error) {
    logger.error(`Error en processAvailabilityNotices: ${error.message}`);
    res.status(500).json({ message: t('documentFile.availability_processing_error', req.lang || 'es') });
  }
};

