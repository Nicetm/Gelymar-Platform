# Plan de Implementación: División de cronMaster en dos cron jobs independientes

## Resumen

Esta refactorización divide `cronMaster.js` en dos cron jobs independientes: `checkDefaultFiles.js` (crea registros en order_files) y `generatePDFs.js` (genera archivos PDF físicos). Es una refactorización que mueve código existente, no crea nueva funcionalidad.

## Tareas

- [x] 1. Crear servicio para creación de registros
  - [x] 1.1 Crear Backend/services/createDefaultRecords.service.js
    - Copiar funciones desde checkDefaultFiles.service.js: generateDefaultFiles (renombrar a createDefaultRecords), checkExistingFiles, insertDefaultFile, createClientDirectory
    - Eliminar cualquier lógica de generación de PDFs físicos
    - Mantener lógica de creación de directorios y registros con status_id = 1
    - Mantener lógica de negocio para determinar documentos según incoterm/factura
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2_
  
  - [ ]* 1.2 Escribir test de propiedad para createDefaultRecords
    - **Property 5: Service execution on endpoint call**
    - **Property 6: Order retrieval by RUT**
    - **Property 8: Existence check before insert**
    - **Property 9: Initial status assignment**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5**

- [x] 2. Crear servicio para generación de PDFs
  - [x] 2.1 Crear Backend/services/generatePendingPDFs.service.js
    - Implementar función generatePendingPDFs que consulta registros con status_id = 1
    - Ordenar registros por created_at ascendente
    - Generar PDF físico para cada registro usando lógica existente
    - Actualizar status_id = 2 después de generación exitosa
    - Registrar eventos en document_events
    - Manejar errores y continuar con siguiente registro
    - Retornar número de PDFs generados
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 8.2, 8.3, 8.4, 11.3, 11.4_
  
  - [ ]* 2.2 Escribir test de propiedad para generatePendingPDFs
    - **Property 13: PDF service execution on endpoint call**
    - **Property 14: Pending records query**
    - **Property 17: Status update on success**
    - **Property 26: Status persistence on failure**
    - **Validates: Requirements 4.1, 4.2, 4.5, 8.4**

- [x] 3. Registrar servicios en contenedor de dependencias
  - [x] 3.1 Actualizar Backend/config/container.js
    - Importar createDefaultRecordsService
    - Importar generatePendingPDFsService
    - Registrar ambos servicios en el contenedor
    - _Requirements: 3.1, 4.1_

- [x] 4. Agregar endpoints de API
  - [x] 4.1 Actualizar Backend/routes/cron.routes.js
    - Agregar endpoint POST /api/cron/create-default-records que llama a createDefaultRecords
    - Agregar endpoint POST /api/cron/generate-pending-pdfs que llama a generatePendingPDFs
    - Implementar validación de solicitudes
    - Implementar respuestas con status 200 (éxito) y 500 (error)
    - Agregar logs de inicio y finalización
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [ ]* 4.2 Escribir tests de integración para endpoints
    - **Property 19: Request validation**
    - **Property 20: Success response format**
    - **Property 21: Error response format**
    - **Validates: Requirements 5.3, 5.4, 5.5**

- [ ] 5. Checkpoint - Verificar servicios y endpoints
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [x] 6. Crear cron job checkDefaultFiles
  - [x] 6.1 Crear Cronjob/cron/checkDefaultFiles.js
    - Copiar estructura de cronMaster.js (detección de entorno, carga de variables)
    - Configurar ejecución diaria a las 15:47 usando node-cron
    - Llamar al endpoint /api/cron/create-default-records
    - Soportar argumento execute-now para ejecución inmediata
    - Emitir señal ready para PM2 (solo si no es execute-now)
    - Consultar param_config para verificar si checkDefaultFiles.enable está habilitado
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 7.1, 7.3, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_
  
  - [ ]* 6.2 Escribir test de propiedad para checkDefaultFiles cron
    - **Property 1: Endpoint invocation**
    - **Property 2: Ready signal emission**
    - **Property 3: Environment configuration loading**
    - **Property 23: Task configuration query**
    - **Validates: Requirements 1.2, 1.4, 1.5, 7.1**

- [x] 7. Crear cron job generatePDFs
  - [x] 7.1 Crear Cronjob/cron/generatePDFs.js
    - Copiar estructura de cronMaster.js (detección de entorno, carga de variables)
    - Configurar ejecución diaria a las 16:00 usando node-cron
    - Llamar al endpoint /api/cron/generate-pending-pdfs
    - Soportar argumento execute-now para ejecución inmediata
    - Emitir señal ready para PM2 (solo si no es execute-now)
    - Consultar param_config para verificar si generatePDFs.enable está habilitado
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.2, 7.4, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_
  
  - [ ]* 7.2 Escribir test de propiedad para generatePDFs cron
    - **Property 4: PDF cron endpoint invocation**
    - **Property 2: Ready signal emission**
    - **Property 3: Environment configuration loading**
    - **Property 23: Task configuration query**
    - **Validates: Requirements 2.2, 2.4, 2.5, 7.2**

- [x] 8. Actualizar configuración de PM2
  - [x] 8.1 Actualizar Cronjob/ecosystem.config.js
    - Agregar aplicación gelymar-check-default-files que ejecuta checkDefaultFiles.js
    - Agregar aplicación gelymar-generate-pdfs que ejecuta generatePDFs.js
    - Configurar autorestart, wait_ready, listen_timeout (10000ms), kill_timeout (5000ms)
    - Configurar max_memory_restart (300M) y restart_delay (4000ms)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 9. Actualizar configuración de base de datos
  - [x] 9.1 Agregar registros en param_config
    - Agregar parámetro checkDefaultFiles con estructura JSON: {"enable": 1, "sendFrom": "2025-12-01"}
    - Agregar parámetro generatePDFs con estructura JSON: {"enable": 1, "sendFrom": "2025-12-01"}
    - _Requirements: 7.1, 7.2, 7.5_

- [x] 10. Checkpoint - Verificar cron jobs y configuración
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

- [x] 11. Actualizar cronMaster.js (opcional)
  - [x] 11.1 Remover función checkDefaultFiles de cronMaster.js
    - Eliminar la función checkDefaultFiles()
    - Remover la tarea del array tasks en executeSequence()
    - Mantener solo checkClientAccess()
    - Actualizar comentarios y logs
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 12. Agregar logging consistente
  - [x] 12.1 Implementar logs en servicios y cron jobs
    - Logs de inicio con timestamp y nombre de tarea
    - Logs de finalización con timestamp y duración
    - Logs de error con detalles
    - Logs de conteo de registros procesados/PDFs generados
    - Usar mismo formato que cronMaster.js
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ]* 12.2 Escribir tests para formato de logs
    - **Property 27: Start logging format**
    - **Property 28: Completion logging format**
    - **Property 29: Error logging format**
    - **Property 30: Result count logging**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [ ] 13. Checkpoint final - Verificar integración completa
  - Asegurar que todos los tests pasen, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Esta es una refactorización que mueve código existente, no crea nueva funcionalidad
- Los dos cron jobs deben ejecutarse en secuencia: checkDefaultFiles (15:47) antes que generatePDFs (16:00)
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedad validan propiedades de corrección universales
- Mantener 100% compatibilidad con sistema existente
