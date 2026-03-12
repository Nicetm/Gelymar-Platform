# Documento de Requisitos: División de cronMaster en dos cron jobs independientes

## Introducción

Este documento especifica los requisitos para refactorizar `cronMaster.js` dividiendo su funcionalidad en dos cron jobs independientes: uno para crear registros en la base de datos y otro para generar archivos PDF físicos. Esta separación mejora la mantenibilidad, escalabilidad y capacidad de depuración del sistema manteniendo la lógica exacta que actualmente ejecuta cronMaster.

## Glosario

- **CheckDefaultFiles_Cron**: Cron job que crea registros en order_files con status_id = 1
- **GeneratePDFs_Cron**: Cron job que genera archivos PDF físicos para registros pendientes
- **Order_Files_Table**: Tabla de base de datos que almacena información de archivos de órdenes
- **Status_ID**: Campo en order_files que indica el estado del registro (1 = pendiente, 2 = generado, 3 = enviado)
- **Backend_Service**: Servicio en el backend que ejecuta la lógica de negocio
- **File_Server**: Servidor donde se almacenan los archivos PDF generados
- **Document_Events_Table**: Tabla que registra eventos relacionados con documentos
- **PM2**: Gestor de procesos para aplicaciones Node.js
- **Param_Config**: Tabla de configuración que habilita/deshabilita tareas cron

## Requisitos

### Requisito 1: Cron Job para Creación de Registros

**User Story:** Como administrador del sistema, quiero un cron job dedicado que cree registros en order_files, para que la creación de registros esté separada de la generación de PDFs.

#### Acceptance Criteria

1. THE CheckDefaultFiles_Cron SHALL ejecutarse diariamente a las 15:47
2. WHEN CheckDefaultFiles_Cron se ejecuta, THE CheckDefaultFiles_Cron SHALL llamar al endpoint /api/cron/create-default-records
3. WHEN CheckDefaultFiles_Cron recibe el argumento "execute-now", THE CheckDefaultFiles_Cron SHALL ejecutarse inmediatamente sin esperar el horario programado
4. WHEN CheckDefaultFiles_Cron inicia correctamente, THE CheckDefaultFiles_Cron SHALL emitir una señal "ready" para PM2
5. THE CheckDefaultFiles_Cron SHALL cargar variables de entorno desde env.server o env.local según el entorno detectado
6. WHEN CheckDefaultFiles_Cron detecta la dirección IP 172.20.10.151, THE CheckDefaultFiles_Cron SHALL usar la configuración de servidor
7. WHEN CheckDefaultFiles_Cron no detecta la dirección IP 172.20.10.151, THE CheckDefaultFiles_Cron SHALL usar la configuración local

### Requisito 2: Cron Job para Generación de PDFs

**User Story:** Como administrador del sistema, quiero un cron job dedicado que genere PDFs físicos, para que la generación de archivos esté separada de la creación de registros.

#### Acceptance Criteria

1. THE GeneratePDFs_Cron SHALL ejecutarse diariamente a las 16:00
2. WHEN GeneratePDFs_Cron se ejecuta, THE GeneratePDFs_Cron SHALL llamar al endpoint /api/cron/generate-pending-pdfs
3. WHEN GeneratePDFs_Cron recibe el argumento "execute-now", THE GeneratePDFs_Cron SHALL ejecutarse inmediatamente sin esperar el horario programado
4. WHEN GeneratePDFs_Cron inicia correctamente, THE GeneratePDFs_Cron SHALL emitir una señal "ready" para PM2
5. THE GeneratePDFs_Cron SHALL cargar variables de entorno desde env.server o env.local según el entorno detectado
6. WHEN GeneratePDFs_Cron detecta la dirección IP 172.20.10.151, THE GeneratePDFs_Cron SHALL usar la configuración de servidor
7. WHEN GeneratePDFs_Cron no detecta la dirección IP 172.20.10.151, THE GeneratePDFs_Cron SHALL usar la configuración local

### Requisito 3: Servicio de Creación de Registros

**User Story:** Como desarrollador, quiero un servicio backend que cree registros en order_files, para que la lógica de creación de registros esté encapsulada y sea reutilizable.

#### Acceptance Criteria

1. WHEN el endpoint /api/cron/create-default-records es llamado, THE Backend_Service SHALL ejecutar createDefaultRecords
2. WHEN createDefaultRecords se ejecuta, THE Backend_Service SHALL obtener órdenes agrupadas por RUT
3. WHEN createDefaultRecords procesa una orden, THE Backend_Service SHALL determinar qué documentos crear según incoterm y factura
4. WHEN createDefaultRecords determina crear un documento, THE Backend_Service SHALL verificar si el registro ya existe en Order_Files_Table
5. WHEN un registro no existe, THE Backend_Service SHALL insertar un nuevo registro en Order_Files_Table con status_id = 1
6. WHEN createDefaultRecords inserta un registro, THE Backend_Service SHALL crear el directorio físico del cliente si no existe
7. WHEN createDefaultRecords completa una operación, THE Backend_Service SHALL registrar el evento en Document_Events_Table
8. WHEN createDefaultRecords encuentra un error, THE Backend_Service SHALL registrar el error y continuar con el siguiente registro

### Requisito 4: Servicio de Generación de PDFs

**User Story:** Como desarrollador, quiero un servicio backend que genere PDFs para registros pendientes, para que la generación de archivos esté encapsulada y sea reutilizable.

#### Acceptance Criteria

1. WHEN el endpoint /api/cron/generate-pending-pdfs es llamado, THE Backend_Service SHALL ejecutar generatePendingPDFs
2. WHEN generatePendingPDFs se ejecuta, THE Backend_Service SHALL consultar registros de Order_Files_Table con status_id = 1
3. WHEN generatePendingPDFs obtiene registros, THE Backend_Service SHALL ordenarlos por created_at ascendente
4. WHEN generatePendingPDFs procesa un registro, THE Backend_Service SHALL generar el archivo PDF físico en la ruta especificada
5. WHEN generatePendingPDFs genera un PDF exitosamente, THE Backend_Service SHALL actualizar status_id = 2 en Order_Files_Table
6. WHEN generatePendingPDFs completa una generación, THE Backend_Service SHALL registrar el evento en Document_Events_Table
7. WHEN generatePendingPDFs encuentra un error, THE Backend_Service SHALL registrar el error y continuar con el siguiente registro
8. WHEN generatePendingPDFs completa la ejecución, THE Backend_Service SHALL retornar el número de PDFs generados exitosamente

### Requisito 5: Endpoints de API

**User Story:** Como cron job, quiero endpoints HTTP para ejecutar las operaciones, para que pueda invocar la lógica de negocio de forma desacoplada.

#### Acceptance Criteria

1. THE Backend_Service SHALL exponer el endpoint POST /api/cron/create-default-records
2. THE Backend_Service SHALL exponer el endpoint POST /api/cron/generate-pending-pdfs
3. WHEN un endpoint cron es llamado, THE Backend_Service SHALL validar que la solicitud sea válida
4. WHEN un endpoint cron completa exitosamente, THE Backend_Service SHALL retornar status 200 con información de la ejecución
5. WHEN un endpoint cron encuentra un error, THE Backend_Service SHALL retornar status 500 con detalles del error
6. WHEN un endpoint cron se ejecuta, THE Backend_Service SHALL registrar logs de inicio y finalización

### Requisito 6: Configuración de PM2

**User Story:** Como administrador del sistema, quiero que los nuevos cron jobs estén configurados en PM2, para que se gestionen automáticamente como procesos del sistema.

#### Acceptance Criteria

1. THE PM2 SHALL incluir una aplicación llamada "gelymar-check-default-files" que ejecute checkDefaultFiles.js
2. THE PM2 SHALL incluir una aplicación llamada "gelymar-generate-pdfs" que ejecute generatePDFs.js
3. WHEN un cron job falla, THE PM2 SHALL reiniciarlo automáticamente
4. WHEN un cron job consume más de 300MB de memoria, THE PM2 SHALL reiniciarlo
5. THE PM2 SHALL esperar la señal "ready" antes de considerar el proceso como iniciado
6. THE PM2 SHALL esperar hasta 10 segundos por la señal "ready"
7. WHEN PM2 reinicia un proceso, THE PM2 SHALL esperar 4 segundos antes de reiniciar

### Requisito 7: Configuración de Tareas

**User Story:** Como administrador del sistema, quiero controlar la habilitación de los cron jobs desde la base de datos, para que pueda activar o desactivar tareas sin modificar código.

#### Acceptance Criteria

1. THE Backend_Service SHALL consultar Param_Config para determinar si checkDefaultFiles.enable está habilitado
2. THE Backend_Service SHALL consultar Param_Config para determinar si generatePDFs.enable está habilitado
3. WHEN checkDefaultFiles.enable está deshabilitado (0), THE CheckDefaultFiles_Cron SHALL registrar un log y no ejecutar la tarea
4. WHEN generatePDFs.enable está deshabilitado (0), THE GeneratePDFs_Cron SHALL registrar un log y no ejecutar la tarea
5. WHEN una tarea está habilitada, THE Backend_Service SHALL ejecutar la lógica correspondiente

### Requisito 8: Manejo de Estados

**User Story:** Como desarrollador, quiero que los estados de order_files reflejen el progreso del procesamiento, para que pueda rastrear qué registros están pendientes o completados.

#### Acceptance Criteria

1. WHEN createDefaultRecords crea un registro, THE Backend_Service SHALL establecer status_id = 1
2. WHEN generatePendingPDFs genera un PDF exitosamente, THE Backend_Service SHALL actualizar status_id = 2
3. WHEN generatePendingPDFs consulta registros pendientes, THE Backend_Service SHALL filtrar por status_id = 1
4. THE Backend_Service SHALL mantener status_id = 1 si la generación de PDF falla para permitir reintentos

### Requisito 9: Logging y Monitoreo

**User Story:** Como administrador del sistema, quiero logs detallados de las operaciones, para que pueda diagnosticar problemas y monitorear el sistema.

#### Acceptance Criteria

1. WHEN un cron job inicia, THE Backend_Service SHALL registrar un log con timestamp y nombre de la tarea
2. WHEN un cron job completa, THE Backend_Service SHALL registrar un log con timestamp y duración
3. WHEN un cron job encuentra un error, THE Backend_Service SHALL registrar un log con detalles del error
4. WHEN createDefaultRecords procesa registros, THE Backend_Service SHALL registrar el número de registros creados
5. WHEN generatePendingPDFs procesa registros, THE Backend_Service SHALL registrar el número de PDFs generados
6. THE Backend_Service SHALL usar el mismo formato de logs que cronMaster.js para consistencia

### Requisito 10: Compatibilidad con Sistema Existente

**User Story:** Como desarrollador, quiero que la refactorización mantenga compatibilidad con el sistema existente, para que no se rompan integraciones actuales.

#### Acceptance Criteria

1. THE Backend_Service SHALL mantener la misma estructura de datos en Order_Files_Table
2. THE Backend_Service SHALL mantener la misma estructura de directorios en File_Server
3. THE Backend_Service SHALL mantener la misma lógica de negocio para determinar qué documentos crear
4. THE Backend_Service SHALL mantener el mismo formato de eventos en Document_Events_Table
5. WHEN otros cron jobs consultan Order_Files_Table, THE Backend_Service SHALL proporcionar datos en el formato esperado
6. WHEN el frontend consulta Order_Files_Table, THE Backend_Service SHALL proporcionar datos en el formato esperado

### Requisito 11: Idempotencia y Reintentos

**User Story:** Como administrador del sistema, quiero que las operaciones sean idempotentes, para que pueda reintentar ejecuciones sin crear duplicados o inconsistencias.

#### Acceptance Criteria

1. WHEN createDefaultRecords se ejecuta múltiples veces, THE Backend_Service SHALL verificar registros existentes antes de insertar
2. WHEN un registro ya existe en Order_Files_Table, THE Backend_Service SHALL omitir la inserción
3. WHEN generatePendingPDFs se ejecuta múltiples veces, THE Backend_Service SHALL procesar solo registros con status_id = 1
4. WHEN un PDF ya fue generado (status_id = 2), THE Backend_Service SHALL omitir la regeneración
5. WHEN createDefaultRecords falla parcialmente, THE Backend_Service SHALL permitir reejecutar sin afectar registros ya creados
6. WHEN generatePendingPDFs falla parcialmente, THE Backend_Service SHALL permitir reejecutar para completar PDFs pendientes

### Requisito 12: Detección de Entorno

**User Story:** Como desarrollador, quiero que los cron jobs detecten automáticamente el entorno, para que funcionen correctamente en desarrollo y producción sin cambios manuales.

#### Acceptance Criteria

1. WHEN un cron job inicia, THE Backend_Service SHALL detectar las interfaces de red disponibles
2. WHEN la dirección IP 172.20.10.151 está presente, THE Backend_Service SHALL identificar el entorno como servidor
3. WHEN la dirección IP 172.20.10.151 no está presente, THE Backend_Service SHALL identificar el entorno como local
4. WHEN el entorno es servidor, THE Backend_Service SHALL cargar variables desde env.server
5. WHEN el entorno es local, THE Backend_Service SHALL cargar variables desde env.local
6. WHEN el archivo de entorno no existe, THE Backend_Service SHALL usar valores por defecto y registrar una advertencia
7. WHEN se detecta entorno Docker (/.dockerenv existe), THE Backend_Service SHALL usar backend:3000 como URL del backend
