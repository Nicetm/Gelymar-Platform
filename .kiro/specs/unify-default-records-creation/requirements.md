# Documento de Requisitos — Unificación de Creación de Registros por Defecto

## Introducción

Actualmente existen 2 implementaciones activas que crean registros de documentos por defecto en la tabla `order_files`, más 1 implementación muerta que debe eliminarse:

1. **Código muerto** (`checkDefaultFiles.service.js` → `generateDefaultFiles()`) — Registrado en el container y con endpoint `/api/cron/generate-default-files`, pero el cron de PM2 (`Cronjob/cron/checkDefaultFiles.js`) en realidad llama a `/api/cron/create-default-records`. Tiene bugs (rutas absolutas) y lógica inconsistente. Debe eliminarse junto con su endpoint.
2. **Cron activo** (`createDefaultRecords.service.js` → `createDefaultRecords()`) — Invocado por el cron de PM2 vía `POST /api/cron/create-default-records`. Guarda rutas relativas sin sufijo `_N`, usa solo `pc` como clave parcial, determina padre por `id` más bajo, guarda `rut`, sincroniza factura.
3. **Manual activo** (`file.service.js` → `createDefaultFilesForPcOc()`) — Invocado desde el frontend vía `POST /api/files/create-default`. Guarda rutas relativas con sufijo de versionado `_N` (ej: `uploads/CLIENTE/PC_1`), usa `invoice_count` para parcialidad, no guarda `rut`, no sincroniza factura desde ERP.

El objetivo es: eliminar el código muerto, y unificar las 2 implementaciones activas en un único servicio reutilizable con comportamiento consistente.

## Glosario

- **Servicio_Unificado**: Nuevo servicio centralizado (`unifiedDefaultRecords.service.js`) que reemplaza la lógica de creación de registros por defecto de las 2 implementaciones activas.
- **order_files**: Tabla MySQL que almacena los registros de documentos asociados a órdenes de compra.
- **PC**: Número de pedido de compra (campo `Nro` en SQL Server, campo `pc` en MySQL).
- **OC**: Número de orden de compra del cliente.
- **Factura**: Número de factura asociado a una orden, proveniente del ERP (SQL Server).
- **RUT**: Identificador tributario del cliente.
- **ORN**: Order Receipt Notice — documento de acuse de recepción de orden (file_id=9).
- **Shipment_Notice**: Aviso de embarque (file_id=19).
- **Order_Delivery_Notice**: Aviso de entrega de orden (file_id=15).
- **Availability_Notice**: Aviso de disponibilidad (file_id=6).
- **file_identifier**: Número secuencial que identifica la versión del directorio de archivos para un PC (sufijo `_N`).
- **sendFrom**: Parámetro de configuración en `param_config` que filtra órdenes por fecha mínima.
- **Incoterm**: Cláusula comercial internacional que determina qué documentos de embarque/disponibilidad se pueden crear.
- **Orden_Parcial**: Orden que tiene múltiples facturas asociadas al mismo PC.
- **Orden_Padre**: En una orden parcial, la primera orden (sin factura) que recibe el ORN.
- **ERP**: Sistema SQL Server externo que contiene los datos maestros de órdenes, clientes y facturas.
- **Flujo_Cron**: Ejecución automática vía endpoint cron (`/api/cron/create-default-records`).
- **Flujo_Manual**: Ejecución desde el frontend vía endpoint manual (`/api/files/create-default`).

## Requisitos

### Requisito 1: Eliminación de Código Muerto

**Historia de Usuario:** Como desarrollador, quiero eliminar el código muerto del sistema, para reducir la complejidad y evitar confusión sobre qué implementación está activa.

#### Criterios de Aceptación

1. SHALL eliminarse el archivo `Backend/services/checkDefaultFiles.service.js` completo, ya que no es invocado por ningún cron activo.
2. SHALL eliminarse el endpoint `POST /api/cron/generate-default-files` de `Backend/routes/cron.routes.js`, ya que no es utilizado por el cron de PM2.
3. SHALL eliminarse el registro `checkDefaultFilesService` del container de DI en `Backend/config/container.js` y su import correspondiente.
4. SHALL eliminarse la función `createDefaultFilesForOrder` de `file.service.js`, ya que es una versión antigua reemplazada por `createDefaultFilesForPcOc`.
5. SHALL verificarse que no existan otras referencias a `generateDefaultFiles` o `checkDefaultFilesService` en el código antes de eliminar.

### Requisito 2: Servicio Unificado de Creación de Registros

**Historia de Usuario:** Como desarrollador, quiero un único servicio que centralice la lógica de creación de registros por defecto en `order_files`, para eliminar inconsistencias entre las 2 implementaciones activas.

#### Criterios de Aceptación

1. THE Servicio_Unificado SHALL exponer una función `createDefaultRecordsForOrder(orderData, options)` que encapsule toda la lógica de creación de registros por defecto.
2. WHEN el Flujo_Cron invoque la creación de registros, THE Servicio_Unificado SHALL ejecutar la misma lógica que cuando el Flujo_Manual invoca la creación.
3. THE Servicio_Unificado SHALL reemplazar la lógica de creación de registros en `createDefaultRecords.service.js` y `file.service.js`.
4. THE Servicio_Unificado SHALL recibir como parámetro un objeto `orderData` con los campos: `pc`, `oc`, `factura`, `rut`, `customerName`, `incoterm`, `fecha_etd_factura`, `fecha_eta_factura`.
5. THE Servicio_Unificado SHALL recibir un objeto `options` con campos opcionales: `source` (valor `'cron'` o `'manual'`), `allowedDocs` (array de nombres de documentos permitidos), `userId` (ID del usuario para flujo manual).

### Requisito 3: Formato de Ruta con Versionado

**Historia de Usuario:** Como administrador del sistema, quiero que todas las rutas almacenadas en `order_files` usen el formato relativo con sufijo de versionado `_N`, para mantener historial de versiones cuando los documentos se regeneran.

#### Criterios de Aceptación

1. THE Servicio_Unificado SHALL almacenar rutas en formato relativo `uploads/{CLIENTE}/{PC}_{N}` donde `{N}` es el `file_identifier` secuencial.
2. THE Servicio_Unificado SHALL obtener el siguiente `file_identifier` disponible para un PC consultando el valor máximo existente en `order_files` e incrementándolo en 1.
3. WHEN no existan registros previos para un PC, THE Servicio_Unificado SHALL asignar `file_identifier` con valor 1.
4. WHEN ya existan registros para el mismo PC y factura, THE Servicio_Unificado SHALL reutilizar la ruta y el `file_identifier` del primer registro existente.
5. THE Servicio_Unificado SHALL limpiar el nombre del cliente usando la función `cleanDirectoryName` de `directoryUtils.js` antes de construir la ruta.

### Requisito 4: Creación de Directorio Físico

**Historia de Usuario:** Como administrador del sistema, quiero que el directorio físico se cree en el servidor de archivos de forma consistente, para que los PDFs puedan generarse posteriormente.

#### Criterios de Aceptación

1. WHEN se creen registros por defecto y no exista un directorio previo para el PC y factura, THE Servicio_Unificado SHALL crear el directorio físico en la ruta `{FILE_SERVER_ROOT}/uploads/{CLIENTE}/{PC}_{N}`.
2. WHEN el directorio físico ya exista, THE Servicio_Unificado SHALL reutilizar el directorio existente sin crear uno nuevo.
3. IF la creación del directorio físico falla, THEN THE Servicio_Unificado SHALL registrar el error en el log y omitir la orden sin detener el procesamiento de las demás órdenes.
4. THE Servicio_Unificado SHALL leer la variable de entorno `FILE_SERVER_ROOT` para determinar la raíz del servidor de archivos.

### Requisito 5: Determinación de Documentos Requeridos

**Historia de Usuario:** Como administrador del sistema, quiero que la lógica de determinación de documentos sea consistente, para que las mismas condiciones produzcan los mismos documentos en ambos flujos.

#### Criterios de Aceptación

1. WHEN una orden no tiene factura y no es parcial, THE Servicio_Unificado SHALL crear únicamente el registro ORN (file_id=9).
2. WHEN una orden tiene factura y no es parcial, THE Servicio_Unificado SHALL crear el registro ORN (file_id=9) y los documentos de factura que cumplan las validaciones de incoterm.
3. WHEN una orden es parcial y es la orden padre, THE Servicio_Unificado SHALL crear el registro ORN (file_id=9).
4. WHEN una orden es parcial, es la orden padre y tiene factura, THE Servicio_Unificado SHALL crear el registro ORN (file_id=9) y los documentos de factura que cumplan las validaciones de incoterm.
5. WHEN una orden es parcial y no es la orden padre, THE Servicio_Unificado SHALL crear únicamente los documentos de factura que cumplan las validaciones de incoterm.
6. THE Servicio_Unificado SHALL determinar si una orden es parcial contando las facturas distintas asociadas al mismo PC en la tabla `jor_imp_FACT_90_softkey` del ERP.
7. THE Servicio_Unificado SHALL determinar la orden padre como aquella con el `id` más bajo entre las órdenes del mismo PC.

### Requisito 6: Validación de Incoterm Consistente

**Historia de Usuario:** Como administrador del sistema, quiero que la validación de incoterm se aplique de forma idéntica en ambos flujos, para que los documentos creados sean los mismos independientemente del origen.

#### Criterios de Aceptación

1. THE Servicio_Unificado SHALL usar la función `getIncotermValidators()` de `incotermValidation.js` para obtener las funciones de validación `canCreateShipment`, `canCreateDelivery` y `canCreateAvailability`.
2. WHEN la validación de incoterm esté habilitada (`enable=1` en `param_config`), THE Servicio_Unificado SHALL verificar que el incoterm de la orden esté en la lista permitida antes de crear Shipment_Notice o Availability_Notice.
3. WHEN la orden no tenga `fecha_etd_factura` o `fecha_eta_factura`, THE Servicio_Unificado SHALL omitir la creación de Shipment_Notice.
4. WHEN la orden no tenga `fecha_eta_factura`, THE Servicio_Unificado SHALL omitir la creación de Order_Delivery_Notice.
5. WHEN se proporcione un array `allowedDocs` en las opciones, THE Servicio_Unificado SHALL crear únicamente los documentos que estén en la intersección de `allowedDocs` y los documentos que cumplan las validaciones de incoterm.

### Requisito 7: Filtro sendFrom

**Historia de Usuario:** Como administrador del sistema, quiero que el filtro `sendFrom` se aplique en el flujo cron, para procesar solo órdenes a partir de una fecha configurada.

#### Criterios de Aceptación

1. WHEN el Flujo_Cron se ejecute, THE Servicio_Unificado SHALL leer el parámetro `sendFrom` de la configuración `checkDefaultFiles` en la tabla `param_config`.
2. WHEN `sendFrom` tenga un valor válido, THE Servicio_Unificado SHALL filtrar las órdenes del ERP para incluir solo aquellas con fecha mayor o igual a `sendFrom`.
3. WHEN `sendFrom` no esté configurado o sea nulo, THE Servicio_Unificado SHALL procesar todas las órdenes sin filtro de fecha.

### Requisito 8: Persistencia del RUT

**Historia de Usuario:** Como administrador del sistema, quiero que el RUT del cliente se guarde siempre en el registro de `order_files`, para poder rastrear a qué cliente pertenece cada documento.

#### Criterios de Aceptación

1. THE Servicio_Unificado SHALL guardar el campo `rut` del cliente en cada registro insertado en `order_files`.
2. WHEN el RUT no esté disponible directamente, THE Servicio_Unificado SHALL obtener el RUT del cliente desde el ERP usando la tabla `jor_imp_HDR_90_softkey`.
3. IF el RUT del cliente no se puede obtener, THEN THE Servicio_Unificado SHALL insertar el registro con `rut` como NULL y registrar una advertencia en el log.

### Requisito 9: Sincronización de Factura desde ERP

**Historia de Usuario:** Como administrador del sistema, quiero que la factura se sincronice desde el ERP en ambos flujos, para que los registros ORN creados sin factura se actualicen cuando el ERP asigne una factura.

#### Criterios de Aceptación

1. WHEN una orden tenga factura en el ERP y existan registros ORN (file_id=9) con factura NULL para el mismo PC, THE Servicio_Unificado SHALL actualizar el campo `factura` de esos registros ORN.
2. THE Servicio_Unificado SHALL ejecutar la sincronización de factura antes de verificar los archivos existentes para evitar duplicados.
3. WHEN la sincronización de factura actualice registros, THE Servicio_Unificado SHALL registrar en el log los IDs de los registros actualizados.

### Requisito 10: Prevención de Duplicados

**Historia de Usuario:** Como administrador del sistema, quiero que no se creen registros duplicados en `order_files`, para mantener la integridad de los datos.

#### Criterios de Aceptación

1. WHEN ya exista un registro en `order_files` con el mismo `pc`, `factura` y `file_id`, THE Servicio_Unificado SHALL omitir la creación de ese documento.
2. THE Servicio_Unificado SHALL buscar registros existentes usando la combinación de `pc` y `factura` (sin incluir `oc` en la búsqueda de duplicados).
3. WHEN se busquen registros existentes para un PC con factura específica, THE Servicio_Unificado SHALL incluir también los registros con factura NULL para ese PC, para detectar ORNs pendientes de sincronización.
4. WHEN todos los documentos requeridos ya existan en el Flujo_Cron, THE Servicio_Unificado SHALL omitir la orden silenciosamente y continuar con la siguiente.
5. WHEN todos los documentos requeridos ya existan en el Flujo_Manual, THE Servicio_Unificado SHALL retornar un error con código `FILES_ALREADY_EXIST` y status HTTP 409.

### Requisito 11: Registro de Eventos

**Historia de Usuario:** Como administrador del sistema, quiero que cada creación de registro genere un evento en `document_events`, para tener trazabilidad completa de las operaciones.

#### Criterios de Aceptación

1. WHEN se inserte un registro en `order_files`, THE Servicio_Unificado SHALL registrar un evento en `document_events` con `action='create_record'`, el `source` correspondiente (`'cron'` o `'manual'`), y el `process` identificando el flujo.
2. IF la inserción de un registro falla, THEN THE Servicio_Unificado SHALL registrar un evento de error en `document_events` con `status='error'` y el mensaje de error.
3. THE Servicio_Unificado SHALL incluir en cada evento los campos: `pc`, `oc`, `factura`, `customerRut`, `userId`, `fileId` y `docType`.

### Requisito 12: Inserción Consistente de Registros

**Historia de Usuario:** Como desarrollador, quiero que todos los registros insertados en `order_files` tengan los mismos campos y valores por defecto, para garantizar consistencia en la base de datos.

#### Criterios de Aceptación

1. THE Servicio_Unificado SHALL insertar cada registro con los siguientes valores por defecto: `was_sent=NULL`, `document_type=0`, `file_type='PDF'`, `status_id=1`, `is_visible_to_client=0`.
2. THE Servicio_Unificado SHALL normalizar el campo `factura` antes de insertar: valores `null`, `undefined`, `''`, `0` y `'0'` se almacenan como `NULL`.
3. THE Servicio_Unificado SHALL normalizar el campo `oc` antes de insertar: valores `null` o `undefined` se almacenan como `NULL`, otros valores se recortan con `trim()`.
4. THE Servicio_Unificado SHALL asignar el `file_id` correcto según el tipo de documento: ORN=9, Shipment_Notice=19, Order_Delivery_Notice=15, Availability_Notice=6.

### Requisito 13: Integración con Flujo Cron

**Historia de Usuario:** Como administrador del sistema, quiero que el endpoint cron activo use el servicio unificado, para que el procesamiento automático sea consistente con el manual.

#### Criterios de Aceptación

1. WHEN se invoque `POST /api/cron/create-default-records`, THE Servicio_Unificado SHALL procesar todas las órdenes del ERP (filtradas por `sendFrom` y filtros opcionales de `pc`/`factura`).
2. THE Servicio_Unificado SHALL procesar las órdenes en lotes de 10 clientes para evitar problemas de memoria.
3. THE Servicio_Unificado SHALL registrar al finalizar el total de registros creados, órdenes procesadas y directorios creados.

### Requisito 14: Integración con Flujo Manual

**Historia de Usuario:** Como administrador del sistema, quiero que el endpoint manual use el servicio unificado, para que los registros creados desde el frontend sean idénticos a los del cron.

#### Criterios de Aceptación

1. WHEN se invoque `POST /api/files/create-default` o `POST /api/files/create-default/:orderId`, THE Servicio_Unificado SHALL crear los registros por defecto para la orden especificada.
2. WHEN el controlador proporcione un array `allowedDocs`, THE Servicio_Unificado SHALL respetar esa restricción al determinar los documentos a crear.
3. WHEN el flujo manual se ejecute, THE Servicio_Unificado SHALL ejecutar la sincronización de factura desde el ERP antes de crear los registros.
4. WHEN todos los documentos requeridos ya existan en el flujo manual, THE Servicio_Unificado SHALL retornar un error con código `FILES_ALREADY_EXIST` y status HTTP 409.

### Requisito 15: Reemplazo de Implementaciones Duplicadas

**Historia de Usuario:** Como desarrollador, quiero que las implementaciones duplicadas se reemplacen por el servicio unificado, para tener un solo punto de mantenimiento.

#### Criterios de Aceptación

1. THE Servicio_Unificado SHALL reemplazar las funciones `insertDefaultFile`, `checkExistingFiles`, `createClientDirectory` y `updateOrderReceiptNoticeFactura` duplicadas en `createDefaultRecords.service.js`, delegando toda la lógica al servicio unificado.
2. THE Servicio_Unificado SHALL reemplazar las funciones `createDefaultFilesForPcOc`, `insertDefaultFile` y `createClientDirectory` duplicadas en `file.service.js`, delegando toda la lógica al servicio unificado.
3. THE Servicio_Unificado SHALL mantener las firmas de los endpoints HTTP existentes (`POST /api/cron/create-default-records`, `POST /api/files/create-default`) sin cambios para no afectar a los consumidores.
4. Las funciones compartidas que se mantengan en `file.service.js` (como `getNextFileIdentifier`, `getAllOrdersGroupedByRut`, `getFilesByPcOc`) SHALL seguir siendo exportadas para uso de otros módulos.
