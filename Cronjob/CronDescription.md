# Cron Jobs - Endpoints y Configuración

## Configuración de Horarios

Todos los cron jobs leen su horario de ejecución desde la tabla `param_config` en el campo `schedule`. Esto permite cambiar los horarios sin modificar código.

**Formato del horario**: `HH:MM` (24 horas)

**Ejemplo de configuración en `param_config`**:
```json
{
  "enable": 1,
  "sendFrom": "2025-12-01",
  "schedule": "23:15"
}
```

**Para cambiar el horario de un cron**:
```sql
UPDATE param_config 
SET params = JSON_SET(params, '$.schedule', '22:00') 
WHERE name = 'checkDefaultFiles';
```

Luego reiniciar el proceso PM2:
```bash
pm2 restart gelymar-check-default-files
```

---

## Resumen de Endpoints y Configuración

| # | Cron Job | Endpoint | Método | Parámetro Config | Horario Default | Parámetros Opcionales |
|---|----------|----------|--------|------------------|-----------------|----------------------|
| 1 | checkDefaultFiles | `/api/cron/create-default-records` | POST | `checkDefaultFiles` | 22:50 | `pc`, `factura` |
| 2 | generatePDFs | `/api/cron/generate-pending-pdfs` | POST | `generatePDFs` | 23:15 | `pc`, `factura` |
| 3 | checkClientAccess | `/api/cron/check-client-access` | POST | `checkClientAccess` | N/A | ❌ Ninguno |
| 4 | sendOrderReception | `/api/cron/process-new-orders` | POST | `sendAutomaticOrderReception` | 23:20 | `pc` |
| 5 | sendShipmentNotice | `/api/cron/process-shipment-notices` | POST | `sendAutomaticOrderShipment` | 23:25 | `pc`, `factura` |
| 6 | sendOrderDeliveryNotice | `/api/cron/process-order-delivery-notices` | POST | `sendAutomaticOrderDelivery` | 23:30 | `pc`, `factura` |
| 7 | sendAvailableNotice | `/api/cron/process-availability-notices` | POST | `sendAutomaticOrderAvailability` | 23:35 | `pc`, `factura` |
| 8 | sendAdminNotifications | `/api/cron/send-admin-notification-summary` | POST | N/A | 16:00 | ❌ Ninguno |

**Notas**:
- Todos los crons verifican si están habilitados (`enable: 1`) antes de ejecutarse
- El campo `sendFrom` filtra órdenes por fecha (`h.Fecha >= sendFrom`)
- El campo `schedule` define el horario de ejecución (formato `HH:MM`)
- Si no hay `schedule` en la BD, se usa el horario default

---

## Detalle por Cron Job

### 1. checkDefaultFiles

**Descripción**: Crea registros de documentos por defecto en la tabla `order_files` para las órdenes. NO genera los PDFs físicos, solo crea los registros en la base de datos.

**Endpoint**: `POST /api/cron/create-default-records`

**Servicio**: `createDefaultRecordsService.createDefaultRecords()`

**Parámetro `param_config`**: `checkDefaultFiles`
```json
{
  "enable": 1,
  "sendFrom": "2025-12-01",
  "schedule": "22:50"
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

**Funcionamiento Detallado**:

1. **Obtiene todas las órdenes** agrupadas por RUT del cliente desde SQL Server

2. **Determina qué documentos crear** según:
   - Si la orden tiene factura o no
   - El incoterm de la orden
   - Si es una orden parcial (múltiples facturas para el mismo PC|OC)

3. **Tipos de documentos que puede crear**:
   - **Order Receipt Notice** (file_id: 9) - Para órdenes sin factura o la primera de una orden parcial
   - **Shipment Notice** (file_id: 19) - Para órdenes con factura y incoterms de envío (CFR, CIF, CIP, DAP, DDP, CPT)
   - **Order Delivery Notice** (file_id: 15) - Para órdenes con factura y fecha ETA
   - **Availability Notice** (file_id: 6) - Para órdenes con factura y incoterms de disponibilidad (EWX, FCA, FOB, FCA PORT, FCA WAREHOUSE SANTIAGO, FCA AIRPORT, FCAWSTGO)

4. **Lógica de creación de documentos**:
   - **Orden sin factura**: Crea solo "Order Receipt Notice"
   - **Orden con factura**: Evalúa el incoterm y fechas para determinar qué documentos crear
   - **Orden parcial sin factura**: Crea "Order Receipt Notice" solo para la orden padre (la más antigua)
   - **Orden parcial con factura**: Crea documentos según incoterm para cada factura

5. **Actualización de Order Receipt Notice existente**:
   - Si una orden inicialmente sin factura ahora tiene factura asignada
   - ANTES de crear los nuevos documentos (Shipment, Delivery, Availability)
   - Actualiza el ORN existente que tiene `factura=NULL` para asignarle la factura correspondiente
   - Esto asegura que todos los documentos de la orden tengan la misma factura
   - Ejemplo: ORN creado con `factura=NULL` → Orden recibe `factura=1019292` → ORN se actualiza a `factura=1019292`

6. **Verifica documentos existentes** usando `file_id` para evitar duplicados

7. **Crea el directorio físico** en el servidor de archivos si no existe: `/uploads/CLIENTE_NOMBRE/PC/`

8. **Inserta registros en `order_files`** con:
   - `pc`, `oc`, `factura` de la orden
   - `rut` del cliente (obtenido de SQL Server)
   - `status_id = 1` (Por Generar)
   - `is_visible_to_client = 0` (No visible para el cliente)
   - `file_type = 'PDF'`
   - Sin ruta de archivo físico (solo el directorio base)
   - `file_identifier` único generado automáticamente
   - `was_sent = NULL` (No enviado)

**Importante**:
- NO genera PDFs físicos, solo crea los registros
- Guarda el RUT del cliente en cada registro para uso posterior
- Los PDFs se generan después por `generatePDFs`
- Procesa en lotes de 10 clientes para evitar problemas de memoria
- Registra eventos en `document_events` para auditoría
- Actualiza automáticamente el ORN cuando una orden recibe factura

---

### 2. generatePDFs

**Descripción**: Genera archivos PDF físicos para registros pendientes en `order_files` con `status_id = 1`. Toma los registros creados por `checkDefaultFiles` y genera los documentos PDF reales.

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

**Funcionamiento Detallado**:

1. **Busca registros pendientes** en `order_files` con `status_id = 1` (Por Generar)

2. **Aplica filtros:**
   - Por `pc` específico (opcional)
   - Por `factura` específica (opcional)
   - Por fecha `sendFrom` desde configuración (filtra órdenes desde SQL Server por `h.Fecha`)

3. **Para cada registro pendiente:**
   - Obtiene datos completos de la orden desde SQL Server:
     - **Header** (jor_imp_HDR_90_softkey): PC, OC, RUT, nombre cliente, país, incoterm, tipo, condición de venta, moneda, medio de envío, puerto destino, fecha incoterm, gasto adicional flete
     - **Factura** (jor_imp_FACT_90_softkey): Número, fecha, ETD, ETA, medio de envío, gasto adicional flete (si existe)
     - **Items** (jor_imp_item_90_softkey): Descripción, kg solicitados, kg facturados, precio unitario
   - Determina el idioma según el país del cliente (consulta `country_lang`)
   - Obtiene las traducciones correspondientes del documento

4. **Genera el PDF físico:**
   - Usa el generador correspondiente según `file_id`:
     - `file_id: 9` → `generateRecepcionOrden()` - Order Receipt Notice
     - `file_id: 19` → `generateAvisoEmbarque()` - Shipment Notice
     - `file_id: 15` → `generateAvisoEntrega()` - Order Delivery Notice
     - `file_id: 6` → `generateAvisoDisponibilidad()` - Availability Notice
   - Crea el archivo en el servidor de archivos
   - Formato del nombre: `[Tipo Documento] - [Cliente] - PO [Número].pdf`
   - Ejemplo: `Order Receipt Notice - ACME CORP - PO LA-001-26.pdf`

5. **Actualiza el registro en `order_files`:**
   - Cambia `status_id` de 1 a 2 (Generado)
   - Actualiza `name` con el nombre final del archivo
   - Actualiza `path` con la ruta completa del archivo (directorio + nombre)
   - Establece `fecha_generacion = NOW()`
   - Cambia `is_visible_to_client = 1` (ahora visible para el cliente)
   - Actualiza `updated_at = NOW()`

6. **Registra eventos** en `document_events` para auditoría (éxito o error)

**Importante**:
- Solo procesa registros con `status_id = 1`
- Genera el PDF físico en el servidor de archivos
- Después de generar, el documento queda visible para el cliente
- Procesa registros en orden cronológico (por `created_at ASC`)
- Si el directorio no existe, lo crea automáticamente
- Verifica que el PDF se creó correctamente antes de actualizar el registro
- Continúa con el siguiente registro si hay un error (no detiene el proceso completo)

**Flujo de datos:**
```
checkDefaultFiles (crea registros) 
    ↓
order_files (status_id = 1, sin PDF físico)
    ↓
generatePDFs (genera PDFs)
    ↓
order_files (status_id = 2, con PDF físico, visible para cliente)
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

**Descripción**: Envía correos de recepción de orden para documentos ya generados. NO genera PDFs, solo envía emails de documentos con `status_id = 2`.

**Endpoint**: `POST /api/cron/process-new-orders`

**Servicio**: `checkOrderReceptionService.getOrdersReadyForOrderReceiptNotice()`

**Parámetro `param_config`**: `sendAutomaticOrderReception`
```json
{
  "enable": 1,
  "sendFrom": "2026-03-01"
}
```

**URL Directa**:
```
POST http://localhost:3000/api/cron/process-new-orders
```

**Parámetros Opcionales** (Body JSON):
```json
{
  "pc": "21511"        // Opcional: Filtrar por PC específico
}
```

**Respuesta Exitosa**:
```json
{
  "success": true,
  "processed": 3,
  "errors": 0,
  "skipped": 0,
  "total": 3
}
```

**Funcionamiento Detallado**:

1. **Busca registros listos para enviar** en `order_files`:
   - `file_id = 9` (Order Receipt Notice)
   - `status_id = 2` (PDF ya generado)
   - `was_sent IS NULL OR was_sent = 0` (No enviado)
   - Aplica filtro `pc` si se proporciona

2. **Obtiene el RUT directamente** de la tabla `order_files`:
   - Ya no consulta SQL Server para obtener el RUT
   - El RUT fue guardado por `checkDefaultFiles`

3. **Si hay `sendFromDate`**, valida contra SQL Server:
   - Filtra solo órdenes cuya fecha (`h.Fecha`) sea >= `sendFrom`
   - Esto asegura que solo se procesen órdenes recientes

4. **Para cada registro encontrado:**
   
   a. **Obtiene emails y idioma del cliente:**
   - Usa el RUT de `order_files` para buscar en `customer_contacts`
   - Filtra contactos con `reports = true`
   - Determina el idioma según el país del cliente
   
   b. **Verifica que el PDF esté generado:**
   - Confirma que `status_id = 2`
   - Si no está generado, omite el registro
   
   c. **Envía el email (si está habilitado):**
   - Llama a `sendFileToClient()` con los emails de contactos
   - Adjunta el PDF generado
   
   d. **Actualiza el registro SOLO si el email se envió exitosamente:**
   - Cambia `status_id` de 2 a 3 (Enviado)
   - Establece `was_sent = 1`
   - Actualiza `fecha_envio = NOW()`

5. **Si hay error al enviar:**
   - NO actualiza ningún campo
   - El registro permanece con `status_id = 2` y `was_sent = NULL/0`
   - Se reintentará en la próxima ejecución

**Importante**:
- NO genera PDFs, solo envía emails
- Solo procesa registros con PDF ya generado (`status_id = 2`)
- El RUT viene directamente de `order_files`, no de SQL Server
- Solo actualiza el estado si el email se envió exitosamente
- Si falla el envío, el registro se reintenta en la próxima ejecución
- Registra eventos en `document_events` para auditoría

**Flujo de datos:**
```
checkDefaultFiles → Crea registros (status_id=1, was_sent=NULL, rut guardado)
    ↓
generatePDFs → Genera PDFs (status_id=2, was_sent=NULL)
    ↓
sendOrderReception → Envía emails (status_id=3, was_sent=1)
```

**Estados de `order_files`:**

| status_id | was_sent | Descripción | Proceso |
|-----------|----------|-------------|---------|
| 1 | NULL | Por Generar | `checkDefaultFiles` |
| 2 | NULL/0 | Generado, no enviado | `generatePDFs` |
| 3 | 1 | Generado y enviado | `sendOrderReception` |

---

### 5. sendShipmentNotice

**Descripción**: Envía correos de Shipment Notice para documentos ya generados. NO genera PDFs, solo envía emails de documentos con `status_id = 2`.

**Endpoint**: `POST /api/cron/process-shipment-notices`

**Servicio**: `checkShipmentNoticeService.getOrdersReadyForShipmentNotice()`

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

**Parámetros Opcionales** (Body JSON):
```json
{
  "pc": "21383",        // Opcional: Filtrar por PC específico
  "factura": "1019241"  // Opcional: Filtrar por factura específica
}
```

**Respuesta Exitosa**:
```json
{
  "success": true,
  "processed": 2,
  "errors": 0,
  "skipped": 0
}
```

**Funcionamiento Detallado**:

1. **Busca registros listos para enviar** en `order_files`:
   - `file_id = 19` (Shipment Notice)
   - `status_id = 2` (PDF ya generado)
   - `was_sent IS NULL OR was_sent = 0` (No enviado)
   - Aplica filtros `pc` y/o `factura` si se proporcionan

2. **Obtiene el RUT directamente** de la tabla `order_files`:
   - Ya no consulta SQL Server para obtener el RUT
   - El RUT fue guardado por `checkDefaultFiles`

3. **Valida en SQL Server** que la orden cumpla condiciones:
   - Incoterm válido: CFR, CIF, CIP, DAP, DDP, CPT
   - ETD_ENC_FA y ETA_ENC_FA sean fechas válidas
   - EstadoOV <> 'cancelada'
   - Si hay `sendFromDate`, filtra por `h.Fecha >= sendFrom`

4. **Para cada registro que cumple las condiciones:**
   
   a. **Obtiene emails y idioma del cliente:**
   - Usa el RUT de `order_files` para buscar en `customer_contacts`
   - Filtra contactos con `reports = true`
   - Determina el idioma según el país del cliente
   
   b. **Verifica que el PDF esté generado:**
   - Confirma que `status_id = 2`
   - Si no está generado, omite el registro
   
   c. **Envía el email (si está habilitado):**
   - Llama a `sendFileToClient()` con los emails de contactos
   - Adjunta el PDF generado
   
   d. **Actualiza el registro SOLO si el email se envió exitosamente:**
   - Cambia `status_id` de 2 a 3 (Enviado)
   - Establece `was_sent = 1`
   - Actualiza `fecha_envio = NOW()`

5. **Si hay error al enviar:**
   - NO actualiza ningún campo
   - El registro permanece con `status_id = 2` y `was_sent = NULL/0`
   - Se reintentará en la próxima ejecución

**Importante**:
- NO genera PDFs, solo envía emails
- Solo procesa registros con PDF ya generado (`status_id = 2`)
- El RUT viene directamente de `order_files`, no de SQL Server
- Valida en SQL Server: Incoterms y fechas ETD/ETA válidas
- Solo actualiza el estado si el email se envió exitosamente
- Si falla el envío, el registro se reintenta en la próxima ejecución
- Registra eventos en `document_events` para auditoría

**Flujo de datos:**
```
checkDefaultFiles → Crea registros (status_id=1, was_sent=NULL, rut guardado)
    ↓
generatePDFs → Genera PDFs (status_id=2, was_sent=NULL)
    ↓
sendShipmentNotice → Envía emails (status_id=3, was_sent=1)
```

**Estados de `order_files`:**

| status_id | was_sent | Descripción | Proceso |
|-----------|----------|-------------|---------|
| 1 | NULL | Por Generar | `checkDefaultFiles` |
| 2 | NULL/0 | Generado, no enviado | `generatePDFs` |
| 3 | 1 | Generado y enviado | `sendShipmentNotice` |

---

### 6. sendOrderDeliveryNotice

**Descripción**: Envía correos de Order Delivery Notice para documentos ya generados. NO genera PDFs, solo envía emails de documentos con `status_id = 2`.

**Endpoint**: `POST /api/cron/process-order-delivery-notices`

**Servicio**: `checkOrderDeliveryNoticeService.getOrdersReadyForOrderDeliveryNotice()`

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

**Parámetros Opcionales** (Body JSON):
```json
{
  "pc": "21383",        // Opcional: Filtrar por PC específico
  "factura": "1019241"  // Opcional: Filtrar por factura específica
}
```

**Respuesta Exitosa**:
```json
{
  "success": true,
  "processed": 4,
  "errors": 0,
  "skipped": 0
}
```

**Funcionamiento Detallado**:

1. **Busca registros listos para enviar** en `order_files`:
   - `file_id = 15` (Order Delivery Notice)
   - `status_id = 2` (PDF ya generado)
   - `was_sent IS NULL OR was_sent = 0` (No enviado)
   - Aplica filtros `pc` y/o `factura` si se proporcionan

2. **Obtiene el RUT directamente** de la tabla `order_files`:
   - Ya no consulta SQL Server para obtener el RUT
   - El RUT fue guardado por `checkDefaultFiles`

3. **Valida en SQL Server** que la orden cumpla condiciones:
   - Tiene factura válida
   - ETA_ENC_FA es una fecha válida
   - ETA + 7 días <= fecha actual (listo para entrega)
   - EstadoOV <> 'cancelada'
   - Si hay `sendFromDate`, filtra por `h.Fecha >= sendFrom`

4. **Para cada registro que cumple las condiciones:**
   
   a. **Obtiene emails y idioma del cliente:**
   - Usa el RUT de `order_files` para buscar en `customer_contacts`
   - Filtra contactos con `reports = true`
   - Determina el idioma según el país del cliente
   
   b. **Verifica que el PDF esté generado:**
   - Confirma que `status_id = 2`
   - Si no está generado, omite el registro
   
   c. **Envía el email (si está habilitado):**
   - Llama a `sendFileToClient()` con los emails de contactos
   - Adjunta el PDF generado
   
   d. **Actualiza el registro SOLO si el email se envió exitosamente:**
   - Cambia `status_id` de 2 a 3 (Enviado)
   - Establece `was_sent = 1`
   - Actualiza `fecha_envio = NOW()`

5. **Si hay error al enviar:**
   - NO actualiza ningún campo
   - El registro permanece con `status_id = 2` y `was_sent = NULL/0`
   - Se reintentará en la próxima ejecución

**Importante**:
- NO genera PDFs, solo envía emails
- Solo procesa registros con PDF ya generado (`status_id = 2`)
- El RUT viene directamente de `order_files`, no de SQL Server
- Valida en SQL Server: Fecha ETA + 7 días
- Solo actualiza el estado si el email se envió exitosamente
- Si falla el envío, el registro se reintenta en la próxima ejecución
- Registra eventos en `document_events` para auditoría

**Flujo de datos:**
```
checkDefaultFiles → Crea registros (status_id=1, was_sent=NULL, rut guardado)
    ↓
generatePDFs → Genera PDFs (status_id=2, was_sent=NULL)
    ↓
sendOrderDeliveryNotice → Envía emails (status_id=3, was_sent=1)
```

**Estados de `order_files`:**

| status_id | was_sent | Descripción | Proceso |
|-----------|----------|-------------|---------|
| 1 | NULL | Por Generar | `checkDefaultFiles` |
| 2 | NULL/0 | Generado, no enviado | `generatePDFs` |
| 3 | 1 | Generado y enviado | `sendOrderDeliveryNotice` |

---

### 7. sendAvailableNotice

**Descripción**: Envía correos de Availability Notice para documentos ya generados. NO genera PDFs, solo envía emails de documentos con `status_id = 2`.

**Endpoint**: `POST /api/cron/process-availability-notices`

**Servicio**: `checkAvailabilityNoticeService.getOrdersReadyForAvailabilityNotice()`

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

**Parámetros Opcionales** (Body JSON):
```json
{
  "pc": "21383",        // Opcional: Filtrar por PC específico
  "factura": "1019241"  // Opcional: Filtrar por factura específica
}
```

**Respuesta Exitosa**:
```json
{
  "success": true,
  "processed": 1,
  "errors": 0,
  "skipped": 0
}
```

**Funcionamiento Detallado**:

1. **Busca registros listos para enviar** en `order_files`:
   - `file_id = 6` (Availability Notice)
   - `status_id = 2` (PDF ya generado)
   - `was_sent IS NULL OR was_sent = 0` (No enviado)
   - Aplica filtros `pc` y/o `factura` si se proporcionan

2. **Obtiene el RUT directamente** de la tabla `order_files`:
   - Ya no consulta SQL Server para obtener el RUT
   - El RUT fue guardado por `checkDefaultFiles`

3. **Valida en SQL Server** que la orden cumpla condiciones:
   - Tiene factura válida (no NULL, no vacía, no 0)
   - Incoterm de disponibilidad: EWX, FCA, FOB, FCA Port, FCA Warehouse Santiago, FCA Airport, FCAWSTGO
   - EstadoOV <> 'cancelada'
   - Si hay `sendFromDate`, filtra por `f.Fecha_factura >= sendFrom`

4. **Para cada registro que cumple las condiciones:**
   
   a. **Obtiene emails y idioma del cliente:**
   - Usa el RUT de `order_files` para buscar en `customer_contacts`
   - Filtra contactos con `reports = true`
   - Determina el idioma según el país del cliente
   
   b. **Verifica que el PDF esté generado:**
   - Confirma que `status_id = 2`
   - Si no está generado, omite el registro
   
   c. **Envía el email (si está habilitado):**
   - Llama a `sendFileToClient()` con los emails de contactos
   - Adjunta el PDF generado
   
   d. **Actualiza el registro SOLO si el email se envió exitosamente:**
   - Cambia `status_id` de 2 a 3 (Enviado)
   - Establece `was_sent = 1`
   - Actualiza `fecha_envio = NOW()`

5. **Si hay error al enviar:**
   - NO actualiza ningún campo
   - El registro permanece con `status_id = 2` y `was_sent = NULL/0`
   - Se reintentará en la próxima ejecución

**Importante**:
- NO genera PDFs, solo envía emails
- Solo procesa registros con PDF ya generado (`status_id = 2`)
- El RUT viene directamente de `order_files`, no de SQL Server
- Valida en SQL Server: Incoterms de disponibilidad y factura válida
- Solo actualiza el estado si el email se envió exitosamente
- Si falla el envío, el registro se reintenta en la próxima ejecución
- Registra eventos en `document_events` para auditoría

**Flujo de datos:**
```
checkDefaultFiles → Crea registros (status_id=1, was_sent=NULL, rut guardado)
    ↓
generatePDFs → Genera PDFs (status_id=2, was_sent=NULL)
    ↓
sendAvailableNotice → Envía emails (status_id=3, was_sent=1)
```

**Estados de `order_files`:**

| status_id | was_sent | Descripción | Proceso |
|-----------|----------|-------------|---------|
| 1 | NULL | Por Generar | `checkDefaultFiles` |
| 2 | NULL/0 | Generado, no enviado | `generatePDFs` |
| 3 | 1 | Generado y enviado | `sendAvailableNotice` |

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
   - `checkDefaultFiles` y `generatePDFs` aceptan filtros por `pc` y `factura`
   - `sendOrderReception` acepta filtro por `pc`
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
