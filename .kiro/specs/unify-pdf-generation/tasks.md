# Plan de Implementación: Unificación de Generación de PDFs

## Resumen

Refactorización para unificar dos implementaciones de generación de PDFs (`generatePendingPDFs.service.js` para el cron y `documentFile.controller.js` para el flujo manual/regeneración) en un único servicio reutilizable (`pdfGeneration.service.js`). Se eliminan funciones duplicadas (`sanitizeFileNamePart`, `normalizePONumber`, `buildDocumentFileBaseName`, `resolveDocumentName`, `getDocumentGenerator`, `getPDFData`, etc.) y se centraliza la obtención de datos, construcción de nombres, generación física y actualización de estado. El orden minimiza riesgo: primero crear, luego integrar cada flujo, luego limpiar.

## Tareas

- [x] 1. Crear el servicio unificado `pdfGeneration.service.js`
  - [x] 1.1 Crear archivo `Backend/services/pdfGeneration.service.js` con constantes, helpers y funciones principales
    - Definir constantes `FILE_ID_NAME_MAP` (9→Order Receipt Notice, 19→Shipment Notice, 15→Order Delivery Notice, 6→Availability Notice), `DOC_NAME_MAP_ES`, `DOC_TRANSLATION_KEY_MAP`
    - Implementar helpers privados: `sanitizeFileNamePart(value)`, `normalizePONumber(value)`, `resolveDocumentName(file)`, `getDocumentGenerator(documentName)`, `getDocumentDisplayName(documentName, lang)`, `escapeRegExp(value)`, `resolveLang(countryLang, recordLang, fallbackLang)`
    - Implementar `getPDFDataForRecord(record, options)` — obtiene datos vía `documentFileService.getOrderWithCustomerForPdf`, `getOrderDetailForPdf`, `getOrderItemsByPcOcFactura`; fallback a `orderService` si no hay datos; resuelve idioma vía `country_lang`; incluye `specificData` por tipo de documento y traducciones vía `getDocumentTranslations`
    - Implementar `buildFileName(record, pdfData, lang)` — construye nombre base con patrón `{docName} - {customerName} - {PC} - PO {OC}`, incluyendo customerName solo cuando `document_type === 0`
    - Implementar `buildVersionedFileName(baseName, directoryPath)` — busca archivos existentes con patrón `_vN` y retorna el siguiente número disponible
    - Implementar `generatePDF(record, pdfData)` — construye ruta con `cleanDirectoryName`, crea directorio si no existe, selecciona generador por `file_id`, genera PDF físico, verifica creación, retorna `{fullPath, relativePath, fileName}`
    - Implementar `updateRecordAfterGeneration(recordId, fileName, relativePath)` — UPDATE `order_files` con `status_id=2`, `name`, `path`, `fecha_generacion=NOW()`
    - Exportar todas las funciones públicas y helpers (para testing)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1_

  - [ ]* 1.2 Escribir tests de propiedad para resolución de idioma y construcción de nombres
    - **Propiedad 2: Resolución de idioma** — Para cualquier combinación `(countryLang, recordLang, fallbackLang)`, verificar la cadena de prioridad: countryLang > recordLang > fallbackLang > 'en'
    - **Valida: Requisitos 1.7, 6.2**
    - **Propiedad 3: Construcción de nombres de archivo** — Para cualquier combinación `(docName, customerName, pc, oc, document_type)`, verificar que no contiene caracteres prohibidos, que customerName se incluye solo cuando `document_type === 0`, que OC no tiene prefijo GEL, y que partes vacías se omiten
    - **Valida: Requisitos 2.2, 2.3, 2.4, 2.5**

  - [ ]* 1.3 Escribir tests de propiedad para selección de generador y versionado
    - **Propiedad 5: Selección de generador por file_id** — Para cualquier `file_id` en `{9, 19, 15, 6}`, verificar que retorna el generador correcto; para `file_id` fuera del conjunto, `generatePDF` retorna `null`
    - **Valida: Requisitos 3.4, 3.5**
    - **Propiedad 6: Cálculo de versión para regeneración** — Para cualquier conjunto de archivos existentes con patrón `_vN`, verificar que retorna `max(N) + 1`; si no hay archivos, retorna `_v1`
    - **Valida: Requisitos 7.2**

- [x] 2. Checkpoint — Verificar servicio unificado
  - Asegurar que el servicio unificado no tiene errores de sintaxis y las funciones exportadas son correctas. Preguntar al usuario si hay dudas.

- [x] 3. Integrar flujo cron con el servicio unificado
  - [x] 3.1 Simplificar `Backend/services/generatePendingPDFs.service.js`
    - Importar `pdfGenerationService` desde `./pdfGeneration.service`
    - Mantener la responsabilidad de: leer `sendFrom` de `param_config`, consultar registros pendientes (`status_id = 1`) con filtros opcionales de `pc` y `factura`, filtrar por PCs válidos vía SQL Server cuando `sendFrom` está configurado, iterar registros
    - Reemplazar `getPDFDataForRecord` interno por `pdfGenerationService.getPDFDataForRecord(record)`
    - Reemplazar `generatePhysicalPDF` interno por `pdfGenerationService.generatePDF(record, pdfData)`
    - Reemplazar UPDATE directo por `pdfGenerationService.updateRecordAfterGeneration(record.id, pdfResult.fileName, pdfResult.relativePath)`
    - Mantener `logDocumentEvent` con `source: 'cron'` y acumulación de contadores
    - Eliminar funciones internas: `getPDFDataForRecord`, `generatePhysicalPDF`, `sanitizeFileNamePart`, `normalizePONumber`, `FILE_ID_MAP`
    - Eliminar imports ya no necesarios: `generateRecepcionOrden`, `generateAvisoEmbarque`, `generateAvisoEntrega`, `generateAvisoDisponibilidad`, `getWeekOfYear`
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 8.2_

- [x] 4. Integrar flujo manual con el servicio unificado
  - [x] 4.1 Simplificar función `generateFile` en `Backend/controllers/documentFile.controller.js`
    - Resolver `pdfGenerationService` desde el container DI
    - Mantener: obtener file vía `fileService.getFileById(id)`, validación 404, logging, `logDocEvent` con `source: 'manual'`, emisión Socket.IO `updateNotifications`, respuesta HTTP
    - Reemplazar llamadas a `getPDFData`, `buildDocumentFileBaseName`, `resolveDocumentName`, `getDocumentGenerator` y lógica de directorio/generación por: `pdfGenerationService.getPDFDataForRecord(file, {lang})`, `pdfGenerationService.generatePDF(file, pdfData)`, `pdfGenerationService.updateRecordAfterGeneration(file.id, pdfResult.fileName, pdfResult.relativePath)`
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 8.3_

- [x] 5. Integrar flujo de regeneración con el servicio unificado
  - [x] 5.1 Simplificar función `regenerateFile` en `Backend/controllers/documentFile.controller.js`
    - Mantener: obtener file vía `fileService.getFileById(id)`, validación 404, logging, `logDocEvent` con `action: 'regenerate_pdf'`, respuesta HTTP con `fileName`, `filePath`, `newFileId`
    - Reemplazar obtención de datos por `pdfGenerationService.getPDFDataForRecord(file, {lang})`
    - Usar `pdfGenerationService.buildFileName(file, pdfData, lang)` para nombre base
    - Usar `pdfGenerationService.buildVersionedFileName(baseName, customerFolder)` para nombre versionado
    - Usar `pdfGenerationService.resolveDocumentName(file)` y `pdfGenerationService.getDocumentGenerator(documentName)` para generar el PDF
    - Mantener `fileService.duplicateFile(id, relativePath, versionedName)` para duplicar registro
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 8.3_

- [x] 6. Checkpoint — Verificar integración de los tres flujos
  - Asegurar que los tres flujos (cron, manual, regeneración) usan el servicio unificado correctamente. Preguntar al usuario si hay dudas.

- [x] 7. Eliminar código duplicado y registrar en container
  - [x] 7.1 Eliminar funciones duplicadas de `Backend/controllers/documentFile.controller.js`
    - Eliminar: `sanitizeFileNamePart`, `normalizePONumber`, `buildDocumentFileBaseName`, `resolveDocumentName`, `getDocumentGenerator`, `getDocumentDisplayName`, `getPDFData`, `escapeRegExp`
    - Eliminar constantes: `DOC_NAME_MAP_ES`, `DOC_NAME_MAP_ES_TO_EN`, `FILE_ID_NAME_MAP`
    - Eliminar imports ya no necesarios del controller: `generateRecepcionOrden`, `generateAvisoEmbarque`, `generateAvisoEntrega`, `generateAvisoDisponibilidad`, `getWeekOfYear` (si ya no se usan en ninguna otra función del controller)
    - _Requisitos: 8.1, 8.3_

  - [x] 7.2 Registrar `pdfGenerationService` en `Backend/config/container.js`
    - Agregar `const pdfGenerationService = require('../services/pdfGeneration.service')`
    - Agregar `pdfGenerationService: asValue(pdfGenerationService)` al registro del container
    - _Requisitos: 8.4_

- [x] 8. Verificar que no existan referencias huérfanas
  - Buscar en todo el proyecto referencias a las funciones eliminadas: `getPDFData` (la del controller), `buildDocumentFileBaseName`, `getDocumentGenerator` (la del controller), `FILE_ID_MAP` (la del cron), `generatePhysicalPDF`
  - Verificar que `pdfGenerationService` está accesible desde el container
  - Verificar que los endpoints HTTP mantienen sus firmas: `POST /api/cron/generate-pending-pdfs`, `POST /api/files/generate/:id`, `POST /api/files/regenerate/:id`
  - _Requisitos: 8.1, 8.2, 8.3, 8.4_

- [x] 9. Checkpoint final — Verificar eliminación completa y estabilidad
  - Asegurar que no hay referencias huérfanas, los endpoints mantienen sus firmas HTTP, y el servicio unificado es el único módulo con las funciones de generación de PDF. Preguntar al usuario si hay dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedad validan propiedades universales de correctitud del diseño
- El orden de ejecución minimiza riesgo: crear → integrar cron → integrar manual → integrar regeneración → limpiar
