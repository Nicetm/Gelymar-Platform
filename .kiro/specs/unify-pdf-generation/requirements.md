# Documento de Requerimientos

## Introducción

Actualmente la aplicación tiene dos implementaciones separadas para generar documentos PDF a partir de registros en la tabla `order_files`: una automática (cron vía `generatePendingPDFs.service.js`) y una manual (botón del frontend vía `documentFile.controller.js`). Ambas obtienen datos de forma diferente, construyen nombres de archivo con lógica distinta y producen PDFs potencialmente inconsistentes para la misma entrada. Este feature unifica ambas implementaciones en un único servicio reutilizable (`pdfGeneration.service.js`) que centraliza la obtención de datos, la construcción de nombres de archivo, la generación física del PDF y la actualización de estado, eliminando código duplicado y garantizando resultados idénticos independientemente del flujo de invocación.

## Glosario

- **PDF_Generation_Service**: Servicio unificado (`pdfGeneration.service.js`) que centraliza toda la lógica de generación de PDFs para documentos de órdenes.
- **Order_File_Record**: Registro en la tabla `order_files` que representa un documento pendiente o generado, con campos `id`, `pc`, `oc`, `factura`, `file_id`, `file_identifier`, `status_id`, `name`, `path`, `document_type`, `fecha_generacion`.
- **Cron_Flow**: Flujo automático invocado por PM2 vía `POST /api/cron/generate-pending-pdfs` que procesa todos los Order_File_Record con `status_id = 1`.
- **Manual_Flow**: Flujo manual invocado desde el frontend vía `POST /api/files/generate/:id` que genera el PDF para un Order_File_Record específico.
- **Regeneration_Flow**: Flujo de regeneración invocado vía `POST /api/files/regenerate/:id` que crea una nueva versión del PDF con sufijo `_vN`.
- **PDF_Data**: Objeto con todos los datos necesarios para generar un PDF (datos de orden, cliente, items, traducciones, idioma).
- **Document_Type**: Tipo de documento identificado por `file_id`: Order Receipt Notice (9), Shipment Notice (19), Order Delivery Notice (15), Availability Notice (6).
- **File_Name_Builder**: Función unificada que construye el nombre base del archivo PDF a partir del nombre del documento, nombre del cliente, PC y OC.
- **SendFrom_Filter**: Filtro de fecha configurado en `param_config` (key: `generatePDFs`) que limita los registros procesados por el Cron_Flow.
- **Version_Suffix**: Sufijo `_vN` (donde N es un entero incremental) agregado al nombre del archivo durante el Regeneration_Flow.

## Requerimientos

### Requerimiento 1: Servicio unificado de obtención de datos para PDF

**User Story:** Como desarrollador, quiero que exista un único punto de obtención de datos para la generación de PDFs, para que ambos flujos (cron y manual) produzcan datos idénticos.

#### Criterios de Aceptación

1. THE PDF_Generation_Service SHALL exponer una función `getPDFDataForRecord(record)` que reciba un Order_File_Record y retorne un objeto PDF_Data completo.
2. WHEN el Cron_Flow invoca `getPDFDataForRecord`, THE PDF_Generation_Service SHALL obtener los datos de orden, detalle de factura e items utilizando los métodos de `documentFileService` (`getOrderWithCustomerForPdf`, `getOrderDetailForPdf`, `getOrderItemsByPcOcFactura`).
3. WHEN el Manual_Flow invoca `getPDFDataForRecord`, THE PDF_Generation_Service SHALL obtener los datos utilizando los mismos métodos de `documentFileService` que el Cron_Flow.
4. WHEN el Order_File_Record tiene un campo `factura` con valor no nulo y no vacío, THE PDF_Generation_Service SHALL incluir los datos de factura (ETD, ETA, medio de envío factura, gasto adicional flete factura) en el objeto PDF_Data.
5. WHEN el Order_File_Record no tiene datos de orden en `documentFileService`, THE PDF_Generation_Service SHALL intentar resolver la orden desde SQL Server vía `orderService` como fallback.
6. IF `getPDFDataForRecord` no puede obtener datos de orden de ninguna fuente, THEN THE PDF_Generation_Service SHALL retornar `null`.
7. THE PDF_Generation_Service SHALL determinar el idioma consultando la tabla `country_lang` según el país del cliente, con fallback al idioma del registro o `'en'` por defecto.
8. THE PDF_Generation_Service SHALL incluir datos específicos por Document_Type (campos adicionales como `portOfShipment`, `vesselName`, `containerNumber` para Shipment Notice) en el objeto PDF_Data.
9. THE PDF_Generation_Service SHALL incluir las traducciones del documento obtenidas vía `getDocumentTranslations` según el Document_Type y el idioma resuelto.

### Requerimiento 2: Construcción unificada de nombres de archivo

**User Story:** Como desarrollador, quiero que la construcción de nombres de archivo PDF esté centralizada en una única función, para eliminar la duplicación de `sanitizeFileNamePart` y `normalizePONumber` entre el cron y el controller.

#### Criterios de Aceptación

1. THE PDF_Generation_Service SHALL exponer una función `buildFileName(record, pdfData)` que construya el nombre base del archivo PDF.
2. THE File_Name_Builder SHALL sanitizar cada parte del nombre removiendo caracteres no permitidos en sistemas de archivos (`<>:"/\\|?*`), caracteres de control y espacios múltiples.
3. THE File_Name_Builder SHALL normalizar el número de orden (OC) removiendo el prefijo `GEL` y retornando `'-'` si el valor resultante está vacío.
4. THE File_Name_Builder SHALL construir el nombre con el patrón `{docName} - {customerName} - {PC} - PO {OC}` cuando `document_type` es 0, omitiendo `customerName` cuando `document_type` es distinto de 0.
5. WHEN alguna parte del nombre (PC, OC) está vacía o resulta en `'-'`, THE File_Name_Builder SHALL omitir esa parte del nombre final.
6. THE PDF_Generation_Service SHALL eliminar las funciones duplicadas `sanitizeFileNamePart` y `normalizePONumber` del controller y del servicio cron.

### Requerimiento 3: Generación física unificada del PDF

**User Story:** Como desarrollador, quiero que la generación física del archivo PDF en el servidor esté centralizada, para que ambos flujos generen el archivo de la misma manera.

#### Criterios de Aceptación

1. THE PDF_Generation_Service SHALL exponer una función `generatePDF(record, pdfData)` que genere el archivo PDF físico en el servidor y retorne un objeto con `{ fullPath, relativePath, fileName }`.
2. THE PDF_Generation_Service SHALL construir la ruta del directorio usando `cleanDirectoryName(customerName)` y `cleanDirectoryName(pc)` concatenado con `_${file_identifier}`.
3. WHEN el directorio de destino no existe, THE PDF_Generation_Service SHALL crearlo recursivamente.
4. THE PDF_Generation_Service SHALL seleccionar la función generadora de PDF (`generateRecepcionOrden`, `generateAvisoEmbarque`, `generateAvisoEntrega`, `generateAvisoDisponibilidad`) según el `file_id` del Order_File_Record.
5. IF el `file_id` del Order_File_Record no corresponde a ningún Document_Type conocido, THEN THE PDF_Generation_Service SHALL retornar `null` y registrar un error en el log.
6. WHEN la generación del PDF finaliza, THE PDF_Generation_Service SHALL verificar que el archivo fue creado correctamente en el sistema de archivos.

### Requerimiento 4: Actualización de estado unificada

**User Story:** Como desarrollador, quiero que la actualización de estado del registro después de generar el PDF esté centralizada, para garantizar consistencia entre flujos.

#### Criterios de Aceptación

1. THE PDF_Generation_Service SHALL exponer una función `updateRecordAfterGeneration(recordId, fileName, relativePath)` que actualice el Order_File_Record con `status_id = 2`, `name`, `path` y `fecha_generacion = NOW()`.
2. THE PDF_Generation_Service SHALL registrar un evento en `document_events` vía `logDocumentEvent` después de cada generación exitosa, incluyendo `source` ('cron' o 'manual'), `action` ('generate_pdf'), `fileId`, `docType`, `pc`, `oc`, `factura` y `customerRut`.
3. IF la generación del PDF falla, THEN THE PDF_Generation_Service SHALL registrar un evento de error en `document_events` con `status = 'error'` y el mensaje de error.

### Requerimiento 5: Integración del Cron_Flow con el servicio unificado

**User Story:** Como desarrollador, quiero que el flujo cron utilice el servicio unificado, para eliminar la implementación duplicada de obtención de datos y generación de PDFs.

#### Criterios de Aceptación

1. WHEN el Cron_Flow se ejecuta, THE PDF_Generation_Service SHALL procesar cada Order_File_Record con `status_id = 1` utilizando las funciones unificadas `getPDFDataForRecord`, `generatePDF` y `updateRecordAfterGeneration`.
2. WHERE el SendFrom_Filter está configurado en `param_config`, THE Cron_Flow SHALL filtrar los registros procesados consultando `jor_imp_HDR_90_softkey` para obtener solo los PC cuya fecha (`h.Fecha`) sea mayor o igual al valor de `sendFrom`.
3. WHEN el Cron_Flow recibe filtros opcionales de `pc` y `factura`, THE Cron_Flow SHALL aplicar esos filtros adicionales a la consulta de registros pendientes.
4. THE Cron_Flow SHALL continuar procesando los registros restantes cuando un registro individual falla, sin interrumpir el lote completo.
5. THE Cron_Flow SHALL retornar el número total de PDFs generados exitosamente.

### Requerimiento 6: Integración del Manual_Flow con el servicio unificado

**User Story:** Como desarrollador, quiero que el flujo manual utilice el servicio unificado, para que produzca PDFs idénticos al flujo cron.

#### Criterios de Aceptación

1. WHEN el Manual_Flow recibe una solicitud `POST /api/files/generate/:id`, THE PDF_Generation_Service SHALL obtener el Order_File_Record vía `fileService.getFileById(id)` y generar el PDF utilizando las funciones unificadas.
2. WHEN el Order_File_Record tiene un campo `lang` definido, THE PDF_Generation_Service SHALL usar ese idioma; de lo contrario, SHALL usar el idioma enviado por el frontend como fallback.
3. IF el Order_File_Record no existe, THEN THE Manual_Flow SHALL retornar HTTP 404 con el mensaje correspondiente.
4. WHEN la generación es exitosa, THE Manual_Flow SHALL emitir el evento `updateNotifications` vía Socket.IO al room `admin-room`.

### Requerimiento 7: Integración del Regeneration_Flow con el servicio unificado

**User Story:** Como desarrollador, quiero que el flujo de regeneración utilice el servicio unificado, para mantener consistencia en la obtención de datos y generación del PDF.

#### Criterios de Aceptación

1. WHEN el Regeneration_Flow recibe una solicitud `POST /api/files/regenerate/:id`, THE PDF_Generation_Service SHALL obtener los datos y generar el PDF utilizando las funciones unificadas `getPDFDataForRecord` y la función generadora correspondiente.
2. THE Regeneration_Flow SHALL agregar el Version_Suffix `_vN` al nombre del archivo, donde N es el siguiente número disponible basado en los archivos existentes en el directorio.
3. WHEN la generación es exitosa, THE Regeneration_Flow SHALL duplicar el Order_File_Record con la nueva ruta y nombre vía `fileService.duplicateFile`.
4. THE Regeneration_Flow SHALL registrar un evento en `document_events` con `action = 'regenerate_pdf'`.

### Requerimiento 8: Eliminación de código duplicado

**User Story:** Como desarrollador, quiero que todo el código duplicado entre el cron y el controller sea eliminado, para reducir la superficie de mantenimiento.

#### Criterios de Aceptación

1. THE PDF_Generation_Service SHALL ser el único módulo que contenga las funciones `sanitizeFileNamePart`, `normalizePONumber`, `buildDocumentFileBaseName`, `resolveDocumentName`, `getDocumentGenerator` y la lógica de obtención de PDF_Data.
2. WHEN el refactoring se complete, THE `generatePendingPDFs.service.js` SHALL delegar la obtención de datos, generación de PDF y actualización de estado al PDF_Generation_Service, conservando solo la lógica de consulta de registros pendientes y el SendFrom_Filter.
3. WHEN el refactoring se complete, THE `documentFile.controller.js` SHALL delegar la generación de PDF al PDF_Generation_Service, conservando solo la lógica de manejo de request/response HTTP.
4. THE PDF_Generation_Service SHALL ser registrado en el contenedor de inyección de dependencias (`container.js`) para ser accesible desde otros módulos.
