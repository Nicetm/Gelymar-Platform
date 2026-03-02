# Documento de Diseño: División de cronMaster en dos cron jobs independientes

## Resumen

Actualmente, `cronMaster.js` ejecuta la función `checkDefaultFiles()` que realiza dos responsabilidades mezcladas:
1. Crear registros en la tabla `order_files` con `status_id = 1`
2. Generar archivos PDF físicos en el servidor de archivos

Esta refactorización separa estas responsabilidades en dos cron jobs independientes para mejorar la mantenibilidad, escalabilidad y capacidad de depuración del sistema.

## Arquitectura Actual

```mermaid
graph TD
    A[cronMaster.js] -->|llama| B[/api/cron/generate-default-files]
    B -->|ejecuta| C[generateDefaultFiles service]
    C -->|1. Crea registros| D[(order_files table)]
    C -->|2. Genera PDFs| E[File Server]
```

El servicio `generateDefaultFiles` en `Backend/services/checkDefaultFiles.service.js` realiza ambas operaciones en una sola ejecución:
- Itera sobre órdenes agrupadas por RUT
- Crea directorios físicos si no existen
- Inserta registros en `order_files` con `status_id = 1`
- Los PDFs se generan posteriormente por otros cron jobs que leen estos registros

## Arquitectura Propuesta

```mermaid
graph TD
    A[checkDefaultFiles.js] -->|llama| B[/api/cron/create-default-records]
    B -->|ejecuta| C[createDefaultRecords service]
    C -->|crea registros| D[(order_files table)]
    D -->|status_id = 1| E[generatePDFs.js]
    E -->|llama| F[/api/cron/generate-pending-pdfs]
    F -->|ejecuta| G[generatePendingPDFs service]
    G -->|lee registros| D
    G -->|genera PDFs| H[File Server]
    G -->|actualiza| I[status_id = 2]
```

## Archivos a Crear

### 1. Cronjob/cron/checkDefaultFiles.js

Nuevo cron job que reemplaza la funcionalidad de creación de registros de `cronMaster.js`.

**Responsabilidad**: Crear registros en `order_files` con `status_id = 1`

**Horario de ejecución**: 15:47 diariamente (mismo horario que cronMaster actual)

**Estructura**:
- Carga configuración de entorno (igual que cronMaster)
- Llama al endpoint `/api/cron/create-default-records`
- Usa `node-cron` para programación
- Soporta ejecución inmediata con argumento `execute-now`
- Emite señal `ready` para PM2

### 2. Cronjob/cron/generatePDFs.js

Nuevo cron job para generar PDFs físicos.

**Responsabilidad**: Generar archivos PDF físicos en el servidor de archivos

**Horario de ejecución**: 16:00 diariamente (13 minutos después de checkDefaultFiles)

**Estructura**:
- Carga configuración de entorno (igual que cronMaster)
- Llama al endpoint `/api/cron/generate-pending-pdfs`
- Usa `node-cron` para programación
- Soporta ejecución inmediata con argumento `execute-now`
- Emite señal `ready` para PM2

### 3. Backend/routes/cron.routes.js

**Modificación**: Agregar dos nuevos endpoints

- `POST /api/cron/create-default-records` - Crea registros en order_files
- `POST /api/cron/generate-pending-pdfs` - Genera PDFs para registros con status_id = 1

### 4. Backend/services/createDefaultRecords.service.js

Nuevo servicio que contiene la lógica de creación de registros.

**Código a mover desde checkDefaultFiles.service.js**:
- Función `generateDefaultFiles()` - renombrar a `createDefaultRecords()`
- Función `checkExistingFiles()`
- Función `insertDefaultFile()`
- Función `createClientDirectory()` - solo crea directorios, no genera PDFs

**Modificaciones**:
- Eliminar cualquier lógica relacionada con generación de PDFs
- Mantener toda la lógica de negocio para determinar qué documentos crear
- Mantener la lógica de validación de incoterms, facturas, etc.
- Mantener el registro de eventos en `document_events`

### 5. Backend/services/generatePendingPDFs.service.js

Nuevo servicio para generar PDFs físicos.

**Responsabilidades**:
- Consultar registros de `order_files` con `status_id = 1`
- Generar archivos PDF físicos en el servidor de archivos
- Actualizar `status_id = 2` después de generación exitosa
- Registrar eventos en `document_events`

**Lógica a implementar**:
- Query: `SELECT * FROM order_files WHERE status_id = 1 ORDER BY created_at ASC`
- Para cada registro:
  - Generar PDF usando la lógica existente de generación de documentos
  - Guardar archivo en la ruta especificada en `path`
  - Actualizar `status_id = 2` si es exitoso
  - Registrar evento en `document_events`

### 6. Backend/config/container.js

**Modificación**: Registrar los nuevos servicios en el contenedor de dependencias

- Registrar `createDefaultRecordsService`
- Registrar `generatePendingPDFsService`

## Flujo de Ejecución

### Fase 1: Creación de Registros (15:47)

1. `checkDefaultFiles.js` se ejecuta a las 15:47
2. Llama a `/api/cron/create-default-records`
3. El servicio `createDefaultRecords`:
   - Obtiene órdenes agrupadas por RUT
   - Determina qué documentos crear según incoterm, factura, etc.
   - Crea directorios físicos si no existen
   - Inserta registros en `order_files` con `status_id = 1`
   - Registra eventos en `document_events`

### Fase 2: Generación de PDFs (16:00)

1. `generatePDFs.js` se ejecuta a las 16:00
2. Llama a `/api/cron/generate-pending-pdfs`
3. El servicio `generatePendingPDFs`:
   - Consulta registros con `status_id = 1`
   - Genera archivos PDF físicos
   - Actualiza `status_id = 2` después de éxito
   - Registra eventos en `document_events`

## Actualizaciones en ecosystem.config.js

Agregar dos nuevas aplicaciones PM2:

```javascript
{
  name: 'gelymar-check-default-files',
  script: './cron/checkDefaultFiles.js',
  watch: false,
  autorestart: true,
  wait_ready: true,
  listen_timeout: 10000,
  kill_timeout: 5000,
  max_memory_restart: '300M',
  restart_delay: 4000
},
{
  name: 'gelymar-generate-pdfs',
  script: './cron/generatePDFs.js',
  watch: false,
  autorestart: true,
  wait_ready: true,
  listen_timeout: 10000,
  kill_timeout: 5000,
  max_memory_restart: '300M',
  restart_delay: 4000
}
```

## Modificaciones en cronMaster.js

**Opción 1: Eliminar checkDefaultFiles completamente**
- Remover la función `checkDefaultFiles()`
- Remover la tarea del array `tasks` en `executeSequence()`
- Mantener solo `checkClientAccess()`

**Opción 2: Mantener cronMaster como orquestador**
- Mantener `cronMaster.js` como está
- Los nuevos cron jobs operan independientemente
- Permite transición gradual

## Configuración de Base de Datos

Actualizar la tabla `param_config` para incluir las nuevas tareas:

- `checkDefaultFiles` - controla `checkDefaultFiles.js` con estructura JSON: `{"enable": 1, "sendFrom": "2025-12-01"}`
- `generatePDFs` - controla `generatePDFs.js` con estructura JSON: `{"enable": 1, "sendFrom": "2025-12-01"}`

El campo `enable` controla si el cron job ejecuta la tarea (1 = habilitado, 0 = deshabilitado).
El campo `sendFrom` define la fecha desde la cual el cron job debe procesar registros.

## Beneficios de la Refactorización

1. **Separación de responsabilidades**: Cada cron job tiene una única responsabilidad clara
2. **Mejor depuración**: Errores en creación de registros no afectan generación de PDFs y viceversa
3. **Escalabilidad**: Cada proceso puede ejecutarse en horarios diferentes o con frecuencias distintas
4. **Reintentos independientes**: Si falla la generación de PDFs, se puede reintentar sin recrear registros
5. **Monitoreo granular**: Métricas y logs separados para cada fase del proceso
6. **Mantenibilidad**: Código más simple y fácil de entender en cada archivo

## Consideraciones de Implementación

1. **Orden de ejecución**: `checkDefaultFiles.js` debe ejecutarse antes que `generatePDFs.js`
2. **Intervalo de tiempo**: 13 minutos entre ejecuciones permite que la creación de registros termine
3. **Idempotencia**: Ambos servicios deben ser idempotentes para permitir reintentos seguros
4. **Transaccionalidad**: La creación de registros y generación de PDFs son operaciones independientes
5. **Rollback**: Si falla la generación de PDFs, los registros permanecen con `status_id = 1` para reintento
6. **Logs**: Mantener el mismo formato de logs para facilitar debugging
7. **Variables de entorno**: Ambos cron jobs usan la misma detección de entorno que cronMaster

## Estados de order_files

- `status_id = 1`: Registro creado, pendiente de generación de PDF
- `status_id = 2`: PDF generado exitosamente
- `status_id = 3`: PDF enviado por correo
- Otros estados: Según la lógica existente del sistema

## Compatibilidad con Sistema Existente

Esta refactorización mantiene 100% de compatibilidad con:
- Otros cron jobs que leen `order_files` (sendOrderReception, sendShipmentNotice, etc.)
- Frontend que consulta `order_files`
- Lógica de negocio existente para determinación de documentos
- Sistema de eventos en `document_events`
- Estructura de directorios en el servidor de archivos


## Correctness Properties

*Una propiedad es una característica o comportamiento que debe ser verdadero en todas las ejecuciones válidas de un sistema - esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables por máquinas.*

### Property 1: Endpoint invocation

*Para cualquier* ejecución de CheckDefaultFiles_Cron, debe llamar al endpoint /api/cron/create-default-records

**Validates: Requirements 1.2**

### Property 2: Ready signal emission

*Para cualquier* inicio de cron job sin el argumento execute-now, debe emitir la señal "ready" a PM2

**Validates: Requirements 1.4, 2.4**

### Property 3: Environment configuration loading

*Para cualquier* cron job que inicia, debe cargar variables de entorno desde el archivo correcto según el entorno detectado

**Validates: Requirements 1.5, 2.5**

### Property 4: PDF cron endpoint invocation

*Para cualquier* ejecución de GeneratePDFs_Cron, debe llamar al endpoint /api/cron/generate-pending-pdfs

**Validates: Requirements 2.2**

### Property 5: Service execution on endpoint call

*Para cualquier* llamada al endpoint /api/cron/create-default-records, debe ejecutar la función createDefaultRecords

**Validates: Requirements 3.1**

### Property 6: Order retrieval by RUT

*Para cualquier* ejecución de createDefaultRecords, debe obtener órdenes agrupadas por RUT

**Validates: Requirements 3.2**

### Property 7: Document determination logic

*Para cualquier* orden procesada con diferentes combinaciones de incoterm y factura, debe determinar los documentos correctos a crear según la lógica de negocio

**Validates: Requirements 3.3, 10.3**

### Property 8: Existence check before insert

*Para cualquier* documento que se va a crear, debe verificar si el registro ya existe en Order_Files_Table antes de insertar

**Validates: Requirements 3.4, 11.1**

### Property 9: Initial status assignment

*Para cualquier* registro nuevo insertado en Order_Files_Table, debe tener status_id = 1

**Validates: Requirements 3.5, 8.1**

### Property 10: Directory creation on insert

*Para cualquier* registro insertado, el directorio físico del cliente debe existir después de la inserción

**Validates: Requirements 3.6**

### Property 11: Event logging on completion

*Para cualquier* operación completada por createDefaultRecords o generatePendingPDFs, debe registrar un evento en Document_Events_Table

**Validates: Requirements 3.7, 4.6**

### Property 12: Error handling continuation

*Para cualquier* error encontrado durante el procesamiento de un registro, el servicio debe registrar el error y continuar con el siguiente registro

**Validates: Requirements 3.8, 4.7**

### Property 13: PDF service execution on endpoint call

*Para cualquier* llamada al endpoint /api/cron/generate-pending-pdfs, debe ejecutar la función generatePendingPDFs

**Validates: Requirements 4.1**

### Property 14: Pending records query

*Para cualquier* ejecución de generatePendingPDFs, debe consultar solo registros de Order_Files_Table con status_id = 1

**Validates: Requirements 4.2, 8.3**

### Property 15: Records ordering

*Para cualquier* conjunto de registros obtenidos por generatePendingPDFs, deben estar ordenados por created_at ascendente

**Validates: Requirements 4.3**

### Property 16: PDF file generation

*Para cualquier* registro procesado por generatePendingPDFs, debe generar el archivo PDF físico en la ruta especificada en el registro

**Validates: Requirements 4.4**

### Property 17: Status update on success

*Para cualquier* PDF generado exitosamente, el status_id del registro debe actualizarse a 2

**Validates: Requirements 4.5, 8.2**

### Property 18: PDF count return

*Para cualquier* ejecución de generatePendingPDFs, el número retornado debe coincidir con el número de PDFs generados exitosamente

**Validates: Requirements 4.8**

### Property 19: Request validation

*Para cualquier* solicitud inválida a un endpoint cron, debe ser rechazada con validación

**Validates: Requirements 5.3**

### Property 20: Success response format

*Para cualquier* ejecución exitosa de un endpoint cron, debe retornar status 200 con información de la ejecución

**Validates: Requirements 5.4**

### Property 21: Error response format

*Para cualquier* error en un endpoint cron, debe retornar status 500 con detalles del error

**Validates: Requirements 5.5**

### Property 22: Execution logging

*Para cualquier* ejecución de un endpoint cron, debe registrar logs al inicio y al final

**Validates: Requirements 5.6**

### Property 23: Task configuration query

*Para cualquier* cron job que inicia, debe consultar Param_Config para determinar si la tarea está habilitada

**Validates: Requirements 7.1, 7.2**

### Property 24: Disabled task behavior

*Para cualquier* tarea deshabilitada en la configuración, el cron job debe registrar un log y no ejecutar la lógica

**Validates: Requirements 7.3, 7.4**

### Property 25: Enabled task execution

*Para cualquier* tarea habilitada en la configuración, el servicio debe ejecutar la lógica correspondiente

**Validates: Requirements 7.5**

### Property 26: Status persistence on failure

*Para cualquier* fallo en la generación de PDF, el status_id del registro debe permanecer en 1 para permitir reintentos

**Validates: Requirements 8.4**

### Property 27: Start logging format

*Para cualquier* cron job que inicia, debe registrar un log con timestamp y nombre de la tarea

**Validates: Requirements 9.1**

### Property 28: Completion logging format

*Para cualquier* cron job que completa, debe registrar un log con timestamp y duración

**Validates: Requirements 9.2**

### Property 29: Error logging format

*Para cualquier* error encontrado por un cron job, debe registrar un log con detalles del error

**Validates: Requirements 9.3**

### Property 30: Result count logging

*Para cualquier* ejecución de createDefaultRecords o generatePendingPDFs, debe registrar el número de registros procesados

**Validates: Requirements 9.4, 9.5**

### Property 31: Log format consistency

*Para cualquier* log generado por los nuevos cron jobs, debe usar el mismo formato que cronMaster.js

**Validates: Requirements 9.6**

### Property 32: Data structure compatibility

*Para cualquier* registro creado en Order_Files_Table, debe mantener la misma estructura de datos que el sistema existente

**Validates: Requirements 10.1, 10.5, 10.6**

### Property 33: Directory structure compatibility

*Para cualquier* directorio creado en File_Server, debe mantener la misma estructura que el sistema existente

**Validates: Requirements 10.2**

### Property 34: Event format compatibility

*Para cualquier* evento registrado en Document_Events_Table, debe mantener el mismo formato que el sistema existente

**Validates: Requirements 10.4**

### Property 35: Duplicate prevention

*Para cualquier* registro que ya existe en Order_Files_Table, createDefaultRecords debe omitir la inserción

**Validates: Requirements 11.2**

### Property 36: Idempotent PDF generation

*Para cualquier* registro con status_id = 2, generatePendingPDFs debe omitir la regeneración

**Validates: Requirements 11.4**

### Property 37: Network interface detection

*Para cualquier* cron job que inicia, debe detectar las interfaces de red disponibles

**Validates: Requirements 12.1**

### Property 38: Server environment configuration

*Para cualquier* entorno identificado como servidor, debe cargar variables desde env.server

**Validates: Requirements 12.4**

### Property 39: Local environment configuration

*Para cualquier* entorno identificado como local, debe cargar variables desde env.local

**Validates: Requirements 12.5**
