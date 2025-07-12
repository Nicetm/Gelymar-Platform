const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Gelymar API',
    version: '1.0.0',
    description: `
**API REST para SAP Business One**  
Gestión de Clientes, Ítems, Órdenes, Stock y Documentos.

🔧 Desarrollado por **Softkey Ltda.** para **GELYMAR**  
📩 [contacto@softkey.cl](mailto:contacto@softkey.cl) | 🌐 [www.softkey.cl](https://www.softkey.cl)
    `,
    license: {
      name: 'Privado - Proyecto Gelymar',
      url: ''
    }
  },
  tags: [
    { name: 'Autenticación', description: 'Endpoints de login y seguridad' },
    { name: 'Clientes', description: 'Gestión de clientes registrados' },
    { name: 'Órdenes', description: 'Gestión de órdenes de venta' },
    { name: 'Ítems', description: 'Gestión de ítems fabricados por orden' },
    { name: 'Directorios', description: 'Carpetas organizadas por cliente' },
    { name: 'Archivos', description: 'Archivos por orden de compra y cliente' }
  ],
  servers: [
    {
      url: process.env.BACKEND_BASE_URL || 'http://localhost:3000',
      description: 'Servidor local'
    },
    {
      "url": "https://api.gelymar-prod.com",
      "description": "Servidor de producción"
    },
    {
      "url": "https://api.gelymar-qa.com",
      "description": "Servidor de pruebas"
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ]
};

const options = {
  swaggerDefinition,
  apis: ['./routes/*.js'], // Puedes agregar más: ['./routes/**/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;