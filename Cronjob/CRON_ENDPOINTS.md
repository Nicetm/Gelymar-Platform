# Cron Jobs - Endpoints y Configuración

## Resumen de Endpoints

| # | Cron Job | Endpoint | Método | Parámetros Opcionales |
|---|----------|----------|--------|----------------------|
| 1 | checkDefaultFiles | `/api/cron/create-default-records` | POST | `pc`, `factura` |
| 2 | generatePDFs | `/api/cron/generate-pending-pdfs` | POST | `pc`, `factura` |
| 3 | checkClientAccess | `/api/cron/check-client-access` | POST | ❌ Ninguno |
| 4 | sendOrderReception | `/api/cron/process-new-orders` | POST | ❌ Ninguno |
| 5 | sendShipmentNotice | `/api/cron/process-shipment-notices` | POST | ❌ Ninguno |
| 6 | sendOrderDeliveryNotice | `/api/cron/process-order-delivery-notices` | POST | ❌ Ninguno |
| 7 | sendAvailableNotice | `/api/cron/process-availability-notices` | POST | ❌ Ninguno |
| 8 | sendAdminNotifications | `/api/cron/send-admin-notification-summary` | POST | ❌ Ninguno |

---

## Detalle por Cron Job

### 1. checkDefaultFiles

**Descripción**: Crea registros en `order_files` con `status_id = 1` para documentos por defecto

**Endpoint**: `POST /api/cron/create-default-records`

**Servicio**: `createDefaultRecordsService.createDefaultRecords()`

**Parámetro `param_config`**: `checkDefaultFiles`
```json
{
  "enable": 1,
  "sendFrom": "2025-12-01"
}
```

**URL Directa**:
```
POST http://localhost:3000/api/cron/create-default-records
```

**Parámetros Opcionales** (Body JSON):
```json
{
  "pc": "12345",        // Opcional: Filtrar por PC específico
  "factura": "F001"     // Opcional: Filtrar por factura específica
}
```

**Respuesta Exitosa**:
```json
{
  "success": true,
  "message": "Registros por defecto creados correctamente"
}
```

---

### 2. generatePDFs

**Descripción**: Genera archivos PDF físicos para registros con `status_id = 1`

**Endpoint**: `POST /api/cron/generate-pending-pdfs`

**Servicio**: `generatePendingPDFsService.generatePendingPDFs()`

**Parámetro `param_config`**: `generatePDFs`
```json
{
  "enable": 1,
  "sendFrom": "2025-12-01"
}
```

**URL Directa**:
```
POST http://localhost:3000/api/cron/generate-pending-pdfs
```

**Parámetros Opcionales** (Body JSON):
```json
{
  "pc": "12345",        // Opcional: Filtrar por PC específico
  "factura": "F001"     // Opcional: Filtrar por factura específica
}
```

**Respuesta Exitosa**:
```json
{
  "success": true,
  "message": "PDFs pendientes generados correctamente",
  "pdfsGenerated": 5
}
```

---

### 3. checkClientAccess

**Descripción**: Verifica y crea acceso para clientes sin usuarios

**Endpoint**: `POST /api/cron/check-client-access`

**Servicio**: `checkClientAccessService.checkClientAccess()`

**Parámetro `param_config`**: `checkClientAccess`
```json
{
  "enable": 1,
  "sendFrom": "2025-12-01"
}
```

**URL Directa**:
```
POST http://localhost:3000/api/cron/check-client-access
```

**Parámetros Opcionales**: ❌ Ninguno

**Respuesta Exitosa**:
```json
{
  "success": true,
  "message": "Acceso de clientes verificado correctamente"
}
```

---

### 4. sendOrderReception

**Descripción**: Procesa órdenes nuevas y envía correos de recepción

**Endpoint**: `POST /api/cron/process-new-orders`

**Servicio**: `checkOrderReceptionService` (varios métodos)

**Parámetro `param_config`**: `sendAutomaticOrderReception`
```json
{
  "enable": 1,
  "sendFrom": "2025-12-01"
}
```

**URL Directa**:
```
POST http://localhost:3000/api/cron/process-new-orders
```

**Parámetros Opcionales**: ❌ Ninguno

**Respuesta Exitosa**:
```json
{
  "success": true,
  "processed": 3,
  "skipped": false
}
```

---

### 5. sendShipmentNotice

**Descripción**: Genera y envía Shipment Notice cuando corresponde

**Endpoint**: `POST /api/cron/process-shipment-notices`

**Servicio**: `checkShipmentNoticeService`

**Parámetro `param_config`**: `sendAutomaticOrderShipment`
```json
{
  "enable": 1,
  "sendFrom": "2025-12-01"
}
```

**URL Directa**:
```
POST http://localhost:3000/api/cron/process-shipment-notices
```

**Parámetros Opcionales**: ❌ Ninguno

**Respuesta Exitosa**:
```json
{
  "success": true,
  "processed": 2
}
```

---

### 6. sendOrderDeliveryNotice

**Descripción**: Genera y envía Order Delivery Notice cuando corresponde

**Endpoint**: `POST /api/cron/process-order-delivery-notices`

**Servicio**: `checkOrderDeliveryNoticeService`

**Parámetro `param_config`**: `sendAutomaticOrderDelivery`
```json
{
  "enable": 1,
  "sendFrom": "2025-12-01"
}
```

**URL Directa**:
```
POST http://localhost:3000/api/cron/process-order-delivery-notices
```

**Parámetros Opcionales**: ❌ Ninguno

**Respuesta Exitosa**:
```json
{
  "success": true,
  "processed": 4
}
```

---

### 7. sendAvailableNotice

**Descripción**: Genera y envía Availability Notice cuando corresponde

**Endpoint**: `POST /api/cron/process-availability-notices`

**Servicio**: `checkAvailabilityNoticeService`

**Parámetro `param_config`**: `sendAutomaticOrderAvailability`
```json
{
  "enable": 1,
  "sendFrom": "2025-12-01"
}
```

**URL Directa**:
```
POST http://localhost:3000/api/cron/process-availability-notices
```

**Parámetros Opcionales**: ❌ Ninguno

**Respuesta Exitosa**:
```json
{
  "success": true,
  "processed": 1
}
```

---

### 8. sendAdminNotifications

**Descripción**: Envía resumen diario de notificaciones a administradores

**Endpoint**: `POST /api/cron/send-admin-notification-summary`

**Servicio**: `adminNotificationSummaryService.sendDailyAdminNotificationSummary()`

**Parámetros `param_config`**: 
- `headerOrdenesSinDocumentos`
- `headerUsersSinCuenta`

**URL Directa**:
```
POST http://localhost:3000/api/cron/send-admin-notification-summary
```

**Parámetros Opcionales**: ❌ Ninguno

**Respuesta Exitosa**:
```json
{
  "success": true,
  "processed": 2,
  "skipped": false
}
```

---

## Ejecución Manual desde Terminal

Todos los cron jobs soportan ejecución inmediata con el argumento `execute-now`:

```bash
# Ejecutar checkDefaultFiles
node Cronjob/cron/checkDefaultFiles.js execute-now

# Ejecutar generatePDFs
node Cronjob/cron/generatePDFs.js execute-now

# Ejecutar checkClientAccess
node Cronjob/cron/checkClientAccess.js execute-now

# Ejecutar sendOrderReception
node Cronjob/cron/sendOrderReception.js execute-now

# Ejecutar sendShipmentNotice
node Cronjob/cron/sendShipmentNotice.js execute-now

# Ejecutar sendOrderDeliveryNotice
node Cronjob/cron/sendOrderDeliveryNotice.js execute-now

# Ejecutar sendAvailableNotice
node Cronjob/cron/sendAvailableNotice.js execute-now

# Ejecutar sendAdminNotifications
node Cronjob/cron/sendAdminNotifications.js execute-now

# Ejecutar sendDbBackup
node Cronjob/cron/sendDbBackup.js execute-now
```

---

## Horarios de Ejecución

| Cron Job | Horario | Expresión Cron |
|----------|---------|----------------|
| sendDbBackup | 02:00 | `0 2 * * *` |
| sendAdminNotifications | 09:00 | `0 9 * * *` |
| sendShipmentNotice | 15:35 | `35 15 * * *` |
| sendOrderDeliveryNotice | 15:45 | `45 15 * * *` |
| checkDefaultFiles | 15:47 | `47 15 * * *` |
| checkClientAccess | 15:47 | `47 15 * * *` |
| sendAvailableNotice | 15:55 | `55 15 * * *` |
| generatePDFs | 16:00 | `0 16 * * *` |
| sendOrderReception | 16:15 | `15 16 * * *` |

---

## Notas Importantes

1. **Orden de Ejecución**: `checkDefaultFiles` debe ejecutarse antes que `generatePDFs` (15:47 → 16:00)

2. **Configuración `enable`**: 
   - `enable = 1` → Cron job se ejecuta
   - `enable = 0` → Cron job se salta

3. **Configuración `sendFrom`**: 
   - Filtra registros/órdenes desde la fecha especificada
   - Formato: `YYYY-MM-DD`
   - Si no existe o es `null`, procesa todos los registros

4. **Parámetros Opcionales**:
   - Solo `checkDefaultFiles` y `generatePDFs` aceptan filtros por `pc` y `factura`
   - Los demás cron jobs no aceptan parámetros

5. **Respuestas de Error**:
   ```json
   {
     "success": false,
     "error": "Mensaje de error detallado"
   }
   ```


---

## Endpoint de Autenticación

### Generar Token JWT

**Descripción**: Genera un token JWT válido con usuario y contraseña (sin 2FA)

**Endpoint**: `POST /api/auth/generate-token`

**URL Directa**:
```
POST http://localhost:3000/api/auth/generate-token
```

**Body JSON**:
```json
{
  "email": "usuario@ejemplo.com",
  "password": "tu_contraseña"
}
```

O usando username:
```json
{
  "username": "nombre_usuario",
  "password": "tu_contraseña"
}
```

**Respuesta Exitosa**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "rut": "12345678-9",
    "username": "usuario",
    "role": "admin"
  }
}
```

**Respuestas de Error**:
```json
{
  "message": "Credenciales inválidas"
}
```

```json
{
  "message": "Cuenta bloqueada",
  "error": "ACCOUNT_BLOCKED"
}
```

**Uso del Token**:
Una vez generado, usa el token en los headers de tus requests:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
