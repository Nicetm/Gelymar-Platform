---
inclusion: always
---

# Backend - APIs y Endpoints

## Endpoints Principales

### Autenticación
```
POST   /api/auth/login              # Login con email/password
POST   /api/auth/logout             # Cerrar sesión
POST   /api/auth/refresh            # Refrescar token JWT
POST   /api/auth/2fa/setup          # Configurar 2FA
POST   /api/auth/2fa/verify         # Verificar código 2FA
POST   /api/auth/password-reset     # Solicitar reset de contraseña
PUT    /api/auth/password-reset     # Cambiar contraseña con token
```

### Clientes
```
GET    /api/customers                      # Lista clientes (filtro: salesRut)
GET    /api/customers/:rut                 # Cliente específico por RUT
POST   /api/customers/:rut/contacts        # Crear contactos
GET    /api/customers/:rut/contacts        # Obtener contactos
PUT    /api/customers/:rut/contacts/:idx   # Actualizar contacto
DELETE /api/customers/:rut/contacts/:idx   # Eliminar contacto
```

**Roles permitidos**: admin, seller
**Filtros**: salesRut (vendedor solo ve sus clientes)

### Órdenes
```
GET /api/orders                    # Lista órdenes
GET /api/orders/:orderId           # Orden específica (PC|OC)
GET /api/orders/:orderId/items     # Items de orden
GET /api/orders/:orderId/files     # Archivos de orden
```

**Roles permitidos**: admin, seller, client
**Filtros**: 
- customerRut (cliente solo ve sus órdenes)
- salesRut (vendedor solo ve órdenes de sus clientes)

### Archivos de Documentos
```
GET    /api/document-files                      # Lista archivos
GET    /api/document-files/:fileId              # Obtener archivo
GET    /api/document-files/:fileId/view         # Ver archivo (validación acceso)
GET    /api/document-files/:fileId/download     # Descargar archivo
POST   /api/document-files                      # Subir archivo manual
PUT    /api/document-files/:fileId/visibility   # Cambiar visibilidad
DELETE /api/document-files/:fileId              # Eliminar archivo
```

**Roles permitidos**: 
- admin: Todos los archivos
- seller: Archivos de sus clientes
- client: Solo archivos visibles (is_visible_to_client=1)

### Chat
```
GET  /api/chat/messages/:customerId    # Mensajes de cliente
POST /api/chat/messages                # Enviar mensaje
GET  /api/chat/recent                  # Chats recientes (admin)
GET  /api/chat/summary                 # Resumen de chats (admin)
PUT  /api/chat/read/:customerId        # Marcar como leído
GET  /api/chat/presence                # Estado de presencia
GET  /api/chat/presence/:adminId       # Presencia de admin específico
```

**Roles permitidos**:
- admin: Todos los chats
- client: Solo su propio chat

### Usuarios
```
GET    /api/users                 # Lista usuarios (admin only)
GET    /api/users/:id             # Usuario específico
POST   /api/users                 # Crear usuario (admin only)
PUT    /api/users/:id             # Actualizar usuario
DELETE /api/users/:id             # Eliminar usuario (admin only)
GET    /api/users/profile         # Perfil del usuario autenticado
PUT    /api/users/profile         # Actualizar perfil propio
```

### Vendedores
```
GET    /api/vendedores            # Lista vendedores (admin only)
GET    /api/vendedores/:rut       # Vendedor específico
POST   /api/vendedores            # Crear vendedor (admin only)
PUT    /api/vendedores/:rut       # Actualizar vendedor (admin only)
DELETE /api/vendedores/:rut       # Eliminar vendedor (admin only)
```

### Cron Jobs (Admin only)
```
GET  /api/cron/tasks-config            # Configuración de tareas
PUT  /api/cron/tasks-config            # Actualizar configuración
POST /api/cron/check-client-access     # Ejecutar verificación acceso
POST /api/cron/generate-default-files  # Generar archivos por defecto
POST /api/cron/process-new-orders      # Procesar órdenes nuevas (ORN)
```

### Configuración (Admin only)
```
GET /api/config                        # Todas las configuraciones
GET /api/config/:name                  # Configuración específica
PUT /api/config/:name                  # Actualizar configuración
```

**Configuraciones disponibles**:
- sendAutomaticOrderReception
- sendAutomaticOrderShipment
- sendAutomaticOrderDelivery
- sendAutomaticOrderAvailability

## Formato de Respuestas

### Respuesta Exitosa
```json
{
  "success": true,
  "data": { ... }
}
```

### Respuesta con Error
```json
{
  "success": false,
  "message": "Descripción del error"
}
```

### Respuesta con Paginación
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150
  }
}
```

## Códigos de Estado HTTP

- `200 OK`: Operación exitosa
- `201 Created`: Recurso creado exitosamente
- `400 Bad Request`: Datos de entrada inválidos
- `401 Unauthorized`: No autenticado (token faltante o inválido)
- `403 Forbidden`: No autorizado (sin permisos para el recurso)
- `404 Not Found`: Recurso no encontrado
- `500 Internal Server Error`: Error del servidor

## Autenticación

### Header de Autenticación
```
Authorization: Bearer <JWT_TOKEN>
```

### Cookie de Autenticación
```
Cookie: token=<JWT_TOKEN>
```

**Nota**: El backend prioriza el header sobre la cookie para evitar conflictos entre portales.

## Validación de Requests

### Ejemplo con express-validator
```javascript
router.post('/customers/:rut/contacts',
  authMiddleware,
  authorizeRoles(['admin', 'seller']),
  [
    param('rut').notEmpty().withMessage('RUT requerido'),
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    body('email').isEmail().withMessage('Email inválido'),
    body('sh_documents').isBoolean().optional(),
    body('reports').isBoolean().optional(),
    body('cco').isBoolean().optional()
  ],
  validateRequest,
  createContact
);
```

## Testing de Endpoints

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gelymar.com","password":"password"}'
```

### Obtener Órdenes (con token)
```bash
curl -X GET http://localhost:3000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Crear Contacto
```bash
curl -X POST http://localhost:3000/api/customers/12345678-9/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre":"Juan Pérez",
    "email":"juan@example.com",
    "telefono":"+56912345678",
    "sh_documents":true,
    "reports":true,
    "cco":false
  }'
```

### Actualizar Configuración de Cron
```bash
curl -X PUT http://localhost:3000/api/cron/tasks-config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "check_client_access": true,
    "check_default_files": true
  }'
```

## CORS y Orígenes Permitidos

### Desarrollo
```javascript
const devOrigins = [
  'http://localhost:2121',  // Admin
  'http://localhost:2122',  // Client
  'http://localhost:2123'   // Seller
];
```

### Producción
```javascript
const prodOrigins = [
  'http://172.20.10.151:2121',      // Admin
  'https://logistic.gelymar.cl',    // Client (Cloudflare)
  'http://172.20.10.151:2123'       // Seller
];
```

## Rate Limiting

- **Límite**: 100 requests por IP cada 15 minutos
- **Slow Down**: Delay progresivo después de 50 requests
- **Delay**: 500ms por request adicional

### Endpoints Especiales
- `/api/auth/login`: Rate limit más estricto (prevención de fuerza bruta)
- `/api/auth/2fa/verify`: Rate limit estricto

## WebSocket Events (Socket.io)

### Cliente → Servidor
```javascript
// Enviar mensaje
socket.emit('sendMessage', {
  customerId: '12345678-9',
  message: 'Hola, necesito ayuda',
  type: 'text'
});

// Marcar como leído
socket.emit('markAsRead', {
  customerId: '12345678-9'
});
```

### Servidor → Cliente
```javascript
// Nuevo mensaje
socket.on('newMessage', (data) => {
  // data: { id, customerId, adminId, message, senderType, createdAt }
});

// Actualización de presencia
socket.on('userPresenceUpdated', (data) => {
  // data: { userId, online }
});

// Actualización de notificaciones
socket.on('updateNotifications', (data) => {
  // data: { count }
});
```

## Swagger Documentation

Acceso a documentación interactiva:
```
http://localhost:3000/api-docs
```

La documentación Swagger se genera automáticamente desde comentarios JSDoc en los archivos de rutas.
