# Documento de Requisitos del Bugfix

## Introducción

La validación de autenticación y autorización está actualmente dispersa en múltiples páginas y archivos JavaScript en lugar de estar centralizada en el middleware de Astro. El middleware (`Frontend/src/middleware.ts`) solo valida el enrutamiento del contexto de la aplicación (admin/client/seller) pero NO valida la validez del token JWT, la expiración del token o la coincidencia del rol del usuario. Esto crea vulnerabilidades de seguridad críticas donde usuarios con tokens expirados o roles incorrectos aún pueden acceder a rutas protegidas.

Este bugfix centraliza toda la lógica de autenticación y autorización en el middleware para servir como la única fuente de verdad, eliminando las validaciones parciales dispersas en el código. Se utiliza autenticación JWT stateless (sin consultar base de datos en cada request) para mantener alto rendimiento y escalabilidad.

## Análisis del Bug

### Comportamiento Actual (Defecto)

1.1 CUANDO un usuario tiene un token JWT expirado ENTONCES el sistema permite el acceso a rutas protegidas sin validar la expiración del token en el middleware

1.2 CUANDO una cuenta de usuario está bloqueada (`bloqueado = 1` en la base de datos) ENTONCES el sistema permite el acceso a rutas protegidas hasta que el token JWT expire porque se usa autenticación stateless (el middleware no consulta la base de datos en cada request)

1.3 CUANDO un usuario con rol 'client' intenta acceder a rutas de admin ENTONCES el sistema permite el acceso porque el middleware solo valida el contexto de la aplicación, no la coincidencia del rol del usuario

1.4 CUANDO un usuario no tiene token JWT en las cookies ENTONCES el sistema permite el acceso a rutas protegidas porque el middleware no valida la presencia del token

1.5 CUANDO un usuario tiene un token JWT inválido (malformado o con firma incorrecta) ENTONCES el sistema permite el acceso a rutas protegidas porque el middleware no valida la autenticidad del token

1.6 CUANDO se necesita validación de autenticación ENTONCES el sistema realiza validaciones parciales en múltiples ubicaciones (`user-menu.js`, páginas individuales) creando una aplicación inconsistente de seguridad

### Comportamiento Esperado (Correcto)

2.1 CUANDO un usuario tiene un token JWT expirado ENTONCES el sistema DEBE validar la expiración del token en el middleware y redirigir a `/authentication/sign-in` con cookies limpiadas

2.2 CUANDO una cuenta de usuario está bloqueada (`bloqueado = 1` en la base de datos) ENTONCES el sistema DEBE verificar el estado de bloqueo SOLO durante el login (en el backend) y rechazar la autenticación, pero tokens JWT ya emitidos permanecerán válidos hasta su expiración (autenticación stateless)

2.3 CUANDO un usuario con rol 'client' intenta acceder a rutas de admin ENTONCES el sistema DEBE validar que el rol del usuario coincida con el contexto de la ruta en el middleware y redirigir a una página de error de acceso denegado (`/error/access-denied`) con el diseño del layout existente mostrando un mensaje amigable

2.4 CUANDO un usuario no tiene token JWT en las cookies ENTONCES el sistema DEBE detectar el token faltante en el middleware y redirigir a `/authentication/sign-in` para rutas protegidas

2.5 CUANDO un usuario tiene un token JWT inválido (malformado o con firma incorrecta) ENTONCES el sistema DEBE validar la autenticidad del token en el middleware y redirigir a `/authentication/sign-in` con cookies limpiadas

2.6 CUANDO se necesita validación de autenticación ENTONCES el sistema DEBE realizar todas las validaciones centralmente en el middleware, eliminando validaciones parciales de páginas y scripts

2.7 CUANDO un usuario pasa exitosamente todas las validaciones del middleware ENTONCES el sistema DEBE proporcionar los datos del usuario vía `context.locals.user` para uso en las páginas

2.8 CUANDO un usuario accede a rutas públicas (`/authentication/*`, `/api/*`, assets, `/info/*`) ENTONCES el sistema DEBE omitir las verificaciones de autenticación en el middleware

### Comportamiento Sin Cambios (Prevención de Regresiones)

3.1 CUANDO un usuario con un token válido y rol coincidente accede a sus rutas autorizadas ENTONCES el sistema DEBE CONTINUAR otorgando acceso sin interrupciones

3.2 CUANDO el contexto de la aplicación es 'both' (modo desarrollo) ENTONCES el sistema DEBE CONTINUAR permitiendo acceso a todas las rutas sin restricciones de contexto

3.3 CUANDO un usuario accede a assets estáticos (`/_astro/*`, `/_image/*`, `/assets/*`, `/favicon*`, `/robots.txt`, `/sitemap*`) ENTONCES el sistema DEBE CONTINUAR sirviéndolos sin autenticación

3.4 CUANDO un usuario accede a rutas API (`/api/*`) ENTONCES el sistema DEBE CONTINUAR permitiendo el acceso (las rutas API manejan su propia autenticación vía middleware del backend)

3.5 CUANDO la validación del contexto de la aplicación falla (ej: aplicación client accediendo a rutas `/admin`) ENTONCES el sistema DEBE CONTINUAR retornando 404 Not Found

3.6 CUANDO un usuario cierra sesión ENTONCES el sistema DEBE CONTINUAR limpiando todos los tokens y redirigiendo a `/authentication/sign-in`

3.7 CUANDO `user-menu.js` muestra información del usuario ENTONCES el sistema DEBE CONTINUAR obteniendo y mostrando los datos del perfil del usuario desde `/api/auth/me`
