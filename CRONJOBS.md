# Cronjobs - Descripción, servicios y horarios

> **Fuente**: `Cronjob/cron/*.js` y endpoints del backend.
> **Hora local**: según la zona horaria configurada en el contenedor cron.

## Resumen rápido

| Cron | Archivo | Endpoint/Servicio | Horario |
|---|---|---|---|
| Cron Master | `Cronjob/cron/cronMaster.js` | `/api/cron/check-client-access`, `/api/cron/generate-default-files` | **07:00** diario |
| Order Reception | `Cronjob/cron/sendOrderReception.js` | `/api/cron/process-new-orders` | **10:00** diario |
| Shipment Notice | `Cronjob/cron/sendShipmentNotice.js` | `/api/cron/process-shipment-notices` | **10:00** diario |
| Order Delivery Notice | `Cronjob/cron/sendOrderDeliveryNotice.js` | `/api/cron/process-order-delivery-notices` | **10:00** diario |
| Availability Notice | `Cronjob/cron/sendAvailableNotice.js` | `/api/cron/process-availability-notices` | **10:00** diario |
| Admin Notifications | `Cronjob/cron/sendAdminNotifications.js` | `/api/cron/send-admin-notification-summary` | **09:00** diario |
| DB Backup | `Cronjob/cron/sendDbBackup.js` | `mysqldump` directo | **02:00** diario |

## Detalle por cron

### 1) Cron Master
- **Archivo**: `Cronjob/cron/cronMaster.js`
- **Horario**: `0 7 * * *` (07:00 diario)
- **Qué hace**: Ejecuta una secuencia de tareas habilitadas desde la configuración del backend.
- **Config**: `/api/cron/tasks-config` (usa flags habilitadas/deshabilitadas).
- **Servicios/Endpoints**:
  - `POST /api/cron/check-client-access`  
    Servicio: `checkClientAccessService.checkClientAccess`  
    Descripción: crea usuarios para clientes/sellers sin acceso, usando RUT desde SQL Server + tablas de usuarios en MySQL.
  - `POST /api/cron/generate-default-files`  
    Servicio: `checkDefaultFilesService.generateDefaultFiles`  
    Descripción: crea registros por defecto en `order_files` y directorios en fileserver si faltan documentos.

### 2) Order Reception (recepción de órdenes)
- **Archivo**: `Cronjob/cron/sendOrderReception.js`
- **Horario**: `0 10 * * *` (10:00 diario)
- **Endpoint**: `POST /api/cron/process-new-orders`
- **Qué hace**: Procesa órdenes nuevas y envía correo de recepción (si está habilitado en config).  
  Logica está en backend (documentFile.controller).

### 3) Shipment Notice
- **Archivo**: `Cronjob/cron/sendShipmentNotice.js`
- **Horario**: `0 10 * * *` (10:00 diario)
- **Endpoint**: `POST /api/cron/process-shipment-notices`
- **Qué hace**: Genera y envía Shipment Notice cuando corresponde.

### 4) Order Delivery Notice
- **Archivo**: `Cronjob/cron/sendOrderDeliveryNotice.js`
- **Horario**: `0 10 * * *` (10:00 diario)
- **Endpoint**: `POST /api/cron/process-order-delivery-notices`
- **Qué hace**: Genera y envía Order Delivery Notice cuando corresponde.

### 5) Availability Notice
- **Archivo**: `Cronjob/cron/sendAvailableNotice.js`
- **Horario**: `0 10 * * *` (10:00 diario)
- **Endpoint**: `POST /api/cron/process-availability-notices`
- **Qué hace**: Genera y envía Availability Notice cuando corresponde.

### 6) Admin Notifications Summary
- **Archivo**: `Cronjob/cron/sendAdminNotifications.js`
- **Horario**: `0 9 * * *` (09:00 diario)
- **Endpoint**: `POST /api/cron/send-admin-notification-summary`
- **Qué hace**: Envía un resumen diario (clientes sin cuenta, órdenes con docs faltantes, etc.).

### 7) DB Backup
- **Archivo**: `Cronjob/cron/sendDbBackup.js`
- **Horario**: `0 2 * * *` (02:00 diario)
- **Qué hace**: Ejecuta `mysqldump` del esquema configurado por `MYSQL_DB_*` y guarda `.sql.gz`.
- **Destino**: `DB_BACKUP_DIR` o `/var/backups/gelymar`.

## Ejecución manual
Todos los cron que usan backend aceptan `execute-now` como argumento:

```bash
node Cronjob/cron/cronMaster.js execute-now
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

