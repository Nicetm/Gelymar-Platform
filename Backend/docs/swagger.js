const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Gelymar API',
    version: '1.0.0',
    description: 'API REST para SAP Business One: Clientes, Ítems, Órdenes, Stock y Gestión Documental.\n\nDesarrollado por Softkey Ltda. para GELYMAR.',
    contact: {
      name: 'Softkey Ltda',
      email: 'contacto@softkey.cl',
      url: 'https://www.softkey.cl'
    },
    termsOfService: '',
    license: {
      name: 'Privado - Proyecto Gelymar',
      url: ''
    }
  },
  tags: [
    { name: 'Autenticación', description: 'Endpoints de login y seguridad' },
    { name: 'Clientes', description: 'Endpoints para gestión de clientes' },
    { name: 'Órdenes', description: 'Endpoints para gestión de órdenes de venta' },
    { name: 'Ítems', description: 'Endpoints para gestión de ítems fabricados por orden' },
    { name: 'Directorios', description: 'Endpoints para gestión de directorios por cliente' },
    { name: 'Archivos', description: 'Endpoints para gestión de archivos por orden de compra y cliente' },
    // Puedes agregar más tags aquí como: { name: 'Ítems' }, { name: 'Gestión Documental' }, etc.
  ],
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor local'
    }
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
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
