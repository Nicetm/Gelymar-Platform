const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const swaggerSpec = require('./docs/swagger');

// Rutas API
const customerRoutes = require('./routes/customer.routes');
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const itemRoutes = require('./routes/item.routes');
const documentDirectoryRoutes = require('./routes/documentDirectory.routes');
const documentFileRoutes = require('./routes/documentFile.routes');

dotenv.config();
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Archivos estáticos (logo SVG, dashboard, etc.)
app.use('/swagger-assets', express.static(path.join(__dirname, 'public/swagger-assets')));
app.use(express.static(path.join(__dirname, 'public')));

// Swagger JSON endpoint
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Swagger UI personalizado (HTML con logo y colores)
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs/swagger-ui.html'));
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/directories', documentDirectoryRoutes);
app.use('/api/files', documentFileRoutes);

// Página principal: dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en: http://localhost:${PORT}`);
});