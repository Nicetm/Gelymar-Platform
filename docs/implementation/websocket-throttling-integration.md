# WebSocket Throttling & Validation - Guía de Integración

**Fecha**: 2024-01-15
**Quick Win**: #4 y #5
**Archivos creados**: `Backend/middleware/socket.middleware.js`

---

## Resumen

Se ha creado un middleware para Socket.io que implementa:
1. **Rate limiting** por socket y evento (previene DoS)
2. **Validación de mensajes** (seguridad)
3. **Límite de conexiones por usuario** (previene abuso)
4. **Cleanup automático** de rate limits (previene memory leaks)

---

## Cambios Necesarios en Backend/app.js

### 1. Importar el Middleware

Agregar al inicio del archivo (después de otros requires):

```javascript
const {
  checkRateLimit,
  startRateLimitCleanup,
  validateMessage,
  getUserConnectionCount,
  MAX_CONNECTIONS_PER_USER
} = require('./middleware/socket.middleware');
```

### 2. Actualizar Configuración de Socket.io

**BUSCAR** (línea ~303):
```javascript
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  }
});
```

**REEMPLAZAR CON**:
```javascript
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,              // 60s timeout
  pingInterval: 25000,             // 25s heartbeat
  maxHttpBufferSize: 1e6,          // 1MB max message size
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  perMessageDeflate: false         // Disable compression for performance
});

// Iniciar cleanup de rate limits
startRateLimitCleanup();
```

### 3. Agregar Validación de Límite de Conexiones

**BUSCAR** (línea ~350, dentro de `io.use`):
```javascript
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
```

**AGREGAR ANTES DE `next()`**:
```javascript
    const normalizedRole = normalizeRole(user.role, user.role_id);
    socket.user = {
      ...user,
      role: normalizedRole,
      roleName: user.role,
      roleId: user.role_id,
    };
    
    // Verificar límite de conexiones por usuario
    const connectionCount = getUserConnectionCount(io, user.id);
    if (connectionCount >= MAX_CONNECTIONS_PER_USER) {
      logger.warn(`[socket.io] Max connections exceeded userId=${user.id} count=${connectionCount}`);
      return next(new Error('Maximum connections exceeded'));
    }
    
    next();
```

### 4. Agregar Handler de Mensajes con Throttling

**BUSCAR** (línea ~420, después de `socket.join(customerRoom)`):
```javascript
  } else if (socket.user.role === 'client' && socket.user.customer_id) {
    const customerRoom = `customer-${socket.user.customer_id}`;
    socket.join(customerRoom);
  }
  
  // Manejar desconexión
  socket.on('disconnect', async () => {
```

**AGREGAR ENTRE `socket.join` Y `socket.on('disconnect')`**:
```javascript
  } else if (socket.user.role === 'client' && socket.user.customer_id) {
    const customerRoom = `customer-${socket.user.customer_id}`;
    socket.join(customerRoom);
  }
  
  // Handler de mensajes con throttling y validación
  socket.on('sendMessage', async (data) => {
    try {
      // Rate limiting: 30 mensajes por minuto
      if (!checkRateLimit(socket.id, 'sendMessage', 30)) {
        logger.warn(`[socket.io] Rate limit exceeded socketId=${socket.id} userId=${socket.user?.id}`);
        return socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
      }
      
      // Validación de mensaje
      const validation = validateMessage(data);
      if (!validation.valid) {
        logger.warn(`[socket.io] Invalid message socketId=${socket.id} error=${validation.error}`);
        return socket.emit('error', { message: validation.error });
      }
      
      // Procesar mensaje (aquí iría la lógica de guardar en BD)
      const messageData = {
        customerId: socket.user.role === 'client' ? socket.user.customer_id : data.customerId,
        adminId: socket.user.role === 'admin' ? socket.user.id : null,
        message: data.message.trim(),
        senderType: socket.user.role === 'admin' ? 'admin' : 'customer'
      };
      
      // Guardar mensaje (usar ChatService)
      const ChatService = require('./services/chat.service');
      const result = await ChatService.sendMessage(messageData);
      
      // Emitir a destinatario
      const targetRoom = socket.user.role === 'admin' 
        ? `customer-${data.customerId}`
        : 'admin-room';
      
      io.to(targetRoom).emit('newMessage', {
        ...result,
        message: data.message.trim(),
        senderType: messageData.senderType,
        createdAt: new Date().toISOString()
      });
      
      // Confirmar envío
      socket.emit('messageSent', { success: true, messageId: result.messageId });
      
      logger.info(`[socket.io] Message sent socketId=${socket.id} userId=${socket.user?.id} length=${data.message.length}`);
      
    } catch (error) {
      logger.error(`[socket.io] Error sending message socketId=${socket.id} error=${error?.message}`);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  // Manejar desconexión
  socket.on('disconnect', async () => {
```

---

## Beneficios Implementados

### 1. Rate Limiting
- **Previene DoS**: Máximo 30 mensajes por minuto por socket
- **Configurable**: Fácil ajustar límites por evento
- **Memory-safe**: Cleanup automático cada 5 minutos

### 2. Validación de Mensajes
- **Formato**: Verifica que sea objeto con campo `message`
- **Tipo**: Verifica que sea string
- **Longitud**: Máximo 5000 caracteres
- **Contenido**: No permite mensajes vacíos

### 3. Límite de Conexiones
- **Por usuario**: Máximo 5 conexiones simultáneas
- **Previene abuso**: Un usuario no puede abrir 1000+ conexiones

### 4. Configuración Mejorada
- **Timeouts**: 60s ping timeout, 25s heartbeat
- **Buffer size**: 1MB máximo por mensaje
- **Transports**: WebSocket + polling fallback
- **Compression**: Deshabilitada para mejor performance

---

## Testing

### Test 1: Rate Limiting
```javascript
// Enviar 31 mensajes rápidamente
for (let i = 0; i < 31; i++) {
  socket.emit('sendMessage', { message: `Test ${i}` });
}
// Mensaje 31 debe ser rechazado con "Rate limit exceeded"
```

### Test 2: Validación de Mensajes
```javascript
// Mensaje vacío
socket.emit('sendMessage', { message: '' });
// Debe retornar error: "Message cannot be empty"

// Mensaje muy largo
socket.emit('sendMessage', { message: 'a'.repeat(5001) });
// Debe retornar error: "Message too long"

// Formato inválido
socket.emit('sendMessage', { invalid: 'data' });
// Debe retornar error: "Message is required"
```

### Test 3: Límite de Conexiones
```javascript
// Abrir 6 conexiones con el mismo usuario
// La 6ta debe ser rechazada con "Maximum connections exceeded"
```

---

## Logs Esperados

### Conexión exitosa
```
[socket.io] Conectado userId=123 role=client ip=127.0.0.1
```

### Rate limit excedido
```
[socket.io] Rate limit exceeded socketId=abc123 userId=123
```

### Mensaje inválido
```
[socket.io] Invalid message socketId=abc123 error=Message too long
```

### Mensaje enviado exitosamente
```
[socket.io] Message sent socketId=abc123 userId=123 length=45
```

---

## Rollback

Si hay problemas, revertir los cambios:

1. Remover import del middleware
2. Restaurar configuración original de Socket.io
3. Remover handler de `sendMessage`
4. Remover validación de límite de conexiones

El archivo `Backend/middleware/socket.middleware.js` puede quedar para uso futuro.

---

## Próximos Pasos

1. **Integrar cambios** en `Backend/app.js` siguiendo esta guía
2. **Rebuild Docker**: `cd docker && .\build-all-prod.ps1`
3. **Deploy y monitorear** logs de Socket.io
4. **Validar** que rate limiting funciona correctamente
5. **Ajustar límites** si es necesario (30 msg/min puede ser muy restrictivo o muy permisivo)

---

## Notas Importantes

- El handler de `sendMessage` es **opcional** - actualmente los mensajes se envían vía REST API
- Si decides usar Socket.io para mensajes, este handler ya está listo
- El rate limiting y validación funcionan independientemente del handler
- Los límites son configurables en `socket.middleware.js`

---

## Impacto Esperado

- ✅ **Seguridad**: Previene DoS y mensajes maliciosos
- ✅ **Performance**: Sin overhead significativo (<1ms por validación)
- ✅ **Estabilidad**: Previene memory leaks con cleanup automático
- ✅ **Observabilidad**: Logs detallados de rate limiting y errores
