# Documento de Requerimientos — Super Admin Panel

## Introducción

Aplicación de escritorio (Electron) para super-administradores de la plataforma Gelymar. Herramienta personal para gestionar órdenes, detectar archivos huérfanos, ver logs de contenedores y cron jobs, y navegar tablas clave de la base de datos. Se conecta directamente a los ambientes dev y producción según selección del usuario. Se distribuye como ejecutable `.exe` para Windows.

## Glosario

- **App**: La aplicación de escritorio Super Admin Panel (Electron).
- **Operador**: El usuario administrador que utiliza la App.
- **BD_MySQL**: Base de datos MySQL de la plataforma Gelymar (tablas: order_files, order_snapshots, param_config, etc.).
- **BD_SQLServer**: Base de datos SQL Server del ERP.
- **Fileserver**: Servidor de archivos que almacena documentos en `uploads/`.
- **Contenedor_Cron**: Contenedor Docker que ejecuta cron jobs con PM2.
- **Docker_API**: API de Docker del host accesible via socket o TCP.
- **Ambiente**: Configuración de conexión a base de datos, ya sea desarrollo (dev) o producción.

## Requerimientos

### Requerimiento 1: Aplicación Electron

**User Story:** Como operador, quiero una aplicación de escritorio nativa para Windows, para tener acceso rápido a las herramientas de operación sin depender de un navegador o contenedor adicional.

#### Criterios de Aceptación

1. THE App SHALL ejecutarse como aplicación de escritorio Electron en Windows.
2. THE App SHALL ubicarse en el directorio `SuperAdminPanel/` en la raíz del proyecto.
3. THE App SHALL usar Node + Express como backend interno y HTML + vanilla JS como frontend.
4. THE App SHALL poder empaquetarse como ejecutable `.exe` usando electron-builder.
5. THE App SHALL almacenar configuraciones de conexión en un archivo local (`config.json`) en el directorio de datos de la aplicación.

### Requerimiento 2: Autenticación

**User Story:** Como operador, quiero iniciar sesión con mis credenciales de administrador existentes, para no necesitar cuentas separadas.

#### Criterios de Aceptación

1. WHEN el Operador abre la App, THE App SHALL mostrar un formulario de login.
2. WHEN el Operador envía credenciales válidas, THE App SHALL autenticar contra la BD_MySQL usando la tabla de usuarios existente.
3. WHEN el Operador envía credenciales con rol distinto a administrador, THE App SHALL rechazar el acceso.
4. WHEN la autenticación es exitosa, THE App SHALL mantener la sesión activa mientras la App esté abierta.

### Requerimiento 3: Selector de Ambiente

**User Story:** Como operador, quiero seleccionar entre ambiente dev y producción, para operar sobre la base de datos correcta.

#### Criterios de Aceptación

1. WHEN el Operador inicia sesión, THE App SHALL mostrar un selector de ambiente con las opciones "Desarrollo" y "Producción".
2. WHEN el Operador selecciona un Ambiente, THE App SHALL establecer la conexión a la BD_MySQL y BD_SQLServer correspondientes.
3. THE App SHALL mostrar de forma visible y permanente el Ambiente activo, diferenciando visualmente dev (azul) de producción (rojo).
4. WHEN el Operador cambia de Ambiente, THE App SHALL cerrar las conexiones actuales y establecer nuevas.
5. THE App SHALL cargar las credenciales de cada Ambiente desde el archivo de configuración local.

### Requerimiento 4: Gestión de Órdenes

**User Story:** Como operador, quiero buscar y gestionar órdenes y sus archivos asociados, para resolver incidencias operativas rápidamente.

#### Criterios de Aceptación

1. WHEN el Operador ingresa un término de búsqueda (PC, OC o RUT), THE App SHALL consultar la BD_MySQL y retornar las órdenes que coincidan.
2. WHEN el Operador selecciona una orden, THE App SHALL mostrar el detalle incluyendo datos de la orden y los registros asociados en `order_files`.
3. WHEN el Operador edita un registro de `order_files`, THE App SHALL permitir modificar: estado (`status_id`), ruta (`path`), visibilidad (`is_visible_to_client`), y fechas.
4. WHEN el Operador confirma una edición, THE App SHALL actualizar el registro en BD_MySQL y mostrar confirmación.
5. IF la actualización falla, THEN THE App SHALL mostrar el mensaje de error específico.

### Requerimiento 5: Detector de Archivos Huérfanos

**User Story:** Como operador, quiero comparar los archivos del Fileserver contra la base de datos, para identificar y limpiar archivos sin registro.

#### Criterios de Aceptación

1. THE App SHALL permitir configurar la ruta raíz del Fileserver (local o red) en la configuración.
2. WHEN el Operador ejecuta el escaneo, THE App SHALL comparar los archivos en `uploads/` contra los registros de `order_files` en BD_MySQL.
3. WHEN el escaneo finaliza, THE App SHALL mostrar la lista de archivos huérfanos con ruta y tamaño.
4. WHEN el Operador selecciona archivos huérfanos para eliminar, THE App SHALL eliminarlos del Fileserver.
5. THE App SHALL mostrar un resumen: total archivos en disco, total registros en BD, cantidad de huérfanos, espacio ocupado.

### Requerimiento 6: Visor de Logs de Contenedores Docker

**User Story:** Como operador, quiero ver los logs de cualquier contenedor Docker, para diagnosticar problemas sin usar la terminal.

#### Criterios de Aceptación

1. THE App SHALL conectarse a la Docker_API del host (configurable: socket local o TCP remoto).
2. THE App SHALL listar todos los contenedores Docker en ejecución.
3. WHEN el Operador selecciona un contenedor, THE App SHALL mostrar las últimas líneas de log (cantidad configurable).
4. THE App SHALL permitir filtrar las líneas de log por texto de búsqueda.

### Requerimiento 7: Visor de Logs y Estado de PM2

**User Story:** Como operador, quiero ver el estado de los cron jobs y sus logs, para monitorear tareas programadas.

#### Criterios de Aceptación

1. THE App SHALL conectarse al Contenedor_Cron via Docker_API para ejecutar comandos PM2.
2. THE App SHALL listar todos los procesos PM2 con nombre, estado, CPU y memoria.
3. WHEN el Operador selecciona un proceso PM2, THE App SHALL mostrar los logs recientes.
4. IF un proceso PM2 está en error, THEN THE App SHALL resaltarlo visualmente.

### Requerimiento 8: Navegador de Base de Datos

**User Story:** Como operador, quiero ver y editar registros de tablas clave, para realizar correcciones operativas directas.

#### Criterios de Aceptación

1. THE App SHALL permitir seleccionar una tabla de una lista predefinida: `order_files`, `order_snapshots`, `param_config`, `users`.
2. WHEN el Operador selecciona una tabla, THE App SHALL mostrar los registros paginados.
3. WHEN el Operador aplica filtros, THE App SHALL consultar con la condición de filtro.
4. WHEN el Operador edita un campo, THE App SHALL actualizar en BD_MySQL y confirmar.
5. THE App SHALL mostrar paginación configurable (10, 25, 50 registros por página).

### Requerimiento 9: Interfaz de Usuario

**User Story:** Como operador, quiero una interfaz limpia y consistente con la plataforma, para una experiencia familiar.

#### Criterios de Aceptación

1. THE App SHALL usar estilo visual consistente: header oscuro (`#111827`), fondo claro (`#f3f4f6`), tipografía Segoe UI.
2. THE App SHALL implementar la interfaz con HTML y vanilla JavaScript.
3. THE App SHALL incluir una barra de navegación lateral con acceso a cada módulo: Órdenes, Huérfanos, Logs Docker, Logs PM2, Base de Datos.
4. THE App SHALL tener una ventana con tamaño mínimo de 1280x720.
