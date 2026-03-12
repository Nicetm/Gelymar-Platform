# Cronjobs - Descripción, servicios y horarios

> **Fuente**: `Cronjob/cron/*.js` y endpoints del backend.
> **Hora local**: según la zona horaria configurada en el contenedor cron.

## Resumen rápido

| Cron | Archivo | Endpoint/Servicio | Horario |
|---|---|---|---|
| Check Default Files | `Cronjob/cron/checkDefaultFiles.js` | `/api/cron/create-default-records` | **15:47** diario |
| Generate PDFs | `Cronjob/cron/generatePDFs.js` | `/api/cron/generate-pending-pdfs` | **16:00** diario |
| Check Client Access | `Cronjob/cron/checkClientAccess.js` | `/api/cron/check-client-access` | **15:47** diario |
| Order Reception | `Cronjob/cron/sendOrderReception.js` | `/api/cron/process-new-orders` | **10:00** diario |
| Shipment Notice | `Cronjob/cron/sendShipmentNotice.js` | `/api/cron/process-shipment-notices` | **10:00** diario |
| Order Delivery Notice | `Cronjob/cron/sendOrderDeliveryNotice.js` | `/api/cron/process-order-delivery-notices` | **10:00** diario |
| Availability Notice | `Cronjob/cron/sendAvailableNotice.js` | `/api/cron/process-availability-notices` | **10:00** diario |
| Admin Notifications | `Cronjob/cron/sendAdminNotifications.js` | `/api/cron/send-admin-notification-summary` | **09:00** diario |
| DB Backup | `Cronjob/cron/sendDbBackup.js` | `mysqldump` directo | **02:00** diario |

## Detalle por cron

### 1) Check Default Files
- **Archivo**: `Cronjob/cron/checkDefaultFiles.js`
- **Horario**: `47 15 * * *` (15:47 diario)
- **Endpoint**: `POST /api/cron/create-default-records`
- **Qué hace**: Crea registros en `order_files` con `status_id = 1` para documentos por defecto según incoterm y factura.
- **Servicio**: `createDefaultRecordsService.createDefaultRecords`
- **Config**: Lee parámetro `checkDefaultFiles` desde `param_config` (enable: 1/0).

### 2) Generate PDFs
- **Archivo**: `Cronjob/cron/generatePDFs.js`
- **Horario**: `0 16 * * *` (16:00 diario)
- **Endpoint**: `POST /api/cron/generate-pending-pdfs`
- **Qué hace**: Genera archivos PDF físicos para registros con `status_id = 1` y actualiza a `status_id = 2`.
- **Servicio**: `generatePendingPDFsService.generatePendingPDFs`
- **Config**: Lee parámetro `generatePDFs` desde `param_config` (enable: 1/0).

### 3) Check Client Access
- **Archivo**: `Cronjob/cron/checkClientAccess.js`
- **Horario**: `47 15 * * *` (15:47 diario)
- **Endpoint**: `POST /api/cron/check-client-access`
- **Qué hace**: Crea usuarios para clientes/sellers sin acceso, usando RUT desde SQL Server + tablas de usuarios en MySQL.
- **Servicio**: `checkClientAccessService.checkClientAccess`
- **Config**: Lee parámetro `checkClientAccess` desde `param_config` (enable: 1/0).

### 4) Order Reception (recepción de órdenes)
- **Archivo**: `Cronjob/cron/sendOrderReception.js`
- **Horario**: `0 10 * * *` (10:00 diario)
- **Endpoint**: `POST /api/cron/process-new-orders`
- **Qué hace**: Procesa órdenes nuevas y envía correo de recepción (si está habilitado en config).  
  Logica está en backend (documentFile.controller).

### 5) Shipment Notice
- **Archivo**: `Cronjob/cron/sendShipmentNotice.js`
- **Horario**: `0 10 * * *` (10:00 diario)
- **Endpoint**: `POST /api/cron/process-shipment-notices`
- **Qué hace**: Genera y envía Shipment Notice cuando corresponde.

### 6) Order Delivery Notice
- **Archivo**: `Cronjob/cron/sendOrderDeliveryNotice.js`
- **Horario**: `0 10 * * *` (10:00 diario)
- **Endpoint**: `POST /api/cron/process-order-delivery-notices`
- **Qué hace**: Genera y envía Order Delivery Notice cuando corresponde.

### 7) Availability Notice
- **Archivo**: `Cronjob/cron/sendAvailableNotice.js`
- **Horario**: `0 10 * * *` (10:00 diario)
- **Endpoint**: `POST /api/cron/process-availability-notices`
- **Qué hace**: Genera y envía Availability Notice cuando corresponde.

### 8) Admin Notifications Summary
- **Archivo**: `Cronjob/cron/sendAdminNotifications.js`
- **Horario**: `0 9 * * *` (09:00 diario)
- **Endpoint**: `POST /api/cron/send-admin-notification-summary`
- **Qué hace**: Envía un resumen diario (clientes sin cuenta, órdenes con docs faltantes, etc.).

### 9) DB Backup
- **Archivo**: `Cronjob/cron/sendDbBackup.js`
- **Horario**: `0 2 * * *` (02:00 diario)
- **Qué hace**: Ejecuta `mysqldump` del esquema configurado por `MYSQL_DB_*` y guarda `.sql.gz`.
- **Destino**: `DB_BACKUP_DIR` o `/var/backups/gelymar`.

## Ejecución manual
Todos los cron que usan backend aceptan `execute-now` como argumento:

```bash
node Cronjob/cron/checkDefaultFiles.js execute-now
node Cronjob/cron/generatePDFs.js execute-now
node Cronjob/cron/checkClientAccess.js execute-now
node Cronjob/cron/sendOrderReception.js execute-now
node Cronjob/cron/sendShipmentNotice.js execute-now
node Cronjob/cron/sendOrderDeliveryNotice.js execute-now
node Cronjob/cron/sendAvailableNotice.js execute-now
node Cronjob/cron/sendAdminNotifications.js execute-now
```

El backup también soporta:

```bash
node Cronjob/cron/sendDbBackup.js execute-now
```
