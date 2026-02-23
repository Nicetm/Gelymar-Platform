---
inclusion: always
---

# Cron Jobs

## Arquitectura de Cron Jobs

### Gestor de Procesos: PM2
Todos los cron jobs se gestionan con PM2 (Process Manager 2)

**Configuración**: `Cronjob/ecosystem.config.js`

### Programador: node-cron
Cada job usa node-cron para programar ejecuciones

## Jobs Configurados

### 1. gelymar-cron-sequence (cronMaster.js)
**Propósito**: Orquestador maestro que ejecuta secuencia de tareas

**Horario**: 7:00 AM diario
```javascript
cron.schedule('0 7 * * *', async () => { ... });
```

**Secuencia de ejecución**:
1. Check Client Access: Verifica clientes sin cuenta, crea usuarios
2. Check Default Files: Genera placeholders de documentos para órdenes nuevas

**Características**:
- Llama a endpoints del backend (no acceso directo a BD)
- Carga configuración desde tabla `cron_tasks_config`
- Cada tarea puede habilitarse/deshabilitarse dinámicamente
- Logs detallados de cada paso

**Endpoints llamados**:
```javascript
POST http://backend:3000/api/cron/check-client-access
POST http://backend:3000/api/cron/generate-default-files
```

---

### 2. gelymar-order-reception (sendOrderReception.js)
**Propósito**: Envío automático de ORN (Order Receipt Notice)

**Horario**: 10:00 AM diario
```javascript
cron.schedule('0 10 * * *', async () => { ... });
```

**Proceso**:
1. Verifica si envío automático está habilitado (`sendAutomaticOrderReception`)
2. Obtiene órdenes sin factura (orden padre) que no tienen ORN
3. Respeta parámetro `sendFrom` para procesar desde fecha específica
4. Genera PDF si no existe
5. Obtiene contactos con permiso `reports`
6. Envía email a contactos autorizados
7. Marca archivo como enviado (`fecha_envio`)
8. Marca como visible al cliente (`is_visible_to_client = 1`)

**Endpoint llamado**:
```javascript
POST http://backend:3000/api/cron/process-new-orders
```

**Configuración** (tabla `config`):
```json
{
  "name": "sendAutomaticOrderReception",
  "params": {
    "enable": 1,
    "sendFrom": "2024-01-01"
  }
}
```

---

### 3. gelymar-shipment-notice (sendShipmentNotice.js)
**Propósito**: Envío automático de Avisos de Embarque

**Horario**: Configurable (por defecto deshabilitado)

**Proceso**:
1. Verifica si envío automático está habilitado (`sendAutomaticOrderShipment`)
2. Obtiene órdenes CON factura que no tienen Shipment Notice (file_id=19)
3. Genera PDF si no existe
4. Envía a contactos con permiso `reports`
5. Marca como enviado y visible

**Configuración**:
```json
{
  "name": "sendAutomaticOrderShipment",
  "params": {
    "enable": 0
  }
}
```

---

### 4. gelymar-order-delivery-notice (sendOrderDeliveryNotice.js)
**Propósito**: Envío automático de Avisos de Entrega

**Horario**: Configurable (por defecto deshabilitado)

**Proceso**: Similar a Shipment Notice
- file_id = 15

**Configuración**:
```json
{
  "name": "sendAutomaticOrderDelivery",
  "params": {
    "enable": 0
  }
}
```

---

### 5. gelymar-availability-notice (sendAvailableNotice.js)
**Propósito**: Envío automático de Avisos de Disponibilidad

**Horario**: Configurable (por defecto deshabilitado)

**Proceso**: Similar a Shipment Notice
- file_id = 6

**Configuración**:
```json
{
  "name": "sendAutomaticOrderAvailability",
  "params": {
    "enable": 0
  }
}
```

---

### 6. gelymar-db-backup (sendDbBackup.js)
**Propósito**: Backup automático de base de datos MySQL

**Horario**: Configurable

**Proceso**:
1. Ejecuta mysqldump
2. Comprime archivo SQL
3. Envía por email a administradores
4. Limpia backups antiguos

---

### 7. gelymar-admin-notifications (sendAdminNotifications.js)
**Propósito**: Resumen de notificaciones para administradores

**Horario**: Configurable

**Proceso**:
1. Recopila estadísticas del día
2. Cuenta mensajes no leídos
3. Lista órdenes nuevas
4. Envía resumen por email a admins

## Configuración Dinámica

### Tabla: cron_tasks_config
```sql
CREATE TABLE cron_tasks_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_name VARCHAR(100) UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Tareas configurables**:
- `check_client_access`
- `check_default_files`

### Tabla: config
```sql
CREATE TABLE config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE,
  params JSON,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Configuraciones de notificaciones**:
- `sendAutomaticOrderReception`
- `sendAutomaticOrderShipment`
- `sendAutomaticOrderDelivery`
- `sendAutomaticOrderAvailability`

## Gestión de Cron Jobs

### Ver estado de jobs
```bash
pm2 list
```

### Ver logs de un job específico
```bash
pm2 logs gelymar-order-reception
pm2 logs gelymar-cron-sequence
```

### Reiniciar un job
```bash
pm2 restart gelymar-order-reception
```

### Detener un job
```bash
pm2 stop gelymar-order-reception
```

### Ejecutar manualmente (sin esperar horario)
```bash
# Desde el contenedor
node Cronjob/cron/sendOrderReception.js execute-now
node Cronjob/cron/cronMaster.js execute-now
```

## Habilitar/Deshabilitar Jobs

### Desde API (Admin only)
```bash
# Obtener configuración actual
curl -X GET http://localhost:3000/api/cron/tasks-config \
  -H "Authorization: Bearer YOUR_TOKEN"

# Actualizar configuración
curl -X PUT http://localhost:3000/api/cron/tasks-config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "check_client_access": true,
    "check_default_files": false
  }'
```

### Desde Base de Datos
```sql
-- Deshabilitar tarea
UPDATE cron_tasks_config 
SET is_enabled = 0 
WHERE task_name = 'check_client_access';

-- Habilitar tarea
UPDATE cron_tasks_config 
SET is_enabled = 1 
WHERE task_name = 'check_default_files';
```

## Logging de Cron Jobs

### Formato de Logs
```javascript
logCronJob('sendOrderReception', 'START', { ordersCount: 10 });
logCronJob('sendOrderReception', 'COMPLETE', { processed: 8, failed: 2 });
logCronJob('sendOrderReception', 'ERROR', { error: error.message });
```

### Salida de Log
```
[2024-01-15T10:00:00.000Z] -> Logger Process -> CRON_JOB: sendOrderReception - START
[2024-01-15T10:00:05.000Z] -> Logger Process -> CRON_JOB: sendOrderReception - COMPLETE
```

## Detección de Entorno

### Variables de Entorno
```bash
# Docker
DOCKER_ENV=true
BACKEND_API_URL=http://backend:3000

# Servidor Ubuntu (172.20.10.151)
BACKEND_API_URL=http://backend:3000

# Desarrollo local
BACKEND_API_URL=http://localhost:3000
```

### Auto-detección
```javascript
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

const isDocker = process.env.DOCKER_ENV === 'true';
```

## Manejo de Errores

### Estrategia
- Cada job captura sus propios errores
- Errores se loguean pero no detienen el proceso
- Jobs continúan ejecutándose en próximo horario programado
- PM2 reinicia automáticamente si el proceso falla

### Ejemplo
```javascript
cron.schedule('0 10 * * *', async () => {
  try {
    await processNewOrdersAndSendEmails();
  } catch (error) {
    logger.error(`[sendOrderReception] Error: ${error.message}`);
    // No re-throw, permitir que cron continúe
  }
});
```

## Timeouts

### HTTP Requests a Backend
```javascript
const response = await axios.post(url, {}, {
  timeout: 300000, // 5 minutos
  family: 4,       // Forzar IPv4
  headers: {
    'Content-Type': 'application/json'
  }
});
```

## Señal de Ready

Cada job emite señal `ready` a PM2 cuando está listo:
```javascript
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};
```

Esto permite a PM2 saber que el proceso está funcionando correctamente.

## Consideraciones de Performance

- Jobs no bloquean entre sí (ejecución independiente)
- Timeout de 5 minutos por operación HTTP
- Espera de 2 segundos entre tareas en cronMaster
- Logs rotativos para evitar llenar disco
- Limpieza automática de archivos temporales
