---
inclusion: always
---

# Backend - Servicios

## Servicios Principales

### order.service.js
**Propósito**: Gestión de órdenes desde SQL Server (Softkey)

**Funciones clave**:
```javascript
// Obtener órdenes con filtros
getOrdersByFilters({ customerRut, salesRut })

// Datos para generación de PDF
getOrderWithCustomerForPdf(pc, oc, factura, idNroOvMasFactura)
getOrderDetailForPdf(pc, oc, factura, idNroOvMasFactura)
getOrderItemsByPcOcFactura(pc, oc, factura, idNroOvMasFactura)

// Resolución de identificadores
resolveIdNroOvMasFactura(pc, oc, factura)
getOrderPcOcById(orderId)
```

**Características**:
- Consulta directa a SQL Server (vistas Softkey)
- Usa mappers (hdr.mapper.js, item.mapper.js)
- Maneja órdenes parciales (mismo PC/OC, diferente factura)
- Filtrado por vendedor mediante tabla `sellers` en MySQL
- Normaliza OC para comparación (remueve espacios, guiones, paréntesis)

---

### customer.service.js
**Propósito**: Gestión de clientes (combina MySQL + SQL Server)

**Funciones clave**:
```javascript
// Consultas de clientes
getAllCustomers({ salesRut })
getCustomerByRut(rut)
getCustomerByRutFromSql(rut)
getCustomersWithoutAccount()

// Gestión de contactos
createCustomerContacts(rut, contacts)
getContactsByCustomerRut(rut)
updateCustomerContact(rut, idx, data)
deleteCustomerContact(rut, idx)

// Validación de acceso
sellerHasAccessToCustomerRut(sellerRut, customerRut)
```

**Características**:
- Datos maestros desde SQL Server (jor_imp_CLI_01_softkey)
- Contactos y permisos desde MySQL (customer_contacts)
- Normaliza RUT (remueve sufijo 'C')
- Maneja JSON array de contactos adicionales
- Valida acceso de vendedores a clientes

---

### documentFile.service.js
**Propósito**: Gestión de archivos de documentos

**Funciones clave**:
```javascript
// Datos para PDFs
getOrderWithCustomerForPdf(pc, oc, factura, idNroOvMasFactura)
getOrderDetailForPdf(pc, oc, factura, idNroOvMasFactura)
getOrderItemsByPcOcFactura(pc, oc, factura, idNroOvMasFactura)

// Gestión de archivos
getLastFileIdentifierByPc(pc)
resolveIdNroOvMasFactura(pc, oc, factura)

// Validación de acceso
getCustomerCheckForViewFile(fileId, userId)
getCustomerCheckForDownload(fileId, userId)
getFileCustomerCheck(fileId, customerRut)
```

**Características**:
- Consulta SQL Server para datos de órdenes
- Consulta MySQL para archivos y permisos (order_files)
- Valida acceso por RUT de cliente
- Maneja file_identifier secuencial (ORN-1, ORN-2, etc.)
- Verifica is_visible_to_client antes de permitir acceso

---

### email.service.js
**Propósito**: Envío de emails con plantillas Handlebars

**Funciones clave**:
```javascript
// Envío de documentos
sendFileToClient(file, options)

// Notificaciones
sendChatNotification({ adminEmail, customerName, message, portalUrl })
sendPasswordReset({ email, resetToken, portalUrl })
```

**Características**:
- Plantillas Handlebars (Backend/mail-generator/template/)
- Internacionalización (i18n: es/en)
- Validación de permisos de contactos:
  - `sh_documents`: Documentos manuales (is_generated=0)
  - `reports`: Documentos generados (is_generated=1)
  - `cco`: Siempre recibe copia
- SMTP Office365 (smtp.office365.com:587)
- Manejo de errores: EMAIL_PERMISSION_DENIED

**Lógica de permisos**:
```javascript
// Documento manual
if (is_generated === 0) {
  recipients = contacts.filter(c => c.sh_documents || c.cco)
}

// Documento generado
if (is_generated === 1) {
  recipients = contacts.filter(c => c.reports || c.cco)
}
```

---

### chat.service.js
**Propósito**: Sistema de chat en tiempo real

**Funciones clave**:
```javascript
// Mensajes
sendMessage(messageData)
getCustomerMessages(customerId, limit)
getUnreadCount(customerId)
markMessagesAsRead(customerId)

// Admin
getRecentChats(adminId)
getChatSummary(adminId)
markAllAsRead(adminId)

// Notificaciones
notifyAdminOfClientMessage({ customerId, adminId, message })
```

**Características**:
- Mensajes encriptados (AES) en base de datos
- Desencriptación automática al recuperar
- Soporte para texto e imágenes (JSON payload)
- Notificación email a admin offline
- Integración con Socket.io para tiempo real
- Tracking de mensajes no leídos

---

### user.service.js
**Propósito**: Gestión de usuarios y autenticación

**Funciones clave**:
```javascript
// Autenticación
findUserForAuth(userId)
updateUserOnlineStatus(userId, status)

// Admin
getPrimaryAdminPresence()
getSpecificAdminPresence(adminId)
getAdminUserById(adminId)
```

**Características**:
- Maneja roles (admin=1, client=2, seller=3)
- Tracking de presencia online (campo `online`)
- Soporte 2FA (TOTP con speakeasy)
- Actualiza estado offline cuando token expira

---

### checkOrderReception.service.js
**Propósito**: Determina órdenes que necesitan ORN (Order Receipt Notice)

**Funciones clave**:
```javascript
// Configuración
isSendOrderReceptionEnabled()
getSendFromDate(configName)

// Órdenes pendientes
getOrdersReadyForOrderReceiptNotice(sendFromDate, filterPc, filterFactura)

// Emails y idioma
getReportEmailsAndLang(customerRut)
```

**Características**:
- Filtra órdenes SIN factura (orden padre)
- Verifica si ya se envió ORN (campo `fecha_envio`)
- Obtiene configuración desde tabla `config`
- Respeta parámetro `sendFrom` para procesar desde fecha específica
- Solo procesa órdenes que no tienen file_id=9 o no tienen fecha_envio

---

### checkShipmentNotice.service.js
**Propósito**: Determina órdenes que necesitan Aviso de Embarque

**Funciones clave**:
```javascript
isSendOrderShipmentEnabled()
getOrdersWithFacturaAndMissingFiles()
```

**Características**:
- Filtra órdenes CON factura (órdenes parciales)
- Verifica documentos faltantes (file_id: 19=Shipment, 15=Delivery, 6=Availability)
- Procesa solo órdenes que tienen factura válida

---

### checkOrderDeliveryNotice.service.js
**Propósito**: Determina órdenes que necesitan Aviso de Entrega

**Similar a checkShipmentNotice.service.js**
- file_id = 15

---

### checkAvailabilityNotice.service.js
**Propósito**: Determina órdenes que necesitan Aviso de Disponibilidad

**Similar a checkShipmentNotice.service.js**
- file_id = 6

---

### cronConfig.service.js
**Propósito**: Configuración de tareas cron

**Funciones clave**:
```javascript
getCronTasksConfig()
updateCronTaskConfig(taskName, isEnabled)
updateMultipleCronTasksConfig(configs)
```

**Características**:
- Lee/escribe tabla `cron_tasks_config`
- Controla habilitación/deshabilitación de cron jobs
- Permite actualización sin reiniciar servicios

---

### config.service.js
**Propósito**: Configuración general del sistema

**Funciones clave**:
```javascript
getConfigByName(configName)
updateConfig(configName, params)
```

**Características**:
- Almacena configuraciones en tabla `config`
- Parámetros en formato JSON
- Usado por servicios de notificaciones automáticas

**Configuraciones clave**:
- `sendAutomaticOrderReception`: { enable: 1, sendFrom: "2024-01-01" }
- `sendAutomaticOrderShipment`: { enable: 1 }
- `sendAutomaticOrderDelivery`: { enable: 1 }
- `sendAutomaticOrderAvailability`: { enable: 1 }

---

### checkClientAccess.service.js
**Propósito**: Verifica clientes sin cuenta y crea usuarios

**Características**:
- Consulta clientes desde SQL Server
- Verifica si tienen usuario en MySQL
- Crea usuarios automáticamente para clientes sin cuenta
- Ejecutado por cron master

---

### checkDefaultFiles.service.js
**Propósito**: Genera placeholders de documentos para órdenes nuevas

**Características**:
- Crea registros en `order_files` para órdenes sin documentos
- Genera placeholders para los 4 tipos de documentos
- Ejecutado por cron master

---

## Patrones de Uso

### Normalización de Datos
```javascript
// RUT
const normalizeRut = (rut) => {
  return String(rut || '').trim().replace(/C$/i, '');
};

// OC
const normalizeOc = (oc) => {
  return String(oc || '').toUpperCase().replace(/[\s()-]+/g, '');
};

// Fechas (en mappers)
const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

// Decimales (en mappers)
const normalizeDecimal = (value, decimals = 4) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : parseFloat(num.toFixed(decimals));
};
```

### Consultas SQL Server
```javascript
const { getSqlPool, sql } = require('../config/sqlserver');

const sqlPool = await getSqlPool();
const request = sqlPool.request();

// Parámetros tipados
request.input('pc', sql.VarChar, pc);
request.input('rut', sql.VarChar, rut);
request.input('fecha', sql.Date, fecha);

// Consulta
const result = await request.query(`
  SELECT * FROM jor_imp_HDR_90_softkey
  WHERE Nro = @pc AND Rut = @rut
`);

const rows = result.recordset || [];
```

### Consultas MySQL
```javascript
const { poolPromise } = require('../config/db');

const pool = await poolPromise;

// Consulta con parámetros
const [rows] = await pool.query(
  'SELECT * FROM users WHERE rut = ?',
  [rut]
);

// Inserción
const [result] = await pool.query(
  'INSERT INTO order_files (pc, oc, path) VALUES (?, ?, ?)',
  [pc, oc, path]
);
const insertId = result.insertId;

// Actualización
const [result] = await pool.query(
  'UPDATE order_files SET is_visible_to_client = 1 WHERE id = ?',
  [fileId]
);
const affectedRows = result.affectedRows;
```
