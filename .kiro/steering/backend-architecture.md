---
inclusion: always
---

# Backend - Arquitectura

## Stack Tecnológico

- **Runtime**: Node.js con Express 5.x
- **Lenguaje**: JavaScript (ES6+)
- **Arquitectura**: Microservicios con capas separadas
- **Puerto**: 3000

## Estructura de Capas

```
Controllers → Services → Models/Mappers → Database
```

### Controllers (Backend/controllers/)
- Manejan HTTP requests/responses
- Validación de entrada con express-validator
- NO contienen lógica de negocio
- Delegan todo a services

### Services (Backend/services/)
- Contienen TODA la lógica de negocio
- Interactúan con bases de datos
- Procesan y transforman datos
- Manejan reglas de negocio

### Models (Backend/models/)
- Objetos planos (plain objects)
- NO hay ORM
- Definen estructura de datos
- Sin lógica de negocio

### Mappers (Backend/mappers/sqlsoftkey/)
- Transforman datos entre sistemas
- SQL Server (Softkey) ↔ Formato de aplicación
- Normalizan fechas, decimales, valores nulos

## Inyección de Dependencias

### Awilix Container (Backend/config/container.js)
Todos los servicios se registran como singletons:

```javascript
container.register({
  // Servicios
  orderService: asFunction((deps) => createOrderService(deps)).singleton(),
  customerService: asValue(customerService),
  emailService: asValue(emailService),
  chatService: asValue(chatService),
  
  // Configuración
  mysqlPoolPromise: asValue(poolPromise),
  sqlModule: asValue(sql),
  getSqlPoolFn: asValue(getSqlPool),
  
  // Mappers
  hdrMapper: asValue(mapHdrRowToOrder),
  itemMapper: asValue(mapItemRowToOrderItem),
  
  // Logger
  logger: asValue(logger)
});
```

## Middleware Stack

### 1. Seguridad
- **Helmet**: Content Security Policy (CSP)
- **CORS**: Whitelist de orígenes permitidos
- **Rate Limiting**: 100 requests/15 minutos
- **Slow Down**: Delay progresivo después de 50 requests

### 2. Autenticación (Backend/middleware/auth.middleware.js)
```javascript
createAuthMiddleware({
  requireAuth: true,        // Requiere autenticación
  allowExpired: false,      // Permite tokens expirados
  tokenSource: 'both',      // 'both', 'header', 'cookie'
  preferHeader: true        // Prioriza header sobre cookie
})
```

**Fuentes de token**:
- Header: `Authorization: Bearer TOKEN`
- Cookie: `token=TOKEN`
- Preferencia: Header primero (evita conflictos entre portales)

### 3. Autorización (Backend/middleware/role.middleware.js)
```javascript
authorizeRoles(['admin', 'seller'])
```

**Roles soportados**:
- `admin`: Acceso completo
- `seller`: Acceso a sus clientes
- `client`: Acceso a sus propias órdenes

### 4. Validación (Backend/middleware/validation.middleware.js)
Usa express-validator para validar requests

## Configuración de Entorno

### Detección Automática
```javascript
// Docker
if (process.env.DOCKER_ENV === 'true') { ... }

// Servidor producción
if (IP === '172.20.10.151') { ... }

// Desarrollo local
else { ... }
```

### Variables de Entorno Clave
```bash
# Base de datos
MYSQL_DB_HOST=mysql
MYSQL_DB_USER=gelymar
MYSQL_DB_PASS=root123456
MYSQL_DB_NAME=gelymar

SQL_HOST=172.20.10.162
SQL_PORT=1433
SQL_DB=Extractos_Naturales_Gelymar_SA
SQL_USER=int_wl_sap
SQL_PASS=Soft7488$.

# Autenticación
JWT_SECRET=gelymar_jwt_secret_key_2024
ENCRYPTION_KEY=gelymar-chat-encryption-key-2024-secure-production-ready

# Email
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=logistics@gelymar.com
SMTP_PASS=T$718649482733av

# URLs
BACKEND_API_URL=http://backend:3000
FRONTEND_BASE_URL=http://localhost:2121
FILE_SERVER_URL=http://fileserver:80
```

## Logging (Backend/utils/logger.js)

### Loggers Especializados
```javascript
const { logger, logSecurity, logAudit, logCronJob } = require('../utils/logger');

// Log general
logger.info(`[serviceName] Operación exitosa`);
logger.error(`[serviceName] Error: ${error.message}`);
logger.warn(`[serviceName] Advertencia`);

// Log de seguridad
logSecurity('LOGIN_ATTEMPT', {
  ip: req.ip,
  user: req.body.email,
  success: true
});

// Log de auditoría
logAudit('USER_UPDATED', {
  user: req.user.email,
  resource: `user/${userId}`,
  changes: { role: 'admin' }
});

// Log de cron job
logCronJob('sendOrderReception', 'START', { ordersCount: 10 });
```

### Formato de Logs
```
[2024-01-15T10:30:45.123Z] -> Logger Process -> [serviceName] Mensaje
```

## Manejo de Errores

### En Services
```javascript
try {
  const result = await someOperation();
  return result;
} catch (error) {
  logger.error(`[serviceName] Error: ${error.message}`);
  throw error; // Re-throw para que controller maneje
}
```

### En Controllers
```javascript
try {
  const result = await service.someOperation();
  res.json({ success: true, data: result });
} catch (error) {
  logger.error(`[controllerName] Error: ${error.message}`);
  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor' 
  });
}
```

## Rutas (Backend/routes/)

### Estructura de Archivos
```
routes/
├── auth.routes.js           # Autenticación y 2FA
├── customer.routes.js       # Gestión de clientes
├── order.routes.js          # Órdenes
├── orderDetail.routes.js    # Detalles de órdenes
├── item.routes.js           # Items/productos
├── documentFile.routes.js   # Archivos de documentos
├── documentType.routes.js   # Tipos de documentos
├── chat.routes.js           # Sistema de chat
├── cron.routes.js           # Endpoints de cron jobs
├── cronConfig.routes.js     # Configuración de cron
├── config.routes.js         # Configuración general
├── user.routes.js           # Gestión de usuarios
├── vendedor.routes.js       # Vendedores
└── message.routes.js        # Mensajes del sistema
```

### Patrón de Rutas
```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const controller = require('../controllers/example.controller');

// Ruta pública
router.post('/login', controller.login);

// Ruta autenticada
router.get('/profile', authMiddleware, controller.getProfile);

// Ruta con roles específicos
router.get('/admin-only', 
  authMiddleware, 
  authorizeRoles(['admin']), 
  controller.adminAction
);

module.exports = router;
```

## WebSocket (Socket.io)

### Configuración (Backend/app.js)
```javascript
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// Autenticación de socket
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  // Validar token JWT
  // Adjuntar usuario a socket
  next();
});
```

### Rooms
- `admin-room`: Broadcast a todos los admins
- `admin-{userId}`: Mensajes directos a admin específico
- `customer-{customerId}`: Mensajes a cliente específico

### Eventos
```javascript
io.on('connection', (socket) => {
  // Unirse a rooms según rol
  if (role === 'admin') {
    socket.join('admin-room');
    socket.join(`admin-${userId}`);
  }
  
  // Eventos personalizados
  socket.on('sendMessage', async (data) => {
    // Procesar y emitir
    io.to(`customer-${customerId}`).emit('newMessage', message);
  });
});
```

## Comandos de Desarrollo

```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start

# Utilidades
npm run cleanup              # Limpiar archivos temporales
npm run cleanup:temp         # Solo archivos temp
npm run check:permissions    # Verificar permisos de archivos
```

## Docker

### Dockerfile
Multi-stage build para optimizar tamaño de imagen

### Variables de Entorno
Todas las variables se pasan desde docker-compose.yml

### Volúmenes
- Logs: Persistidos en volumen Docker
- Uploads: Compartidos con fileserver
- Temp: Efímero, se limpia periódicamente

## Consideraciones de Performance

### Connection Pooling
- MySQL: 10 conexiones máximo
- SQL Server: 10 max, 0 min, 30s idle timeout

### Timeouts
- SQL Server: 60 segundos por consulta
- HTTP requests: Sin timeout explícito
- Socket.io: Heartbeat cada 25 segundos

### Rate Limiting
- 100 requests por IP cada 15 minutos
- Slow down después de 50 requests
- Delay incremental: 500ms por request adicional
