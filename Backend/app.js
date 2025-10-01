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
require('module-alias/register');

// Detectar si estamos en el servidor Ubuntu (172.20.10.151)
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

// Detectar si estamos en Docker
const isDocker = process.env.DOCKER_ENV === 'true';

// Cargar archivo de configuración según entorno
if (isDocker) {
  console.log('🔧 [Backend] Entorno detectado: Docker');  
  console.log('🔧 [Backend] DB_HOST cargado:', process.env.DB_HOST);
  console.log('🔧 [Backend] DB_USER cargado:', process.env.DB_USER);
} else if (isServer) {
  dotenv.config({ path: './env.server' });
  console.log('🔧 [Backend] Entorno detectado: Servidor Ubuntu (172.20.10.151)');
} else {
  dotenv.config({ path: './.env.local' });
  console.log('🔧 [Backend] Entorno detectado: Desarrollo local');
  console.log('🔧 [Backend] DB_HOST cargado:', process.env.DB_HOST);
  console.log('🔧 [Backend] DB_USER cargado:', process.env.DB_USER);
}

// Middlewares
const { createAuthMiddleware } = require('./middleware/auth.middleware');
const { authorizeRoles } = require('./middleware/role.middleware');

// Crear middlewares de autenticación específicos
const authMiddleware = createAuthMiddleware();
const authFromCookie = createAuthMiddleware({ tokenSource: 'cookie' });
const authAllowExpired = createAuthMiddleware({ allowExpired: true });

const app = express();

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
const configRoutes = require('./routes/config.routes');


// Configuración de rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: { message: 'Demasiadas solicitudes desde esta IP, intente nuevamente en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutos
  delayAfter: 50, // permitir 50 requests sin delay
  delayMs: (used, req) => {
    const delayAfter = req.slowDown.limit;
    return (used - delayAfter) * 500;
  },
});

// Middlewares de seguridad globales
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:*", "http://backend:*", "https://api.gelymar.com", "ws://localhost:*", "wss://localhost:*", "ws://localhost:3000", "wss://localhost:3000"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Configuración CORS más restrictiva
app.use(cors({
  origin: [
    process.env.FRONTEND_BASE_URL || 'http://localhost:2121',
    'http://localhost:2122',
    'http://localhost:2123',
    'http://localhost:3001', // React frontend
    'http://localhost:8080',
    'http://localhost:8082',
    'http://localhost:9615',
    /^http:\/\/172\.20\.10\.151:\d+$/, // Permite cualquier puerto para 172.20.10.151
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middlewares globales
//app.use(limiter);
//app.use(speedLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

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
app.use('/api/auth', authRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/fileserver', fileserverRoutes);

// Rutas protegidas (requieren token + rol adecuado)
app.use('/api/customers', authMiddleware, authorizeRoles(['admin']), customerRoutes);
app.use('/api/users', authMiddleware, authorizeRoles(['admin', 'client']), userRoutes);
app.use('/api/orders', authMiddleware, authorizeRoles(['admin', 'client']), orderRoutes);
app.use('/api/order-detail', authMiddleware, authorizeRoles(['admin', 'client']), orderDetailRoutes);
app.use('/api/items', authMiddleware, authorizeRoles(['admin']), itemRoutes);
app.use('/api/directories', authMiddleware, authorizeRoles(['admin']), documentDirectoryRoutes);

// Ruta especial para visualización de archivos (acceso para admin y client)
app.use('/api/file-view', documentFileRoutes);

app.use('/api/files', authMiddleware, authorizeRoles(['admin']), documentFileRoutes);
app.use('/api/document-types', authMiddleware, authorizeRoles(['admin']), documentTypeRoutes);
app.use('/api/chat', chatRoutes);

// Ruta especial para procesamiento de órdenes nuevas (sin autenticación para cron)
const { processNewOrdersAndSendReception } = require('./controllers/documentFile.controller');
app.post('/api/cron/process-new-orders', processNewOrdersAndSendReception);

// Rutas de cron (sin autenticación para acceso interno)
app.use('/api/cron', cronRoutes);

// Rutas de configuración del cron (requieren autenticación de admin)
app.use('/api/cron-config', cronConfigRoutes);

// Rutas de configuración general (requieren autenticación de admin)
app.use('/api/config', configRoutes);


// Sirve archivos estáticos desde la carpeta 'uploads'
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas protegidas del frontend (HTML)
const pathAdmin = path.join(__dirname, 'views-protegidas/admin/index.html');
const pathClient = path.join(__dirname, 'views-protegidas/client/index.html');

app.get('/admin', authFromCookie, (req, res) => {
  if (req.user.role !== 'admin') {
    console.warn(`Acceso denegado a /admin: usuario ${req.user.email} con rol ${req.user.role}`);
    return res.status(403).send('Acceso no autorizado - Solo administradores');
  }
  res.sendFile(pathAdmin);
});

app.get('/client', authFromCookie, (req, res) => {
  if (req.user.role !== 'client') {
    console.warn(`Acceso denegado a /client: usuario ${req.user.email} con rol ${req.user.role}`);
    return res.status(403).send('Acceso no autorizado - Solo clientes');
  }
  res.sendFile(pathClient);
});

// 🔐 Middleware para proteger rutas de admin y client
app.use('/admin', authFromCookie, (req, res, next) => {
  if (req.user.role !== 'admin') {
    console.warn(`Acceso denegado a ${req.path}: usuario ${req.user.email} con rol ${req.user.role}`);
    return res.status(403).send('Acceso no autorizado - Solo administradores');
  }
  next();
});

app.use('/client', authFromCookie, (req, res, next) => {
  if (req.user.role !== 'client') {
    console.warn(`Acceso denegado a ${req.path}: usuario ${req.user.email} con rol ${req.user.role}`);
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
    origin: [
      process.env.FRONTEND_BASE_URL || 'http://localhost:2121',
      'http://localhost:2122',
      'http://localhost:2123',
      'http://localhost:3001', // React frontend
      'http://localhost:8082',
      'http://localhost:9615',
      /^http:\/\/172\.20\.10\.151:\d+$/, // Permite cualquier puerto para 172.20.10.151
    ],
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Middleware de autenticación para Socket.io
const jwt = require('jsonwebtoken');
const ChatService = require('./services/chat.service');

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Token no proporcionado'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await ChatService.authenticateUser(decoded.id);  
    if (!user) {
      return next(new Error('Usuario no encontrado o inactivo'));
    }
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Token inválido'));
  }
});
// Manejar conexiones de Socket.io
io.on('connection', (socket) => {
  // Unir al usuario a una sala específica según su rol
  if (socket.user.role === 'admin') {
    socket.join('admin-room');
  } else if (socket.user.role === 'client' && socket.user.customer_id) {
    const customerRoom = `customer-${socket.user.customer_id}`;
    socket.join(customerRoom);
  }
  
  // Manejar desconexión
  socket.on('disconnect', () => {
  });
});

// Exportar io para usar en otros archivos
app.set('io', io);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  try {
    await initializeSecureDirectories();
  } catch (error) {
    console.error('Error inicializando directorios:', error);
  }
});