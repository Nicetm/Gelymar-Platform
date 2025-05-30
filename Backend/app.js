const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const swaggerSpec = require('./docs/swagger');

// Middlewares
const authMiddleware = require('./middleware/auth.middleware');
const { authorizeRoles } = require('./middleware/role.middleware');
const authFromCookie = require('./middleware/authFromCookie');

dotenv.config();
const app = express();

// Rutas API
const customerRoutes = require('./routes/customer.routes');
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const itemRoutes = require('./routes/item.routes');
const documentDirectoryRoutes = require('./routes/documentDirectory.routes');
const documentFileRoutes = require('./routes/documentFile.routes');

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
app.use('/api/orders', authMiddleware, authorizeRoles(['admin']), orderRoutes);
app.use('/api/items', authMiddleware, authorizeRoles(['admin']), itemRoutes);
app.use('/api/directories', authMiddleware, authorizeRoles(['client']), documentDirectoryRoutes);
app.use('/api/files', authMiddleware, authorizeRoles(['client']), documentFileRoutes);

// 🔒 Rutas protegidas del frontend (HTML)
const pathAdmin = path.join(__dirname, 'views-protegidas/admin/index.html');
const pathClient = path.join(__dirname, 'views-protegidas/client/index.html');

app.get('/admin', authFromCookie, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Acceso no autorizado');
  }
  res.sendFile(pathAdmin);
});

app.get('/client', authFromCookie, (req, res) => {
  if (req.user.role !== 'client') {
    return res.status(403).send('Acceso no autorizado');
  }
  res.sendFile(pathClient);
});

// Página principal (opcional)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en: http://localhost:${PORT}`);
});