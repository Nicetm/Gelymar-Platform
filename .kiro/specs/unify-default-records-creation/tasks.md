# Plan de Implementación: Unificación de Creación de Registros por Defecto

## Resumen

Refactorización para unificar dos implementaciones activas de creación de registros por defecto en `order_files` en un único servicio (`unifiedDefaultRecords.service.js`), eliminación de código muerto (`checkDefaultFiles.service.js`), y limpieza de funciones duplicadas en `file.service.js`. El orden minimiza riesgo: primero crear, luego integrar, luego limpiar.

## Tareas

- [x] 1. Crear el servicio unificado `unifiedDefaultRecords.service.js`
  - [x] 1.1 Crear archivo `Backend/services/unifiedDefaultRecords.service.js` con constantes y funciones internas
    - Definir `FILE_ID_MAP` con los mapeos ORN→9, Shipment→19, Delivery→15, Availability→6
    - Implementar `syncFacturaForPc(pc, factura)` — actualiza ORN (file_id=9) con factura NULL cuando el ERP tiene factura
    - Implementar `findExistingRecords(pc, factura)` — busca registros existentes incluyendo factura NULL
    - Implementar `checkPartialStatus(pc)` — consulta `COUNT(DISTINCT Factura)` en `jor_imp_FACT_90_softkey`
    - Implementar `determineRequiredDocs(params)` — lógica de parcialidad, incoterm, allowedDocs
    - Implementar `ensureDirectory(customerName, pc, fileIdentifier)` — crea directorio con formato `uploads/{CLIENTE}/{PC}_{N}`
    - Implementar `insertRecord(fileData, eventMeta)` — INSERT en `order_files` + evento en `document_events`
    - _Requisitos: 2.1, 2.4, 3.1, 3.2, 3.3, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 9.1, 9.2, 10.1, 10.2, 10.3, 11.1, 11.2, 11.3, 12.1, 12.2, 12.3, 12.4_

  - [x] 1.2 Implementar la función principal `createDefaultRecordsForOrder(orderData, options)`
    - Validar `orderData.pc` requerido, lanzar `INVALID_ORDER_DATA` si falta
    - Normalizar factura y OC según reglas del diseño
    - Ejecutar `syncFacturaForPc` antes de `findExistingRecords`
    - Determinar orden padre por `id` más bajo del mismo PC (recibido en options o calculado)
    - Llamar a `checkPartialStatus`, `determineRequiredDocs`, filtrar duplicados por `file_id`
    - En modo cron: si todos existen, retornar `{ skipped: true }` sin error
    - En modo manual: si todos existen, lanzar `FILES_ALREADY_EXIST` (409); si `allowedDocs` vacío, lanzar `NO_DOCUMENTS_ALLOWED` (400)
    - Reutilizar path/file_identifier si hay registros previos; si no, crear directorio nuevo
    - Insertar registros faltantes con valores por defecto: `was_sent=NULL, document_type=0, file_type='PDF', status_id=1, is_visible_to_client=0`
    - Guardar `rut` en cada registro
    - Exportar solo `createDefaultRecordsForOrder`
    - _Requisitos: 2.1, 2.2, 2.3, 2.5, 3.4, 8.1, 8.3, 10.4, 10.5_

  - [ ]* 1.3 Instalar `fast-check` y escribir tests de propiedad para `determineRequiredDocs`
    - Instalar `fast-check` como devDependency
    - **Propiedad 1: Determinación de documentos requeridos** — Para cualquier combinación `(isPartial, isParent, hasFactura)`, verificar que los documentos retornados cumplen las reglas del diseño
    - **Valida: Requisitos 5.1, 5.2, 5.3, 5.4, 5.5**

  - [ ]* 1.4 Escribir tests de propiedad para validación de incoterm y normalización
    - **Propiedad 2: Validación de incoterm y fechas** — Shipment requiere ETD+ETA+incoterm válido, Delivery requiere ETA, Availability requiere incoterm válido
    - **Valida: Requisitos 6.2, 6.3, 6.4**
    - **Propiedad 3: Intersección de allowedDocs** — El resultado es la intersección de docs requeridos y allowedDocs; si allowedDocs es null, retorna todos
    - **Valida: Requisitos 6.5, 14.2**
    - **Propiedad 7: Normalización de factura y OC** — Valores `{null, undefined, '', 0, '0'}` → NULL para factura; `{null, undefined}` → NULL para OC, otros → trim()
    - **Valida: Requisitos 12.2, 12.3**

  - [ ]* 1.5 Escribir tests de propiedad para formato de ruta y valores por defecto
    - **Propiedad 4: Formato de ruta con versionado** — La ruta cumple `uploads/{cleanedName}/{pc}_{N}` con N entero positivo
    - **Valida: Requisitos 3.1, 3.5**
    - **Propiedad 10: Valores por defecto e identificador de documento** — Cada registro tiene `was_sent=NULL, document_type=0, file_type='PDF', status_id=1, is_visible_to_client=0` y file_id correcto
    - **Valida: Requisitos 12.1, 12.4**

- [x] 2. Checkpoint — Verificar servicio unificado
  - Asegurar que el servicio unificado compila sin errores y los tests pasan. Preguntar al usuario si hay dudas.

- [x] 3. Integrar flujo cron con el servicio unificado
  - [x] 3.1 Simplificar `Backend/services/createDefaultRecords.service.js`
    - Importar `createDefaultRecordsForOrder` del servicio unificado
    - Mantener la responsabilidad de: leer `sendFrom`, obtener órdenes con `getAllOrdersGroupedByRut()`, iterar en lotes de 10, determinar orden padre por `id` más bajo
    - Reemplazar la lógica interna de creación por llamada a `createDefaultRecordsForOrder(orderData, { source: 'cron' })`
    - Eliminar funciones internas: `checkExistingFiles`, `insertDefaultFile`, `createClientDirectory`, `updateOrderReceiptNoticeFactura`
    - Mantener acumulación de contadores y logging de resumen
    - _Requisitos: 2.2, 2.3, 7.1, 7.2, 7.3, 13.1, 13.2, 13.3, 15.1_

  - [ ]* 3.2 Escribir tests de propiedad para secuencia y reutilización
    - **Propiedad 5: Secuencia de file_identifier** — Si max existente es M, retorna M+1; si no hay registros, retorna 1
    - **Valida: Requisitos 3.2, 3.3**
    - **Propiedad 6: Reutilización de ruta y file_identifier** — Si existen registros para mismo pc+factura, reutiliza path y file_identifier existente
    - **Valida: Requisitos 3.4**

- [x] 4. Integrar flujo manual con el servicio unificado
  - [x] 4.1 Simplificar `Backend/controllers/documentFile.controller.js` función `createDefaultFiles`
    - Importar `createDefaultRecordsForOrder` del servicio unificado
    - Mantener la resolución de datos de la orden (PC, OC, factura, customerName, rut, incoterm, ETD, ETA) desde params/body/SQL Server
    - Mantener el cálculo de `allowedDocs` según validación de incoterm
    - Reemplazar llamada a `fileService.createDefaultFilesForPcOc()` por `createDefaultRecordsForOrder(orderData, { source: 'manual', allowedDocs, userId })`
    - Mantener logging de eventos `document_events` post-creación
    - _Requisitos: 2.2, 2.3, 14.1, 14.2, 14.3, 14.4, 15.2, 15.3_

  - [ ]* 4.2 Escribir tests de propiedad para prevención de duplicados y sincronización
    - **Propiedad 8: Prevención de duplicados por file_id** — Si ya existe registro con mismo pc+factura+file_id, no se crea nuevo
    - **Valida: Requisitos 10.1**
    - **Propiedad 9: Sincronización de factura en ORN** — Si existen ORN con factura=NULL y la orden tiene factura válida, se actualiza
    - **Valida: Requisitos 9.1**

- [x] 5. Checkpoint — Verificar integración de ambos flujos
  - Asegurar que todos los tests pasan y ambos flujos (cron y manual) usan el servicio unificado. Preguntar al usuario si hay dudas.

- [x] 6. Eliminar código muerto y limpiar
  - [x] 6.1 Eliminar `Backend/services/checkDefaultFiles.service.js`
    - Eliminar el archivo completo
    - _Requisitos: 1.1_

  - [x] 6.2 Eliminar endpoint y referencias de `generate-default-files` en `Backend/routes/cron.routes.js`
    - Eliminar el import `const { generateDefaultFiles } = container.resolve('checkDefaultFilesService')`
    - Eliminar el bloque `router.post('/generate-default-files', ...)`
    - _Requisitos: 1.2_

  - [x] 6.3 Eliminar registro de `checkDefaultFilesService` en `Backend/config/container.js`
    - Eliminar `const checkDefaultFilesService = require('../services/checkDefaultFiles.service')`
    - Eliminar `checkDefaultFilesService: asValue(checkDefaultFilesService)` del registro
    - Agregar `const unifiedDefaultRecordsService = require('../services/unifiedDefaultRecords.service')`
    - Agregar `unifiedDefaultRecordsService: asValue(unifiedDefaultRecordsService)` al registro
    - _Requisitos: 1.3_

  - [x] 6.4 Limpiar funciones duplicadas en `Backend/services/file.service.js`
    - Eliminar `createDefaultFilesForOrder` (código muerto antiguo)
    - Eliminar `createDefaultFilesForPcOc` (reemplazada por servicio unificado)
    - Eliminar `insertDefaultFile` (movida al servicio unificado)
    - Eliminar `createClientDirectory` (movida al servicio unificado)
    - Mantener exportadas: `getNextFileIdentifier`, `getAllOrdersGroupedByRut`, `getFilesByPcOc`, `getFilesByPc`, `getFiles`, `getFileById`, `getFileByPath`, `insertFile`, `updateFile`, `duplicateFile`, `deleteFileById`, `RenameFile`, `getAllFiles`, `markFileAsVisibleToClient`, `getOrderDataForPDF`
    - _Requisitos: 1.4, 15.2, 15.4_

  - [x] 6.5 Verificar que no existan referencias huérfanas
    - Buscar en todo el proyecto referencias a `generateDefaultFiles`, `checkDefaultFilesService`, `createDefaultFilesForOrder` (la de file.service.js), `createDefaultFilesForPcOc`
    - Actualizar o eliminar cualquier referencia encontrada
    - _Requisitos: 1.5_

- [x] 7. Checkpoint final — Verificar eliminación completa y estabilidad
  - Asegurar que todos los tests pasan, no hay referencias huérfanas, y los endpoints HTTP mantienen sus firmas. Preguntar al usuario si hay dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedad validan propiedades universales de correctitud del diseño
- Los tests unitarios validan ejemplos específicos y casos borde
- El orden de ejecución minimiza riesgo: crear → integrar → limpiar
