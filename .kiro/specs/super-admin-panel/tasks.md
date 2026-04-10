# Tareas de Implementación — Super Admin Panel

## 1. Scaffolding del proyecto Electron
- [x] 1.1 Crear directorio `SuperAdminPanel/` con `package.json` (dependencias: electron, electron-builder, express, mysql2, mssql, bcrypt, jsonwebtoken, dockerode)
- [x] 1.2 Crear `main.js` — proceso principal Electron: crear BrowserWindow (1280x720 mínimo), levantar Express en puerto local aleatorio, cargar `index.html` apuntando al servidor
- [x] 1.3 Crear `preload.js` con contextBridge mínimo (exponer versión de app y path de userData)
- [x] 1.4 Crear `server/index.js` — setup Express con JSON parser, CORS localhost, y montaje de rutas
- [x] 1.5 Agregar configuración de electron-builder en `package.json` para generar `.exe` Windows

## 2. Configuración y conexión a bases de datos
- [x] 2.1 Crear `server/config/database.js` — módulo que lee `config.json` desde userData, crea/destruye pools MySQL (`mysql2`) y SQL Server (`mssql`) por ambiente, expone `getPool(env)` y `getSqlPool(env)`
- [x] 2.2 Crear lógica de `config.json` por defecto: si no existe, crear archivo con estructura vacía de ambientes (dev/prod) al iniciar la app
- [x] 2.3 Crear `server/config/docker.js` — configuración de `dockerode` (socket o TCP según config del ambiente activo)

## 3. Autenticación
- [x] 3.1 Crear `server/routes/auth.routes.js` y `server/controllers/auth.controller.js` — endpoint POST `/api/auth/login` que consulta tabla `users` en BD_MySQL, valida password con `bcrypt.compare`, verifica role_id admin, genera JWT con `jsonwebtoken`
- [x] 3.2 Crear `server/middleware/auth.middleware.js` — middleware que verifica JWT en header Authorization para proteger rutas API
- [x] 3.3 Crear endpoint GET `/api/auth/me` para obtener datos del usuario autenticado
- [x] 3.4 Crear vista `renderer/views/login.html` y `renderer/js/login.js` — formulario de login con estilo consistente (header oscuro #111827, fondo #f3f4f6, Segoe UI)

## 4. Selector de ambiente y shell principal
- [x] 4.1 Crear `renderer/index.html` — shell con sidebar (navegación: Órdenes, Huérfanos, Logs Docker, Logs PM2, Base de Datos), header con indicador de ambiente y usuario, área de contenido dinámico
- [x] 4.2 Crear `renderer/css/styles.css` — estilos globales basados en file-manager.php (header #111827, fondo #f3f4f6, botones, tablas, modales, Segoe UI)
- [x] 4.3 Crear `renderer/js/app.js` — router SPA que carga vistas HTML en el contenido principal, maneja estado de auth y ambiente activo
- [x] 4.4 Crear `renderer/js/api.js` — wrapper de fetch que inyecta token JWT, maneja errores 401 (redirige a login), y prefija URL del servidor local
- [x] 4.5 Crear endpoint POST `/api/environment/switch` que cierra pools actuales y crea nuevos para el ambiente seleccionado. Indicador visual: azul para dev, rojo para producción
- [x] 4.6 Crear pantalla de configuración accesible desde el shell para editar `config.json` (credenciales de BD, rutas Docker, ruta fileserver por ambiente)

## 5. Módulo de gestión de órdenes
- [x] 5.1 Crear `server/routes/orders.routes.js` y `server/controllers/orders.controller.js` — endpoint GET `/api/orders/search?q=` que busca por PC, OC o RUT en BD_MySQL
- [x] 5.2 Crear endpoint GET `/api/orders/:id/files` que retorna registros de `order_files` asociados a una orden
- [x] 5.3 Crear endpoint PUT `/api/orders/files/:id` que permite editar status_id, path, is_visible_to_client y fechas de un registro de `order_files`
- [x] 5.4 Crear `renderer/views/orders.html` y `renderer/js/orders.js` — vista con buscador, tabla de resultados, y modal de edición de order_files

## 6. Módulo detector de archivos huérfanos
- [x] 6.1 Crear `server/routes/orphans.routes.js` y `server/controllers/orphans.controller.js` — endpoint POST `/api/orphans/scan` que escanea recursivamente `uploads/` y compara contra `order_files` en BD_MySQL (basado en lógica de `cleanup-orphan-files.js`)
- [x] 6.2 Crear endpoint POST `/api/orphans/delete` que recibe lista de rutas y elimina los archivos del filesystem
- [x] 6.3 Crear endpoint GET `/api/orphans/summary` que retorna resumen: total archivos en disco, total registros en BD, cantidad huérfanos, espacio ocupado
- [x] 6.4 Crear `renderer/views/orphans.html` y `renderer/js/orphans.js` — vista con botón de escaneo, tabla de huérfanos (ruta, tamaño), selección múltiple para eliminar, y panel de resumen

## 7. Módulo visor de logs Docker
- [x] 7.1 Crear `server/routes/docker.routes.js` y `server/controllers/docker.controller.js` — endpoint GET `/api/docker/containers` que lista contenedores en ejecución via dockerode
- [x] 7.2 Crear endpoint GET `/api/docker/containers/:id/logs?lines=&search=` que retorna últimas N líneas de log, con filtro opcional por texto
- [x] 7.3 Crear `renderer/views/docker-logs.html` y `renderer/js/docker-logs.js` — vista con lista de contenedores, visor de logs con scroll, campo de búsqueda para filtrar, y selector de cantidad de líneas

## 8. Módulo visor de logs y estado PM2
- [x] 8.1 Crear `server/routes/pm2.routes.js` y `server/controllers/pm2.controller.js` — endpoint GET `/api/pm2/processes` que ejecuta `docker exec <container> pm2 jlist` via dockerode y parsea JSON
- [x] 8.2 Crear endpoint GET `/api/pm2/processes/:name/logs` que ejecuta `docker exec <container> pm2 logs <name> --nostream --lines N` y retorna la salida
- [x] 8.3 Crear `renderer/views/pm2-logs.html` y `renderer/js/pm2-logs.js` — vista con tabla de procesos (nombre, estado, CPU, memoria), resaltado visual para procesos en error, y visor de logs al seleccionar un proceso

## 9. Módulo navegador de base de datos
- [x] 9.1 Crear `server/routes/database.routes.js` y `server/controllers/database.controller.js` — endpoint GET `/api/database/:table?page=&limit=&filters=` que retorna registros paginados de tablas predefinidas (order_files, order_snapshots, param_config, users)
- [x] 9.2 Crear endpoint PUT `/api/database/:table/:id` que actualiza un registro por ID en la tabla seleccionada
- [x] 9.3 Crear `renderer/views/db-browser.html` y `renderer/js/db-browser.js` — vista con selector de tabla, tabla paginada (10/25/50 por página), filtros dinámicos por columna, y edición inline de campos
