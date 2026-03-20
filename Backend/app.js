// Cargar variables de entorno PRIMERO
const dotenv = require('dotenv');
const os = require('os');
const networkInterfaces = os.networkInterfaces();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const swaggerSpec = require('./docs/swagger');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { normalizeRole } = require('./utils/role.util');
const userService = require('./services/user.service');
const customerService = require('./services/customer.service');
const { logger } = require('./utils/logger');
require('module-alias/register');

// Detectar si estamos en el servidor Ubuntu (172.20.10.151)
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

// Detectar si estamos en Docker
const isDocker = process.env.DOCKER_ENV === 'true';

// Cargar archivo de configuración según entorno
if (isDocker) {
  logger.info('[Backend] Entorno detectado: Docker');  
  logger.info(`[Backend] MYSQL_DB_HOST cargado: ${process.env.MYSQL_DB_HOST}`);
  logger.info(`[Backend] MYSQL_DB_USER cargado: ${process.env.MYSQL_DB_USER}`);
} else if (isServer) {
  dotenv.config({ path: './env.server' });
  logger.info('[Backend] Entorno detectado: Servidor Ubuntu (172.20.10.151)');
} else {
  dotenv.config({ path: './.env.local' });
  logger.info('[Backend] Entorno detectado: Desarrollo local');
  logger.info(`[Backend] MYSQL_DB_HOST cargado: ${process.env.MYSQL_DB_HOST}`);
  logger.info(`[Backend] MYSQL_DB_USER cargado: ${process.env.MYSQL_DB_USER}`);
}

// Middlewares
const { createAuthMiddleware } = require('./middleware/auth.middleware');
const { authorizeRoles } = require('./middleware/role.middleware');
const { t, languageMiddleware } = require('./i18n');

// Crear middlewares de autenticación específicos
const authMiddleware = createAuthMiddleware();
const authFromCookie = createAuthMiddleware({ tokenSource: 'cookie' });
const authAllowExpired = createAuthMiddleware({ allowExpired: true });

const app = express();

// Configurar trust proxy ANTES de cualquier middleware
// Esto es necesario cuando hay un proxy reverso (nginx, etc.) delante de Express
// Confiamos en el primer proxy (nginx) que está delante de Express
app.set('trust proxy', 1);

// Rutas API
const customerRoutes = require('./routes/customer.routes');
const userRoutes = require('./routes/user.routes');
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const orderDetailRoutes = require('./routes/orderDetail.routes');
const itemRoutes = require('./routes/item.routes');
const documentDirectoryRoutes = require('./routes/documentDirectory.routes');
const documentFileRoutes = require('./routes/documentFile.routes');
const documentTypeRoutes = require('./routes/documentType.routes');
const chatRoutes = require('./routes/chat.routes');
const cronRoutes = require('./routes/cron.routes');
const cronConfigRoutes = require('./routes/cronConfig.routes');
const monitoringRoutes = require('./routes/monitoring.routes');
const fileserverRoutes = require('./routes/fileserver.routes');
const assetsRoutes = require('./routes/assets.routes');
const configRoutes = require('./routes/config.routes');
const messageRoutes = require('./routes/message.routes');
const vendedorRoutes = require('./routes/vendedor.routes');
const projectionRoutes = require('./routes/projection.routes');


// Configuración de rate limiting
const authLimiter = rateLimit({
  windowMs: 3 * 60 * 1000, // 3 minutos
  max: 100, // máximo 100 requests por ventana
  message: (req) => ({ 
    message: t('rateLimit.too_many_requests', req.lang || 'es', { minutes: 3 })
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

const authSlowDown = slowDown({
  windowMs: 3 * 60 * 1000, // 3 minutos
  delayAfter: 50, // permitir 50 requests sin delay
  delayMs: (used, req) => {
    const delayAfter = req.slowDown.limit;
    return (used - delayAfter) * 500;
  },
});

// Rate limiter estricto para login y 2FA (prevención de fuerza bruta)
const strictAuthLimiter = rateLimit({
  windowMs: 3 * 60 * 1000, // 3 minutos
  max: 5, // máximo 5 intentos de login
  message: (req) => ({ 
    message: t('rateLimit.too_many_auth_attempts', req.lang || 'es', { minutes: 3 })
  }),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar requests exitosos
});

// Rate limiter para APIs de escritura (POST, PUT, DELETE)
const writeLimiter = rateLimit({
  windowMs: 3 * 60 * 1000, // 3 minutos
  max: 200, // máximo 200 operaciones de escritura
  message: (req) => ({ 
    message: t('rateLimit.too_many_write_operations', req.lang || 'es', { minutes: 3 })
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para APIs de lectura (GET)
const readLimiter = rateLimit({
  windowMs: 3 * 60 * 1000, // 3 minutos
  max: 500, // máximo 500 operaciones de lectura
  message: (req) => ({ 
    message: t('rateLimit.too_many_read_requests', req.lang || 'es', { minutes: 3 })
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para file uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // máximo 50 uploads por hora
  message: (req) => ({ 
    message: t('rateLimit.too_many_file_uploads', req.lang || 'es', { minutes: 60 })
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para cron endpoints (interno, más permisivo)
const cronLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100, // máximo 100 ejecuciones por hora
  message: (req) => ({ 
    message: t('rateLimit.too_many_cron_executions', req.lang || 'es', { minutes: 60 })
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

const baseAdminOrigin = process.env.FRONTEND_BASE_URL || 'http://localhost:2121';
const baseClientOrigin = process.env.PUBLIC_CLIENT_FRONTEND_BASE_URL || process.env.PUBLIC_FRONTEND_BASE_URL || 'http://localhost:2122';
const baseSellerOrigin = process.env.PUBLIC_SELLER_FRONTEND_BASE_URL || process.env.PUBLIC_FRONTEND_BASE_URL || 'http://localhost:2123';

const devOrigins = [
  'http://localhost:2121',
  'http://localhost:2122',
  'http://localhost:2123',
  'http://localhost:2124',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://localhost:8082',
  'http://localhost:9615',
];

const extraOrigins = [
  'https://logistic.gelymar.cl',
  'https://logistic.gelymar.cl:3000',
  'https://fileserver.gelymar.cl'
];

const allowedOrigins = [
  baseAdminOrigin,
  baseClientOrigin,
  baseSellerOrigin,
  ...extraOrigins,
  ...(process.env.NODE_ENV === 'production' ? [] : devOrigins),
].filter(Boolean);

// Middlewares de seguridad globales
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/", "https://static.cloudflareinsights.com"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"],
      connectSrc: [
        "'self'", 
        ...allowedOrigins, 
        "http://backend:*", 
        "https://www.google.com/recaptcha/", 
        "ws://localhost:*", 
        "wss://localhost:*", 
        "ws://localhost:3000", 
        "wss://localhost:3000", 
        "https://logistic.gelymar.cl",
        "https://logistic.gelymar.cl:3000",
        "wss://logistic.gelymar.cl:3000",
        "https://cloudflareinsights.cl",
        "https://fileserver.gelymar.cl",
        "wss://fileserver.gelymar.cl",
        "ws://fileserver.gelymar.cl",
      ],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Configuración CORS más restrictiva
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (como Postman, curl, o requests del mismo servidor)
    if (!origin) {
      return callback(null, true);
    }
    
    // Verificar si el origin está en la lista permitida
    if (allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }
    
    // Rechazar cualquier otro origin
    logger.warn(`[CORS] Origen bloqueado: ${origin}`);
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600, // Cache preflight requests por 10 minutos
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Middlewares globales
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(languageMiddleware); // Detectar idioma del request

// Archivos estáticos permitidos
app.use('/swagger-assets', express.static(path.join(__dirname, 'public/swagger-assets')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/favicon.ico', express.static(path.join(__dirname, 'public/favicon.ico')));

// Swagger JSON endpoint
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Swagger UI personalizado
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs/swagger-ui.html'));
});

// Rutas API públicas
app.use('/api/auth', authLimiter, authSlowDown, authRoutes);
app.use('/api/monitoring', readLimiter, monitoringRoutes);
app.use('/api/fileserver', fileserverRoutes);
app.use('/api/assets', readLimiter, assetsRoutes);

// Rutas protegidas (requieren token + rol adecuado)
app.use('/api/customers', authMiddleware, readLimiter, authorizeRoles(['admin', 'seller']), customerRoutes);
app.use('/api/users', authMiddleware, readLimiter, authorizeRoles(['admin', 'client']), userRoutes);
app.use('/api/orders', authMiddleware, readLimiter, authorizeRoles(['admin', 'seller', 'client']), orderRoutes);
app.use('/api/order-detail', authMiddleware, readLimiter, authorizeRoles(['admin', 'client']), orderDetailRoutes);
app.use('/api/items', authMiddleware, readLimiter, authorizeRoles(['admin']), itemRoutes);
app.use('/api/directories', authMiddleware, readLimiter, authorizeRoles(['admin', 'seller', 'client']), documentDirectoryRoutes);
app.use('/api/vendedores', authMiddleware, writeLimiter, authorizeRoles(['admin']), vendedorRoutes);

// Ruta especial para visualización de archivos (acceso para admin y client)
app.use('/api/file-view', readLimiter, documentFileRoutes);

app.use('/api/files', authMiddleware, authorizeRoles(['admin', 'seller', 'client']), documentFileRoutes);
app.use('/api/document-types', authMiddleware, readLimiter, authorizeRoles(['admin', 'seller']), documentTypeRoutes);
app.use('/api/chat', authMiddleware, writeLimiter, chatRoutes);
app.use('/api/projections', authMiddleware, readLimiter, authorizeRoles(['admin', 'seller']), projectionRoutes);

// Ruta especial para procesamiento de órdenes nuevas (sin autenticación para cron)
const {
  processNewOrdersAndSendReception,
  processShipmentNotices,
  processOrderDeliveryNotices,
  processAvailabilityNotices
} = require('./controllers/documentFile.controller');
app.post('/api/cron/process-new-orders', cronLimiter, processNewOrdersAndSendReception);
app.post('/api/cron/process-shipment-notices', cronLimiter, processShipmentNotices);
app.post('/api/cron/process-order-delivery-notices', cronLimiter, processOrderDeliveryNotices);
app.post('/api/cron/process-availability-notices', cronLimiter, processAvailabilityNotices);

// Rutas de cron (sin autenticación para acceso interno)
app.use('/api/cron', cronLimiter, cronRoutes);

// Ruta pública para configuración de recaptcha (sin autenticación)
const { getRecaptchaLoginConfig } = require('./controllers/config.controller');
app.get('/api/config/recaptcha-login', readLimiter, getRecaptchaLoginConfig);

// Rutas de configuración del cron (requieren autenticación de admin)
app.use('/api/cron-config', authMiddleware, writeLimiter, cronConfigRoutes);

// Rutas de configuración general (requieren autenticación de admin)
app.use('/api/config', authMiddleware, writeLimiter, configRoutes);
app.use('/api/messages', authMiddleware, writeLimiter, messageRoutes);

// Respuesta amigable para rutas API inexistentes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint de API no encontrado' });
});


// Sirve archivos estáticos desde la carpeta 'uploads'

// Rutas protegidas del frontend (HTML)
const pathAdmin = path.join(__dirname, 'views-protegidas/admin/index.html');
const pathClient = path.join(__dirname, 'views-protegidas/client/index.html');

app.get('/admin', authFromCookie, (req, res) => {
  if (req.user.role !== 'admin') {
    logger.warn(`[Backend] Acceso denegado a /admin: usuario ${req.user.rut || req.user.email} con rol ${req.user.role}`);
    return res.status(403).send('Acceso no autorizado - Solo administradores');
  }
  res.sendFile(pathAdmin);
});

app.get('/client', authFromCookie, (req, res) => {
  if (req.user.role !== 'client') {
    logger.warn(`[Backend] Acceso denegado a /client: usuario ${req.user.rut || req.user.email} con rol ${req.user.role}`);
    return res.status(403).send('Acceso no autorizado - Solo clientes');
  }
  res.sendFile(pathClient);
});

// 🔐 Middleware para proteger rutas de admin y client
app.use('/admin', authFromCookie, (req, res, next) => {
  if (req.user.role !== 'admin') {
    logger.warn(`[Backend] Acceso denegado a ${req.path}: usuario ${req.user.rut || req.user.email} con rol ${req.user.role}`);
    return res.status(403).send('Acceso no autorizado - Solo administradores');
  }
  next();
});

app.use('/client', authFromCookie, (req, res, next) => {
  if (req.user.role !== 'client') {
    logger.warn(`[Backend] Acceso denegado a ${req.path}: usuario ${req.user.rut || req.user.email} con rol ${req.user.role}`);
    return res.status(403).send('Acceso no autorizado - Solo clientes');
  }
  next();
});

// 🔐 Middleware para rutas de admin y client
app.use('/admin', (req, res, next) => {
  // Si no es la ruta principal /admin, redirigir
  if (req.path !== '/') {
    return res.redirect('/admin');
  }
  next();
});

app.use('/client', (req, res, next) => {
  // Si no es la ruta principal /client, redirigir
  if (req.path !== '/') {
    return res.redirect('/client');
  }
  next();
});

// Página principal (opcional)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

// Inicializar directorios seguros al arrancar
const { initializeSecureDirectories } = require('./utils/filePermissions');

// Crear servidor HTTP
const server = createServer(app);

// Configurar Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

const onlineConnections = new Map();
const offlineTimers = new Map();

const markUserOnline = async (userId) => {
  if (!userId) return;
  try {
    await userService.updateUserOnlineStatus(userId, 1);
    io.to('admin-room').emit('userPresenceUpdated', { userId, online: 1 });
  } catch (error) {
    logger.error(`[socket.io] Error actualizando online=1 userId=${userId} error=${error?.message || error}`);
  }
};

const scheduleUserOffline = (userId, delayMs = 5000) => {
  if (!userId) return;
  if (offlineTimers.has(userId)) {
    clearTimeout(offlineTimers.get(userId));
  }
  const timer = setTimeout(async () => {
    const current = onlineConnections.get(userId) || 0;
    if (current <= 0) {
      try {
        await userService.updateUserOnlineStatus(userId, 0);
        io.to('admin-room').emit('updateNotifications');
        io.to('admin-room').emit('userPresenceUpdated', { userId, online: 0 });
      } catch (error) {
        logger.error(`[socket.io] Error actualizando online=0 userId=${userId} error=${error?.message || error}`);
      }
    }
    offlineTimers.delete(userId);
  }, delayMs);
  offlineTimers.set(userId, timer);
};

// Middleware de autenticación para Socket.io
const jwt = require('jsonwebtoken');
const ChatService = require('./services/chat.service');

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      logger.warn(`[socket.io] Token no proporcionado ip=${socket.handshake.address} origin=${socket.handshake.headers?.origin || 'N/A'}`);
      return next(new Error('Token no proporcionado'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await ChatService.authenticateUser(decoded.id);
    if (!user) {
      logger.warn(`[socket.io] Usuario no encontrado id=${decoded?.id ?? 'N/A'} ip=${socket.handshake.address}`);
      return next(new Error('Usuario no encontrado o inactivo'));
    }

    const normalizedRole = normalizeRole(user.role, user.role_id);
    socket.user = {
      ...user,
      role: normalizedRole,
      roleName: user.role,
      roleId: user.role_id,
    };
    next();
  } catch (error) {
    logger.warn(`[socket.io] Token inválido ip=${socket.handshake.address} error=${error?.message || error}`);
    next(new Error('Token inválido'));
  }
});
// Manejar conexiones de Socket.io
io.on('connection', (socket) => {
  if (socket?.user?.id) {
    const current = onlineConnections.get(socket.user.id) || 0;
    onlineConnections.set(socket.user.id, current + 1);
    const hadOfflineTimer = offlineTimers.has(socket.user.id);
    if (offlineTimers.has(socket.user.id)) {
      clearTimeout(offlineTimers.get(socket.user.id));
      offlineTimers.delete(socket.user.id);
    }
    if (current === 0) {
      markUserOnline(socket.user.id);
    }

    if (socket.user.role === 'client' && current === 0 && !hadOfflineTimer) {
      (async () => {
        const rut =
          socket.user.customer_id ||
          socket.user.customer_rut ||
          socket.user.rut ||
          null;
        let name = '';
        let country = '';
        if (rut) {
          try {
            const customer = await customerService.getCustomerByRutFromSql(String(rut));
            name = customer?.name || '';
            country = customer?.country || '';
          } catch (error) {
            logger.warn(`[socket.io] No se pudo resolver nombre cliente rut=${rut} error=${error?.message || error}`);
          }
        }
        const payload = {
          rut: rut || null,
          name: name || rut || 'Cliente',
          country: country || null,
          timestamp: new Date().toISOString()
        };
        io.to('admin-room').emit('clientConnected', payload);
        logger.info(`[socket.io] clientConnected rut=${payload.rut ?? 'N/A'} name=${payload.name ?? 'N/A'}`);
      })().catch((error) => {
        logger.error(`[socket.io] clientConnected error=${error?.message || error}`);
      });
    }
  }
  // Unir al usuario a una sala específica según su rol
  if (socket.user.role === 'admin') {
    socket.join('admin-room'); // Para notificaciones generales
    socket.join(`admin-${socket.user.id}`); // Para mensajes específicos del admin
  } else if (socket.user.role === 'client' && socket.user.customer_id) {
    const customerRoom = `customer-${socket.user.customer_id}`;
    socket.join(customerRoom);
  }
  
  // Manejar desconexión
  socket.on('disconnect', async () => {
    try {
      if (socket?.user?.id) {
        const current = (onlineConnections.get(socket.user.id) || 1) - 1;
        onlineConnections.set(socket.user.id, Math.max(current, 0));
        if (current <= 0) {
          scheduleUserOffline(socket.user.id);
        }
      }
    } catch (error) {
    }
  });
});

// Exportar io para usar en otros archivos
app.set('io', io);

// Middleware global de manejo de errores (debe ir al final, antes de server.listen)
app.use((err, req, res, next) => {
  // Log del error con detalles completos
  logger.error(`[Global Error Handler] ${err.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: req.user ? req.user.email : 'anonymous'
  });
  
  // En producción, no exponer detalles del error
  const message = process.env.NODE_ENV === 'production' 
    ? 'Error interno del servidor' 
    : err.message;
  
  // Responder con formato estándar
  res.status(err.status || 500).json({ 
    success: false, 
    message 
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  try {
    await initializeSecureDirectories();
  } catch (error) {
    logger.error(`[Backend] Error inicializando directorios: ${error.message}`);
  }
});
