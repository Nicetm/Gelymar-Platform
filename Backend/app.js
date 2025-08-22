const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const swaggerSpec = require('./docs/swagger');
require('module-alias/register');

// Middlewares
const authMiddleware = require('./middleware/auth.middleware');
const { authorizeRoles } = require('./middleware/role.middleware');
const authFromCookie = require('./middleware/authFromCookie');

dotenv.config();
const app = express();

// Rutas API
const customerRoutes = require('./routes/customer.routes');
const userRoutes = require('./routes/user.routes');
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const itemRoutes = require('./routes/item.routes');
const documentDirectoryRoutes = require('./routes/documentDirectory.routes');
const documentFileRoutes = require('./routes/documentFile.routes');
const documentTypeRoutes = require('./routes/documentType.routes');
const cronRoutes = require('./routes/cron.routes');

// Middlewares globales
app.use(cors());
app.use(express.json());
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

// Rutas protegidas (requieren token + rol adecuado)
app.use('/api/customers', authMiddleware, authorizeRoles(['admin']), customerRoutes);
app.use('/api/users', authMiddleware, authorizeRoles(['admin', 'client']), userRoutes);
app.use('/api/orders', authMiddleware, authorizeRoles(['admin', 'client']), orderRoutes);
app.use('/api/items', authMiddleware, authorizeRoles(['admin']), itemRoutes);
app.use('/api/directories', authMiddleware, authorizeRoles(['admin']), documentDirectoryRoutes);
app.use('/api/files', authMiddleware, authorizeRoles(['admin']), documentFileRoutes);
app.use('/api/document-types', authMiddleware, authorizeRoles(['admin']), documentTypeRoutes);

// Rutas de cron (sin autenticación para acceso interno)
app.use('/api/cron', cronRoutes);

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

// 🔐 Rutas específicas para admin
app.get('/admin/dashboard', (req, res) => {
  res.redirect('/admin');
});

app.get('/admin/users', (req, res) => {
  res.redirect('/admin');
});

app.get('/admin/orders', (req, res) => {
  res.redirect('/admin');
});

// 🔐 Rutas específicas para client
app.get('/client/dashboard', (req, res) => {
  res.redirect('/client');
});

app.get('/client/documents', (req, res) => {
  res.redirect('/client');
});

app.get('/client/settings', (req, res) => {
  res.redirect('/client');
});

// Página principal (opcional)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en: ${process.env.FRONTEND_BASE_URL || 'http://localhost:' + PORT}`);
});