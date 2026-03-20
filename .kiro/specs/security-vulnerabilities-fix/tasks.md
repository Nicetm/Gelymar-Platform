# Plan de Implementación - Corrección de Vulnerabilidades de Seguridad

- [ ] 1. Escribir tests de exploración de bug condition (ANTES del fix)
  - **Property 1: Bug Condition** - Vulnerabilidades de Seguridad en Frontend y Backend
  - **CRITICAL**: Este test DEBE FALLAR en el código sin corregir — el fallo confirma que los bugs existen
  - **NO intentes arreglar el test ni el código cuando falle**
  - **NOTE**: Este test codifica el comportamiento esperado — validará el fix cuando pase después de la implementación
  - **GOAL**: Generar contraejemplos que demuestren las vulnerabilidades
  - **Scoped PBT Approach**: Para bugs determinísticos, acotar la propiedad a los casos concretos de fallo
  - Tests a escribir:
    - **1a. XSS en funciones de renderizado**: Crear test que pase un objeto con `customer_name: '<script>alert(1)</script>'` a las funciones de renderizado (`renderOrderRow`, `renderSellerRow`, etc.) y verifique que el HTML generado NO contiene tags sin escapar. En código sin corregir, el HTML contendrá el script sin escapar → test FALLA
    - **1b. Path traversal en fileserver**: Crear test que construya rutas con `path.join(uploadDir, '..%2F..%2Fetc')` y verifique que `path.resolve()` normaliza correctamente y la validación `startsWith(uploadDir)` rechaza la ruta. En código sin corregir, `path.join()` no normaliza → test FALLA
    - **1c. Upload de archivos no permitidos**: Crear test que verifique que multer tiene `fileFilter` configurado y rechaza extensiones `.exe`, `.php`, `.sh`, `.bat`. En código sin corregir, multer no tiene fileFilter → test FALLA
    - **1d. Límite de tamaño de uploads**: Crear test que verifique que multer tiene `limits.fileSize` configurado con 50MB. En código sin corregir, no hay límite → test FALLA
    - **1e. Rate limiter en fileserver**: Crear test que verifique que la ruta `/api/fileserver` tiene `uploadLimiter` aplicado. En código sin corregir, no se aplica → test FALLA
    - **1f. Validación de env vars**: Crear test que verifique que el servidor falla al arrancar sin variables de entorno requeridas. En código sin corregir, no hay validación → test FALLA
  - Ejecutar tests en código SIN corregir
  - **RESULTADO ESPERADO**: Tests FALLAN (esto es correcto — prueba que los bugs existen)
  - Documentar contraejemplos encontrados para entender la causa raíz
  - Marcar tarea completa cuando los tests estén escritos, ejecutados, y el fallo documentado
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. Escribir tests de preservación (ANTES del fix)
  - **Property 2: Preservation** - Comportamiento Existente Sin Cambios
  - **IMPORTANT**: Seguir metodología observation-first
  - Observar comportamiento en código SIN corregir para inputs legítimos, luego escribir tests que capturen ese comportamiento
  - Tests a escribir:
    - **2a. Preservación de renderizado visual**: Observar que datos sin caracteres HTML especiales (ej: "Empresa ABC", "12345", "FOB") producen HTML correcto. Escribir property-based test: para todo string sin `<`, `>`, `&`, `"`, `'`, el output de renderizado es idéntico antes y después del fix
    - **2b. Preservación de acceso legítimo a archivos**: Observar que `path.resolve(uploadDir, 'documents/report.pdf')` produce una ruta válida dentro de uploadDir. Escribir property-based test: para toda ruta válida sin secuencias de traversal, `path.resolve()` produce el mismo resultado que `path.join()` cuando la ruta está dentro de uploadDir
    - **2c. Preservación de uploads válidos**: Observar que archivos con extensiones permitidas (.pdf, .xlsx, .jpg, .png, .csv, .txt, .zip) son aceptados. Escribir test: para toda extensión en la lista blanca, el fileFilter acepta el archivo
    - **2d. Preservación de rate limiters existentes**: Verificar que los rate limiters de auth (`authLimiter`), lectura (`readLimiter`), escritura (`writeLimiter`) y cron (`cronLimiter`) no fueron modificados en sus configuraciones
    - **2e. Preservación de arranque normal**: Verificar que con todas las env vars presentes, el servidor arranca sin errores
  - Ejecutar tests en código SIN corregir
  - **RESULTADO ESPERADO**: Tests PASAN (esto confirma el comportamiento base a preservar)
  - Marcar tarea completa cuando los tests estén escritos, ejecutados, y pasando en código sin corregir
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Corrección de vulnerabilidades de seguridad

  - [ ] 3.1 Corregir XSS en archivos frontend — Aplicar sanitizeHTML()
    - En `orders.js`: Envolver en `sanitizeHTML()` los valores `order.pc`, `order.oc`, `order.customer_name`, `order.factura`, `order.incoterm`, `order.puerto_destino`, `shippingMethod`, y atributos `data-*`
    - En `document-center.js`: Envolver en `sanitizeHTML()` los valores `order.orderNumber`, `order.incoterm`, `order.puerto_destino`, `order.pc`, `order.factura`, y atributos `data-*`
    - En `sellers.js`: Envolver en `sanitizeHTML()` los valores `name`, `seller.rut`, `email`, `seller.phone`, y atributos `data-*`
    - En `sidebar-admin.js`: Envolver en `sanitizeHTML()` los valores `email.name`, `email.email`, `a.rut`, `a.email`, `a.full_name`, `a.phone` en `renderPdfEmails()`, `renderNotificationEmails()`, `renderAdminUsersTable()`
    - En `files.js`: Envolver en `sanitizeHTML()` los valores de `email` en botones de CCO
    - En `folders.js`: Envolver en `sanitizeHTML()` los valores de `folder.pc`, `folder.oc`, `folder.factura`, `folder.customer_name`, `folder.incoterm`, `folder.puerto_destino`, y datos de items
    - Verificar que `sanitizeHTML` está importado/disponible en cada archivo
    - _Bug_Condition: isBugCondition(input) donde input.context == 'frontend_render' AND serverData NO pasa por sanitizeHTML()_
    - _Expected_Behavior: Todos los datos del servidor sanitizados antes de interpolación en innerHTML_
    - _Preservation: Datos sin caracteres HTML especiales producen el mismo output visual_
    - _Requirements: 1.1, 2.1, 3.1_

  - [ ] 3.2 Corregir path traversal en fileserver — Usar path.resolve()
    - En `fileserver.routes.js`: Reemplazar `path.join(uploadDir, cleanPath)` con `path.resolve(uploadDir, cleanPath)` en los endpoints `/files`, `/download`, `/upload`, `/mkdir`, `/delete`
    - Asegurar que la validación `startsWith(uploadDir)` se aplica DESPUÉS de `path.resolve()`
    - _Bug_Condition: isBugCondition(input) donde input.context == 'fileserver_path' AND path.resolve() no startsWith(uploadDir)_
    - _Expected_Behavior: Rutas con secuencias de traversal codificadas son rechazadas con 403_
    - _Preservation: Rutas válidas dentro de uploadDir siguen funcionando normalmente_
    - _Requirements: 1.2, 2.2, 3.2_

  - [ ] 3.3 Agregar fileFilter a multer — Lista blanca de extensiones
    - En `fileserver.routes.js`: Agregar `fileFilter` a la configuración de multer
    - Extensiones permitidas: `.pdf`, `.xlsx`, `.xls`, `.docx`, `.doc`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.csv`, `.txt`, `.zip`
    - Rechazar con error 400 archivos con extensión no permitida
    - _Bug_Condition: isBugCondition(input) donde input.context == 'file_upload' AND extensión NOT IN allowedExtensions_
    - _Expected_Behavior: Archivos con extensiones no permitidas son rechazados con 400_
    - _Preservation: Archivos con extensiones permitidas siguen siendo aceptados_
    - _Requirements: 1.3, 2.3, 3.3_

  - [ ] 3.4 Agregar límite de tamaño a multer — 50MB máximo
    - En `fileserver.routes.js`: Agregar `limits: { fileSize: 50 * 1024 * 1024 }` a la configuración de multer
    - Agregar manejo de error `LIMIT_FILE_SIZE` para responder con 400
    - _Bug_Condition: isBugCondition(input) donde input.context == 'file_upload' AND fileSize > 50MB_
    - _Expected_Behavior: Archivos mayores a 50MB son rechazados con 400_
    - _Preservation: Archivos menores a 50MB siguen siendo aceptados_
    - _Requirements: 1.4, 2.4, 3.3_

  - [ ] 3.5 Aplicar uploadLimiter a ruta /api/fileserver
    - En `app.js`: Cambiar `app.use('/api/fileserver', fileserverRoutes)` a `app.use('/api/fileserver', uploadLimiter, fileserverRoutes)`
    - _Bug_Condition: isBugCondition(input) donde input.context == 'fileserver_rate' AND requestCount > 50/hora_
    - _Expected_Behavior: Requests a /api/fileserver limitados a 50 por hora por IP_
    - _Preservation: Rate limiters existentes en otras rutas no son modificados_
    - _Requirements: 1.5, 2.5, 3.4_

  - [ ] 3.6 Agregar validación de variables de entorno al arranque
    - En `app.js`: Agregar bloque de validación después de cargar dotenv
    - Variables requeridas: `JWT_SECRET`, `MYSQL_DB_HOST`, `MYSQL_DB_USER`, `MYSQL_DB_PASSWORD`, `MYSQL_DB_NAME`
    - Terminar proceso con `process.exit(1)` y mensaje claro si alguna falta
    - _Bug_Condition: isBugCondition(input) donde input.context == 'server_startup' AND env var requerida IS undefined_
    - _Expected_Behavior: Servidor termina con código de error y mensaje claro indicando qué variable falta_
    - _Preservation: Arranque normal con todas las env vars correctas no cambia_
    - _Requirements: 1.6, 2.6, 3.5_

  - [ ] 3.7 Verificar que test de bug condition ahora pasa
    - **Property 1: Expected Behavior** - Vulnerabilidades Corregidas
    - **IMPORTANT**: Re-ejecutar el MISMO test de la tarea 1 — NO escribir un test nuevo
    - El test de la tarea 1 codifica el comportamiento esperado
    - Cuando este test pase, confirma que el comportamiento esperado se satisface
    - Ejecutar test de exploración de bug condition de la tarea 1
    - **RESULTADO ESPERADO**: Test PASA (confirma que los bugs están corregidos)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 3.8 Verificar que tests de preservación siguen pasando
    - **Property 2: Preservation** - Comportamiento Existente Sin Cambios
    - **IMPORTANT**: Re-ejecutar los MISMOS tests de la tarea 2 — NO escribir tests nuevos
    - Ejecutar tests de preservación de la tarea 2
    - **RESULTADO ESPERADO**: Tests PASAN (confirma que no hay regresiones)
    - Confirmar que todos los tests siguen pasando después del fix

- [ ] 4. Checkpoint - Asegurar que todos los tests pasan
  - Ejecutar suite completa de tests
  - Verificar que los tests de bug condition (tarea 1) ahora PASAN
  - Verificar que los tests de preservación (tarea 2) siguen PASANDO
  - Preguntar al usuario si surgen dudas
