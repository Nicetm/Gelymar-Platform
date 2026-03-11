# Plan de Implementación

- [-] 1. Escribir test de exploración de condición de bug
  - **Property 1: Bug Condition** - Middleware Permite Acceso No Autorizado
  - **CRÍTICO**: Este test DEBE FALLAR en código sin fix - el fallo confirma que el bug existe
  - **NO intentar arreglar el test o el código cuando falle**
  - **NOTA**: Este test codifica el comportamiento esperado - validará el fix cuando pase después de la implementación
  - **OBJETIVO**: Exponer contraejemplos que demuestran que el bug existe
  - **Enfoque PBT Acotado**: Para bugs determinísticos, acotar la propiedad a los casos concretos que fallan para asegurar reproducibilidad
  - Implementar test basado en propiedad que verifica la Condición del Bug del diseño:
    - Caso 1: Request a `/admin/dashboard` sin cookie de token → actualmente permitido
    - Caso 2: Request a `/seller/orders` con JWT expirado (exp en el pasado) → actualmente permitido
    - Caso 3: Request a `/client/profile` con JWT malformado "invalid.token.here" → actualmente permitido
    - Caso 4: Request a `/admin/users` con role='client' en JWT válido → actualmente permitido
    - Caso 5: Request con JWT con firma inválida → actualmente permitido
  - Las aserciones del test deben coincidir con las Propiedades de Comportamiento Esperado del diseño:
    - Para casos 1, 2, 3, 5: DEBE redirigir a `/authentication/sign-in` con status 302
    - Para caso 4: DEBE redirigir a `/error/access-denied` con status 302
    - DEBE limpiar cookies inválidas con header Set-Cookie
  - Ejecutar test en código SIN FIX
  - **RESULTADO ESPERADO**: Test FALLA (esto es correcto - prueba que el bug existe)
  - Documentar contraejemplos encontrados para entender la causa raíz
  - Marcar tarea como completa cuando el test esté escrito, ejecutado y el fallo documentado
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. Escribir tests de propiedad de preservación (ANTES de implementar el fix)
  - **Property 2: Preservation** - Comportamiento de Rutas No Protegidas y Usuarios Válidos
  - **IMPORTANTE**: Seguir metodología de observación primero
  - Observar comportamiento en código SIN FIX para entradas no buggy
  - Escribir tests basados en propiedades capturando patrones de comportamiento observados de Requisitos de Preservación:
    - Test 1: Usuario con token JWT válido y rol coincidente accede a sus rutas autorizadas → observar acceso exitoso
    - Test 2: Contexto de aplicación 'both' (modo desarrollo) permite acceso a todas las rutas → observar sin restricciones
    - Test 3: Assets estáticos (`/_astro/*`, `/_image/*`, `/assets/*`, `/favicon*`, `/robots.txt`, `/sitemap*`) servidos sin autenticación → observar servicio directo
    - Test 4: Rutas API (`/api/*`) accesibles sin validación de middleware → observar acceso permitido
    - Test 5: Desajuste de contexto de aplicación (app client accediendo a `/admin`) retorna 404 → observar respuesta 404
    - Test 6: Rutas públicas (`/authentication/*`, `/info/*`) accesibles sin autenticación → observar acceso permitido
  - Testing basado en propiedades genera muchos casos de prueba para garantías más fuertes
  - Ejecutar tests en código SIN FIX
  - **RESULTADO ESPERADO**: Tests PASAN (esto confirma comportamiento base a preservar)
  - Marcar tarea como completa cuando los tests estén escritos, ejecutados y pasando en código sin fix
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 3. Fix para vulnerabilidades de seguridad del middleware de autenticación

  - [ ] 3.1 Implementar validación JWT completa en el middleware
    - Agregar importación de librería `jose` para verificación JWT (compatible con edge)
    - Crear función helper `extractTokenFromCookies(cookies)` para extraer JWT de cookies
    - Crear función helper `verifyJWT(token, secret)` para verificar firma y expiración usando `jwtVerify`
    - Crear función helper `roleMatchesRouteContext(role, pathname, appContext)` para validar coincidencia de rol
    - Extender función `shouldBypass` para incluir `/authentication/*` y `/info/*`
    - Implementar flujo de autenticación en middleware después de validación de contexto:
      1. Extraer token de cookies
      2. Si no hay token y ruta es protegida → redirigir a `/authentication/sign-in`
      3. Si existe token, verificar firma y expiración
      4. Si inválido/expirado → limpiar cookie y redirigir a `/authentication/sign-in`
      5. Si válido, decodificar payload y almacenar en `context.locals.user`
      6. Validar que rol coincide con contexto de ruta
      7. Si rol no coincide → redirigir a `/error/access-denied`
      8. Si todas las verificaciones pasan → llamar `next()`
    - Agregar header `Set-Cookie` para limpiar cookie cuando se redirige por token inválido
    - _Bug_Condition: esCondiciónBug(request) donde token ES NULO O NO esValidaFirmaJWT(token) O tokenExpirado(token) O NO rolCoincideConContextoRuta(token.role, pathname, appContext)_
    - _Expected_Behavior: Para requests no autorizados, middleware DEBE redirigir a /authentication/sign-in (fallos de autenticación) o /error/access-denied (fallos de autorización) y limpiar tokens inválidos_
    - _Preservation: Usuarios válidos, modo 'both', assets estáticos, rutas API, 404s de contexto, flujo de logout, visualización de menú de usuario deben continuar funcionando sin cambios_
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ] 3.2 Crear página de error de acceso denegado
    - Crear archivo `Frontend/src/pages/error/access-denied.astro`
    - Usar layout existente de Astro para consistencia visual
    - Mostrar mensaje amigable explicando que el usuario no tiene permisos para acceder a la página
    - Incluir botón o enlace para volver a la página principal o dashboard del usuario
    - _Requirements: 2.3_

  - [ ] 3.3 Identificar y eliminar todas las validaciones parciales de autenticación dispersas
    - **PRIMERO**: Buscar en todo el código frontend validaciones parciales de autenticación:
      - Buscar verificaciones de token JWT en archivos `.js`, `.ts`, `.astro`
      - Buscar validaciones de rol de usuario en páginas individuales
      - Buscar redirecciones basadas en autenticación fuera del middleware
      - Buscar llamadas a verificación de expiración de token
      - Documentar todas las ubicaciones encontradas
    - **LUEGO**: Eliminar o simplificar cada validación encontrada:
      - En `user-menu.js`: Eliminar lógica de validación de token, eliminar inferencia de rol, simplificar `bootstrap` para solo llamar `loadCachedProfile` y `fetchProfile`, mantener solo obtención y visualización de perfil desde `/api/auth/me`, mantener flujo de logout sin cambios
      - En páginas `.astro`: Eliminar validaciones de autenticación (el middleware ahora maneja esto)
      - En otros archivos `.js`: Eliminar verificaciones de token y rol (confiar en el middleware)
    - **IMPORTANTE**: El middleware es ahora la única fuente de verdad para autenticación/autorización
    - _Preservation: Funcionalidad de visualización de perfil y logout debe continuar funcionando_
    - _Requirements: 2.6, 3.7_

  - [ ] 3.4 Verificar que test de exploración de condición de bug ahora pasa
    - **Property 1: Expected Behavior** - Middleware Bloquea Acceso No Autorizado
    - **IMPORTANTE**: Re-ejecutar el MISMO test de la tarea 1 - NO escribir un test nuevo
    - El test de la tarea 1 codifica el comportamiento esperado
    - Cuando este test pase, confirma que el comportamiento esperado está satisfecho
    - Ejecutar test de exploración de condición de bug del paso 1
    - **RESULTADO ESPERADO**: Test PASA (confirma que el bug está arreglado)
    - Verificar que todos los casos ahora producen las redirecciones correctas:
      - Tokens faltantes/inválidos/expirados → redirigen a `/authentication/sign-in`
      - Desajustes de rol → redirigen a `/error/access-denied`
      - Cookies inválidas son limpiadas
    - _Requirements: Propiedades de Comportamiento Esperado del diseño (2.1, 2.3, 2.4, 2.5)_

  - [ ] 3.5 Verificar que tests de preservación aún pasan
    - **Property 2: Preservation** - Comportamiento de Rutas No Protegidas y Usuarios Válidos
    - **IMPORTANTE**: Re-ejecutar los MISMOS tests de la tarea 2 - NO escribir tests nuevos
    - Ejecutar tests de propiedad de preservación del paso 2
    - **RESULTADO ESPERADO**: Tests PASAN (confirma que no hay regresiones)
    - Confirmar que todos los tests aún pasan después del fix:
      - Usuarios válidos acceden a sus rutas autorizadas
      - Modo 'both' permite todo acceso
      - Assets estáticos servidos sin autenticación
      - Rutas API accesibles
      - Desajustes de contexto retornan 404
      - Rutas públicas accesibles sin autenticación

- [ ] 4. Checkpoint - Asegurar que todos los tests pasan
  - Ejecutar todos los tests (exploración de bug condition + preservación)
  - Verificar que no hay regresiones en funcionalidad existente
  - Confirmar que las vulnerabilidades de seguridad están resueltas
  - Preguntar al usuario si surgen dudas o problemas
