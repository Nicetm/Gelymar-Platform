# Documento de Requisitos de Corrección de Bugs

## Introducción

Se identificaron múltiples vulnerabilidades de seguridad en la plataforma de gestión logística Gelymar durante una auditoría de seguridad. Las vulnerabilidades abarcan tanto el frontend (XSS vía innerHTML sin sanitizar) como el backend (path traversal bypasseable, uploads sin restricciones de tipo/tamaño, rate limiter no aplicado, y falta de validación de variables de entorno). Estas vulnerabilidades exponen la plataforma a ataques de inyección de scripts, acceso no autorizado al sistema de archivos, subida de archivos maliciosos y denegación de servicio.

## Análisis de Bugs

### Comportamiento Actual (Defecto)

1.1 CUANDO datos del servidor (nombres de clientes, números de factura, nombres de archivo, emails, etc.) se renderizan en el DOM usando `innerHTML` con template literals sin sanitizar ENTONCES el sistema es vulnerable a ataques XSS (Cross-Site Scripting), permitiendo la ejecución de scripts maliciosos inyectados en esos campos. Archivos afectados: `orders.js`, `files.js`, `document-center.js`, `sellers.js`, `sidebar-admin.js`, `seller-projections.js`.

1.2 CUANDO un atacante envía una ruta con secuencias de path traversal codificadas (ej: `..%2F`, `..%252F`, null bytes) a las rutas del fileserver (`/files`, `/download`, `/upload`, `/mkdir`, `/delete`) ENTONCES el sistema puede permitir acceso a archivos fuera del directorio `/var/www/html/uploads` porque la validación usa `path.join()` sin `path.resolve()` previo, lo que no normaliza completamente la ruta antes de la comparación con `startsWith()`.

1.3 CUANDO un usuario sube un archivo a través de la ruta `/api/fileserver/upload` ENTONCES el sistema acepta cualquier tipo de archivo (incluyendo `.exe`, `.php`, `.sh`, `.bat` y otros ejecutables potencialmente maliciosos) porque multer está configurado sin `fileFilter`.

1.4 CUANDO un usuario sube un archivo a través de la ruta `/api/fileserver/upload` ENTONCES el sistema no impone ningún límite de tamaño porque multer está configurado sin `limits.fileSize`, permitiendo subidas de archivos arbitrariamente grandes que pueden agotar el almacenamiento del servidor.

1.5 CUANDO se realizan múltiples requests a `/api/fileserver` ENTONCES el sistema no aplica el `uploadLimiter` (rate limiter para uploads) que está definido en `app.js` pero no se usa en la ruta `app.use('/api/fileserver', fileserverRoutes)`, dejando el fileserver sin protección contra abuso de uploads.

1.6 CUANDO el servidor arranca sin las variables de entorno requeridas (credenciales de BD, JWT_SECRET, etc.) ENTONCES el sistema no valida su existencia al inicio, lo que puede causar errores crípticos en tiempo de ejecución en lugar de fallar rápidamente con un mensaje claro.

### Comportamiento Esperado (Correcto)

2.1 CUANDO datos del servidor se renderizan en el DOM usando `innerHTML` ENTONCES el sistema DEBERÁ sanitizar todos los valores dinámicos usando la función `sanitizeHTML()` existente en `utils.js` antes de interpolarlos en template literals, previniendo la ejecución de scripts inyectados.

2.2 CUANDO se recibe una ruta en cualquier endpoint del fileserver ENTONCES el sistema DEBERÁ usar `path.resolve()` para normalizar la ruta completa antes de validar con `startsWith(uploadDir)`, asegurando que secuencias codificadas de path traversal sean resueltas y detectadas correctamente.

2.3 CUANDO un usuario intenta subir un archivo ENTONCES el sistema DEBERÁ validar la extensión del archivo contra una lista blanca de extensiones permitidas (pdf, xlsx, xls, docx, doc, jpg, jpeg, png, gif, csv, txt, zip) y rechazar con error 400 cualquier archivo con extensión no permitida.

2.4 CUANDO un usuario intenta subir un archivo ENTONCES el sistema DEBERÁ imponer un límite de tamaño máximo de 50MB (`limits: { fileSize: 50 * 1024 * 1024 }`) y rechazar archivos que excedan este límite.

2.5 CUANDO se realizan requests a `/api/fileserver` ENTONCES el sistema DEBERÁ aplicar el `uploadLimiter` existente a la ruta del fileserver para limitar la cantidad de uploads por hora.

2.6 CUANDO el servidor arranca ENTONCES el sistema DEBERÁ validar que todas las variables de entorno requeridas existen y tienen valor, y DEBERÁ terminar el proceso con un mensaje de error claro si alguna falta.

### Comportamiento Sin Cambios (Prevención de Regresiones)

3.1 CUANDO datos estáticos o de estructura HTML (iconos SVG, clases CSS, elementos de UI fijos) se asignan a `innerHTML` ENTONCES el sistema DEBERÁ CONTINUAR renderizándolos correctamente sin alteraciones, ya que estos no contienen datos dinámicos del servidor.

3.2 CUANDO un usuario accede a archivos dentro del directorio permitido `/var/www/html/uploads` con rutas válidas (sin secuencias de traversal) ENTONCES el sistema DEBERÁ CONTINUAR sirviendo, listando, subiendo y eliminando archivos normalmente.

3.3 CUANDO un usuario sube archivos con extensiones permitidas (pdf, xlsx, docx, jpg, png, csv, etc.) que pesan menos de 50MB ENTONCES el sistema DEBERÁ CONTINUAR aceptando y almacenando los archivos correctamente.

3.4 CUANDO se realizan requests a otras rutas de la API que ya tienen rate limiting configurado (auth, customers, orders, etc.) ENTONCES el sistema DEBERÁ CONTINUAR aplicando sus rate limiters existentes sin cambios.

3.5 CUANDO el servidor arranca con todas las variables de entorno correctamente configuradas ENTONCES el sistema DEBERÁ CONTINUAR iniciando normalmente sin cambios en su comportamiento.

3.6 CUANDO las funcionalidades existentes de Helmet, CORS, autenticación JWT y rate limiting general operan ENTONCES el sistema DEBERÁ CONTINUAR manteniendo estas protecciones de seguridad sin modificaciones.
