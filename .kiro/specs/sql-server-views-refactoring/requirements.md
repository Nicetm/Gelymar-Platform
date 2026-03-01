# Requirements Document

## Introduction

Este documento define los requisitos para refactorizar el código backend de la aplicación de gestión documental Gelymar para adaptarse a la nueva estructura de vistas en SQL Server. La refactorización elimina la duplicidad de datos en la vista de órdenes, separando las órdenes de sus facturas asociadas en vistas independientes, manteniendo todas las reglas de negocio existentes.

## Glossary

- **Backend**: Sistema Node.js que gestiona la lógica de negocio y acceso a datos
- **Vista_HDR**: Vista SQL Server `jor_imp_HDR_90_softkey` que contiene órdenes de compra
- **Vista_FACT**: Vista SQL Server `jor_imp_FACT_90_softkey` que contiene facturas asociadas a órdenes
- **Vista_ITEM**: Vista SQL Server `jor_imp_item_90_softkey` que contiene items de facturas
- **Mapper**: Módulo que transforma datos de SQL Server a objetos JavaScript
- **PC**: Número de orden de compra (campo `Nro` en las vistas)
- **ORN**: Documento de notificación de orden (Order Reception Notice)
- **Shipment**: Documento de notificación de envío
- **Delivery**: Documento de notificación de entrega
- **Availability**: Documento de notificación de disponibilidad
- **Incoterm**: Término de comercio internacional (CIF, DDP, DAP, etc.)
- **Service**: Módulo que implementa lógica de negocio y consultas a base de datos

## Requirements

### Requirement 1: Crear Mapper de Facturas

**User Story:** Como desarrollador, quiero un mapper dedicado para facturas, para que los datos de factura se mapeen independientemente de los datos de orden.

#### Acceptance Criteria

1. THE Backend SHALL crear el archivo `Backend/mappers/sqlsoftkey/fact.mapper.js`
2. THE Mapper SHALL mapear los siguientes campos desde Vista_FACT:
   - Nro (PC) - para relacionar con órdenes
   - Factura - número de factura
   - ETD_ENC_FA - fecha ETD de la factura
   - ETA_ENC_FA - fecha ETA de la factura
   - Fecha_factura - fecha de emisión de la factura
   - Clausula (Incoterm) - término de comercio internacional
   - MedioDeEnvioFact - medio de envío de la factura
   - GtoAdicFleteFactura - gasto adicional de flete de la factura
   - IDNroOvMasFactura - identificador único de orden+factura
3. THE Mapper SHALL seguir la misma estructura y convenciones que los mappers existentes (hdr.mapper.js, item.mapper.js)
4. FOR ALL campos mapeados, el Mapper SHALL aplicar las mismas transformaciones de tipo de datos usando las funciones de utils.js (normalizeValue, normalizeDate, normalizeDecimal)
5. THE Mapper SHALL exportar una función `mapFactRowToInvoice` que reciba un row de SQL Server y retorne un objeto con los campos normalizados

### Requirement 2: Actualizar Mapper de Órdenes

**User Story:** Como desarrollador, quiero que el mapper de órdenes solo mapee campos de orden, para que no exista duplicidad con el mapper de facturas.

#### Acceptance Criteria

1. THE Backend SHALL modificar el archivo `Backend/mappers/sqlsoftkey/hdr.mapper.js`
2. THE Mapper SHALL remover los siguientes campos relacionados con facturas:
   - factura (campo Factura)
   - fecha_factura (campo Fecha_factura)
   - fecha_etd_factura (campo ETD_ENC_FA)
   - fecha_eta_factura (campo ETA_ENC_FA)
   - medio_envio_factura (campo MedioDeEnvioFact)
3. THE Mapper SHALL mantener todos los campos de orden:
   - pc (Nro)
   - oc (OC)
   - rut (Rut)
   - fecha (Fecha)
   - fecha_etd (ETD_OV)
   - fecha_eta (ETA_OV)
   - currency (Job)
   - medio_envio_ov (MedioDeEnvioOV)
   - incoterm (Clausula)
   - puerto_destino (Puerto_Destino)
   - certificados (Certificados)
   - estado_ov (EstadoOV)
   - vendedor (Vendedor)
   - id_nro_ov_mas_factura (IDNroOvMasFactura)
4. THE Mapper SHALL preservar la estructura de retorno para compatibilidad con código existente
5. FOR ALL servicios que usen hdr.mapper.js, el código SHALL continuar funcionando sin cambios en la interfaz del mapper

### Requirement 2.1: Actualizar Mapper de Items

**User Story:** Como desarrollador, quiero que el mapper de items mantenga el campo Factura, para que los items puedan relacionarse correctamente con sus facturas.

#### Acceptance Criteria

1. THE Backend SHALL revisar el archivo `Backend/mappers/sqlsoftkey/item.mapper.js`
2. THE Mapper SHALL mantener el campo `factura` (campo Factura de Vista_ITEM)
3. THE Mapper SHALL mantener todos los campos existentes sin cambios
4. THE Mapper SHALL continuar usando las funciones de normalización de utils.js
5. FOR ALL servicios que usen item.mapper.js, el código SHALL continuar funcionando sin cambios

### Requirement 3: Refactorizar Servicio de Órdenes

**User Story:** Como desarrollador, quiero que el servicio de órdenes use las nuevas vistas correctamente, para que las consultas reflejen la estructura actualizada.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/order.service.js`
2. WHEN el servicio consulta órdenes en `getOrdersByFilters`, THE Service SHALL:
   - Consultar Vista_HDR para obtener datos de orden
   - Realizar LEFT JOIN con Vista_FACT para obtener datos de facturas asociadas
   - Usar el campo Nro como clave de JOIN entre Vista_HDR y Vista_FACT
   - Mapear campos de orden usando hdr.mapper y campos de factura usando fact.mapper
3. WHEN el servicio consulta órdenes en `getClientDashboardOrders`, THE Service SHALL:
   - Consultar Vista_HDR para datos de orden
   - Realizar LEFT JOIN con Vista_FACT para datos de facturas
   - Mantener el conteo de items agrupando por Nro y Factura en Vista_ITEM
4. WHEN el servicio consulta órdenes en `getOrderByIdSimple`, `getOrderByPcOc`, `getOrderByPc`, `getOrderByPcId`, THE Service SHALL:
   - Consultar Vista_HDR para datos de orden
   - Realizar LEFT JOIN con Vista_FACT cuando se requieran datos de factura
   - Usar hdr.mapper para campos de orden y fact.mapper para campos de factura
5. WHEN el servicio consulta items en `getOrderItems`, THE Service SHALL:
   - Consultar Vista_HDR para validar acceso y obtener datos de orden
   - Consultar Vista_ITEM filtrando por Nro y Factura
   - Usar la condición `Factura IS NULL OR Factura = '' OR Factura = 0` para items sin factura
   - Usar la condición `Factura = @factura` para items de una factura específica
6. FOR ALL queries existentes, el Service SHALL producir resultados equivalentes a la implementación anterior

### Requirement 4: Refactorizar Validación de Documentos ORN

**User Story:** Como sistema, quiero validar correctamente los documentos ORN, para que solo se generen para órdenes sin facturas asociadas.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/checkOrderReception.service.js`
2. WHEN se valida un documento ORN en `getOrdersReadyForOrderReceiptNotice`, THE Service SHALL:
   - Consultar Vista_HDR filtrando por `Factura IS NULL OR Factura = '' OR Factura = 0 OR Factura = '0'`
   - Mantener todas las validaciones existentes (EstadoOV <> 'cancelada', sendFrom date filter)
   - Mantener el JOIN con jor_imp_CLI_01_softkey para obtener datos del cliente
3. THE Service SHALL mantener la lógica de verificación de archivos existentes en MySQL (order_files con file_id = 9)
4. THE Service SHALL mantener todas las demás validaciones de permisos y estado de orden
5. THE Service SHALL continuar usando la función `getReceptionFile` sin cambios (ya filtra correctamente por PC y OC)

### Requirement 5: Refactorizar Validación de Documentos Shipment

**User Story:** Como sistema, quiero validar correctamente los documentos Shipment, para que se generen por cada factura que cumpla las condiciones de ETD e Incoterm.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/checkShipmentNotice.service.js`
2. WHEN se valida un documento Shipment en `getOrdersReadyForShipmentNotice`, THE Service SHALL:
   - Consultar Vista_FACT (nueva vista) en lugar de Vista_HDR
   - Filtrar por `Factura IS NOT NULL AND Factura <> '' AND Factura <> 0`
   - Validar que ETD_ENC_FA no sea NULL usando `ISDATE(NULLIF(LTRIM(RTRIM(h.ETD_ENC_FA)), '')) = 1`
   - Validar que ETA_ENC_FA no sea NULL usando `ISDATE(NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '')) = 1`
   - Validar el Incoterm usando `Clausula IN ('CFR', 'CIF', 'CIP', 'DAP', 'DDP')`
   - Mantener el JOIN con jor_imp_CLI_01_softkey para obtener datos del cliente
3. THE Service SHALL generar un documento Shipment por cada factura que cumpla las condiciones
4. THE Service SHALL mantener la lógica de verificación de archivos existentes en MySQL (order_files con file_id = 19)
5. THE Service SHALL mantener todas las validaciones de permisos de contacto (sh_documents)
6. THE Service SHALL continuar usando la función `getShipmentFile` sin cambios

### Requirement 6: Refactorizar Validación de Documentos Delivery

**User Story:** Como sistema, quiero validar correctamente los documentos Delivery, para que se generen por cada factura que cumpla las condiciones de ETA e Incoterm.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/checkOrderDeliveryNotice.service.js`
2. WHEN se valida un documento Delivery en `getOrdersReadyForOrderDeliveryNotice`, THE Service SHALL:
   - Consultar Vista_FACT (nueva vista) en lugar de Vista_HDR
   - Filtrar por `Factura IS NOT NULL AND Factura <> '' AND Factura <> 0`
   - Validar que ETA_ENC_FA no sea NULL usando `ISDATE(NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '')) = 1`
   - Validar que ETA + 7 días <= fecha actual usando `DATEADD(day, 7, CAST(ETA_ENC_FA AS date)) <= CAST(GETDATE() AS date)`
   - Mantener el JOIN con jor_imp_CLI_01_softkey para obtener datos del cliente
   - Soportar filtros opcionales por PC, Factura, e IDNroOvMasFactura
3. THE Service SHALL generar un documento Delivery por cada factura que cumpla las condiciones
4. THE Service SHALL mantener la lógica de verificación de archivos existentes en MySQL (order_files con file_id = 15)
5. THE Service SHALL mantener todas las validaciones de permisos de contacto (reports)
6. THE Service SHALL continuar usando la función `getOrderDeliveryFile` sin cambios
7. THE Service SHALL mantener la lógica de debug logging cuando filterPc está presente

### Requirement 7: Refactorizar Validación de Documentos Availability

**User Story:** Como sistema, quiero validar correctamente los documentos Availability, para que se generen por cada factura que cumpla las condiciones.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/checkAvailabilityNotice.service.js`
2. WHEN se valida un documento Availability en `getOrdersReadyForAvailabilityNotice`, THE Service SHALL:
   - Consultar Vista_FACT (nueva vista) en lugar de Vista_HDR
   - Filtrar por `Factura IS NOT NULL AND Factura <> '' AND Factura <> 0`
   - Validar el Incoterm usando `Clausula IN ('EWX', 'FCA', 'FOB', 'FCA Port', 'FCA Warehouse Santiago', 'FCA Airport', 'FCAWSTGO')`
   - Mantener el JOIN con jor_imp_CLI_01_softkey para obtener datos del cliente
   - Soportar filtros opcionales por PC y Factura
3. THE Service SHALL generar un documento Availability por cada factura que cumpla las condiciones
4. THE Service SHALL mantener la lógica de verificación de archivos existentes en MySQL (order_files con file_id = 6)
5. THE Service SHALL mantener todas las validaciones de permisos de contacto (cco)
6. THE Service SHALL continuar usando la función `getAvailabilityFile` sin cambios

### Requirement 8: Refactorizar Servicio de Archivos de Documentos

**User Story:** Como desarrollador, quiero que el servicio de archivos use las nuevas vistas, para que la gestión de documentos funcione correctamente con la estructura actualizada.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/documentFile.service.js`
2. WHEN el servicio consulta datos de orden y factura, THE Service SHALL realizar JOIN entre Vista_HDR y Vista_FACT
3. THE Service SHALL actualizar todas las queries que filtran por campo Factura
4. THE Service SHALL mantener la misma interfaz pública para no romper dependencias
5. FOR ALL operaciones de lectura y escritura de archivos, el Service SHALL funcionar correctamente con los datos de las nuevas vistas

### Requirement 9: Refactorizar Servicio de Clientes

**User Story:** Como desarrollador, quiero que el servicio de clientes use las nuevas vistas, para que las consultas de órdenes y facturas por cliente funcionen correctamente.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/customer.service.js`
2. WHEN el servicio consulta órdenes de un cliente, THE Service SHALL consultar Vista_HDR
3. WHEN el servicio consulta facturas de un cliente, THE Service SHALL realizar JOIN entre Vista_HDR y Vista_FACT
4. THE Service SHALL actualizar todas las queries que agrupan o filtran por Factura
5. THE Service SHALL mantener la misma estructura de respuesta para compatibilidad

### Requirement 10: Refactorizar Servicio de Proyecciones

**User Story:** Como desarrollador, quiero que el servicio de proyecciones use las nuevas vistas, para que los cálculos y agregaciones funcionen correctamente.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/projection.service.js`
2. WHEN el servicio calcula proyecciones por orden, THE Service SHALL consultar Vista_HDR
3. WHEN el servicio calcula proyecciones por factura, THE Service SHALL consultar Vista_FACT
4. THE Service SHALL actualizar todas las queries de agregación que usan el campo Factura
5. FOR ALL cálculos existentes, el Service SHALL producir resultados equivalentes a la implementación anterior

### Requirement 11: Refactorizar Servicio de Detalle de Orden

**User Story:** Como desarrollador, quiero que el servicio de detalle de orden use las nuevas vistas, para que muestre correctamente la información de órdenes y sus facturas asociadas.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/orderDetail.service.js`
2. WHEN el servicio obtiene detalle de una orden, THE Service SHALL consultar Vista_HDR para datos de orden
3. WHEN el servicio obtiene facturas de una orden, THE Service SHALL consultar Vista_FACT filtrando por PC
4. WHEN el servicio obtiene items de facturas, THE Service SHALL realizar JOIN entre Vista_FACT y Vista_ITEM
5. THE Service SHALL retornar una estructura que incluya orden, facturas e items correctamente relacionados

### Requirement 12: Refactorizar Servicio de Items

**User Story:** Como desarrollador, quiero que el servicio de items use las nuevas vistas, para que las consultas de items relacionados con facturas funcionen correctamente.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/item.service.js`
2. WHEN el servicio consulta items de una orden, THE Service SHALL realizar JOIN entre Vista_HDR, Vista_FACT y Vista_ITEM
3. THE Service SHALL actualizar todas las queries que relacionan items con facturas
4. THE Service SHALL mantener la misma interfaz pública
5. FOR ALL operaciones de consulta de items, el Service SHALL retornar los datos correctamente relacionados

### Requirement 13: Refactorizar Servicio de Carpetas

**User Story:** Como desarrollador, quiero que el servicio de carpetas use las nuevas vistas, para que la organización de documentos por orden y factura funcione correctamente.

#### Acceptance Criteria

1. THE Backend SHALL modificar `Backend/services/folder.service.js`
2. WHEN el servicio organiza documentos por orden, THE Service SHALL consultar Vista_HDR
3. WHEN el servicio organiza documentos por factura, THE Service SHALL consultar Vista_FACT
4. THE Service SHALL actualizar todas las queries que filtran o agrupan por Factura
5. THE Service SHALL mantener la estructura de carpetas existente

### Requirement 14: Mantener Compatibilidad de Queries

**User Story:** Como desarrollador, quiero que todas las queries mantengan compatibilidad funcional, para que el sistema continúe funcionando sin errores después de la refactorización.

#### Acceptance Criteria

1. FOR ALL servicios modificados, THE Backend SHALL mantener la misma interfaz pública de funciones
2. FOR ALL queries refactorizadas, THE Backend SHALL producir resultados equivalentes a la implementación anterior
3. THE Backend SHALL preservar todos los nombres de campos en las respuestas
4. THE Backend SHALL mantener todos los tipos de datos en las respuestas
5. IF una query requiere datos de orden y factura, THEN THE Backend SHALL realizar el JOIN apropiado entre Vista_HDR y Vista_FACT

### Requirement 15: Preservar Reglas de Negocio

**User Story:** Como sistema, quiero que todas las reglas de negocio se mantengan intactas, para que el comportamiento del sistema no cambie después de la refactorización.

#### Acceptance Criteria

1. THE Backend SHALL mantener todas las validaciones de Incoterm (CIF, DDP, DAP, etc.)
2. THE Backend SHALL mantener todas las validaciones de permisos de contacto (sh_documents, reports, cco)
3. THE Backend SHALL mantener todas las validaciones de fechas (ETD, ETA)
4. THE Backend SHALL mantener todas las validaciones de estado de orden
5. FOR ALL tipos de documentos (ORN, Shipment, Delivery, Availability), THE Backend SHALL aplicar las mismas reglas de generación que antes

### Requirement 16: Validar Integridad de Datos

**User Story:** Como desarrollador, quiero validar que las relaciones entre vistas sean correctas, para que no se pierdan datos en las consultas.

#### Acceptance Criteria

1. WHEN se realiza JOIN entre Vista_HDR y Vista_FACT, THE Backend SHALL usar el campo PC (Nro) como clave de relación
2. WHEN se realiza JOIN entre Vista_FACT y Vista_ITEM, THE Backend SHALL usar el campo PC (Nro) como clave de relación
3. THE Backend SHALL validar que no se pierdan registros por JOINs incorrectos
4. THE Backend SHALL usar LEFT JOIN cuando se requiera incluir órdenes sin facturas
5. THE Backend SHALL usar INNER JOIN cuando se requiera solo órdenes con facturas

### Requirement 17: Documentar Cambios en Queries

**User Story:** Como desarrollador, quiero que los cambios en queries estén documentados, para que sea fácil entender la refactorización y mantener el código.

#### Acceptance Criteria

1. FOR ALL queries modificadas, THE Backend SHALL incluir comentarios explicando el cambio de estructura
2. THE Backend SHALL documentar la relación entre Vista_HDR, Vista_FACT y Vista_ITEM
3. THE Backend SHALL incluir ejemplos de queries comunes (orden sin facturas, orden con facturas, items de factura)
4. THE Backend SHALL documentar las diferencias entre la estructura anterior y la nueva
5. WHERE se use un JOIN complejo, THE Backend SHALL incluir comentarios explicando la lógica

### Requirement 18: Crear Tests de Regresión

**User Story:** Como desarrollador, quiero tests que validen la equivalencia funcional, para que pueda verificar que la refactorización no rompe funcionalidad existente.

#### Acceptance Criteria

1. THE Backend SHALL crear tests que validen queries de órdenes sin facturas
2. THE Backend SHALL crear tests que validen queries de órdenes con facturas
3. THE Backend SHALL crear tests que validen la generación de documentos ORN
4. THE Backend SHALL crear tests que validen la generación de documentos Shipment, Delivery y Availability
5. FOR ALL servicios modificados, THE Backend SHALL crear tests que comparen resultados antes y después de la refactorización
