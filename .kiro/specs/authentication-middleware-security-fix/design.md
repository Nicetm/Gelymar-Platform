# Diseño del Bugfix de Seguridad del Middleware de Autenticación

## Resumen

Este bugfix centraliza la validación de autenticación y autorización en el middleware de Astro para eliminar vulnerabilidades de seguridad críticas. Actualmente, el middleware solo valida el enrutamiento del contexto de la aplicación pero no valida la autenticidad del token JWT, su expiración o la coincidencia del rol del usuario. Esto permite que usuarios con tokens expirados, inválidos o roles incorrectos accedan a rutas protegidas.

La solución implementa autenticación JWT stateless en el middleware (sin consultas a base de datos por request) para servir como la única fuente de verdad para autenticación, mientras elimina las validaciones parciales dispersas en páginas y archivos JavaScript. El backend continúa validando el estado de bloqueo del usuario durante el login, pero los tokens JWT emitidos permanecen válidos hasta su expiración (diseño stateless).

## Glosario

- **Condición_Bug (C)**: La condición donde la validación de autenticación/autorización está ausente o incompleta en el middleware, permitiendo acceso no autorizado
- **Propiedad (P)**: El comportamiento deseado donde el middleware valida autenticidad JWT, expiración y coincidencia de rol antes de permitir acceso a rutas protegidas
- **Preservación**: Comportamientos existentes que deben permanecer sin cambios: acceso de usuarios válidos, modo 'both', servicio de assets estáticos, manejo de rutas API, 404s de validación de contexto, flujo de logout, visualización del menú de usuario
- **JWT (JSON Web Token)**: Token de autenticación stateless almacenado en cookies httpOnly que contiene claims del usuario (id, rol, exp)
- **context.locals.user**: Objeto de contexto de Astro donde el middleware almacena el payload JWT decodificado para uso en páginas
- **appContext**: Variable de entorno PUBLIC_APP_CONTEXT que define qué aplicación está corriendo ('admin', 'seller', 'client', o 'both')
- **Autenticación Stateless**: Enfoque de autenticación donde los tokens son autocontenidos y no se validan contra la base de datos en cada request (solo se verifica firma y expiración)
- **Coincidencia de Rol**: Validación de que el rol del usuario en el JWT coincide con el contexto de la ruta (ej: rol 'admin' para rutas /admin)

## Detalles del Bug

### Condición del Bug

El bug se manifiesta cuando el middleware falla en validar autenticación y autorización para rutas protegidas. El archivo `middleware.ts` actualmente solo valida el enrutamiento del contexto de la aplicación (admin/client/seller) pero NO valida la presencia del token JWT, autenticidad, expiración o coincidencia de rol. Esto crea múltiples vulnerabilidades de seguridad donde usuarios no autorizados pueden acceder a recursos protegidos.

**Especificación Formal:**
```
FUNCIÓN esCondiciónBug(request)
  ENTRADA: request de tipo Request con cookies y pathname
  SALIDA: boolean
  
  token := extraerTokenDeCookies(request.cookies)
  pathname := request.pathname
  esRutaProtegida := NO esRutaPublica(pathname) Y NO debeOmitir(pathname)
  
  RETORNAR esRutaProtegida Y (
    token ES NULO O
    NO esValidaFirmaJWT(token) O
    tokenExpirado(token) O
    NO rolCoincideConContextoRuta(token.role, pathname, appContext)
  )
FIN FUNCIÓN
```

### Ejemplos

- **Token Expirado**: Usuario con JWT exp=1640000000 (expirado) accede a `/admin/dashboard` → Actualmente permitido, debería redirigir a `/authentication/sign-in`
- **Token Inválido**: Usuario con JWT malformado "invalid.token.here" accede a `/seller/orders` → Actualmente permitido, debería redirigir a `/authentication/sign-in`
- **Rol No Coincide**: Usuario con role='client' en JWT accede a `/admin/users` → Actualmente permitido, debería redirigir a página de error de acceso denegado
- **Token Faltante**: Usuario sin cookie de token accede a `/client/orders` → Actualmente permitido, debería redirigir a `/authentication/sign-in`
- **Usuario Bloqueado**: Usuario con bloqueado=1 en base de datos pero JWT válido accede a rutas → Actualmente permitido hasta que expire el token (comportamiento esperado para auth stateless), pero debería ser bloqueado en el login

## Comportamiento Esperado

### Requisitos de Preservación

**Comportamientos Sin Cambios:**
- Usuarios válidos con tokens correctos y roles coincidentes deben continuar accediendo a sus rutas autorizadas sin interrupciones
- Contexto de aplicación 'both' (modo desarrollo) debe continuar permitiendo acceso a todas las rutas sin restricciones de contexto
- Assets estáticos (/_astro/*, /_image/*, /assets/*, /favicon*, /robots.txt, /sitemap*) deben continuar siendo servidos sin autenticación
- Rutas API (/api/*) deben continuar siendo accesibles (manejan su propia autenticación vía middleware del backend)
- Fallos de validación de contexto de aplicación (ej: app client accediendo a /admin) deben continuar retornando 404 Not Found
- Flujo de logout debe continuar limpiando todos los tokens y redirigiendo a /authentication/sign-in
- user-menu.js debe continuar obteniendo y mostrando datos del perfil del usuario desde /api/auth/me

**Alcance:**
Todos los requests que NO involucran rutas protegidas (rutas públicas, assets, endpoints API) no deberían ser afectados por este fix. Esto incluye:
- Rutas públicas de autenticación (/authentication/*)
- Assets estáticos e internos de Astro
- Rutas API (el backend maneja la autenticación)
- Rutas de información (/info/*)

## Causa Raíz Hipotética

Basado en la descripción del bug y análisis del código, las causas raíz son:

1. **Lógica de Middleware Incompleta**: El middleware fue diseñado solo para manejar el enrutamiento del contexto de aplicación (separación admin/client/seller) y nunca implementó lógica de validación JWT. Esto es una funcionalidad faltante más que código roto.

2. **Lógica de Validación Dispersa**: La validación de autenticación existe en múltiples lugares (user-menu.js, páginas individuales) pero no en el middleware centralizado, creando aplicación inconsistente de seguridad.

3. **Sin Verificación JWT**: El middleware no importa ni usa ninguna librería JWT (como jsonwebtoken o jose) para verificar firmas de tokens y expiración.

4. **Sin Autorización Basada en Roles**: El middleware valida el contexto de aplicación pero no los roles de usuario, permitiendo desajustes de rol (ej: client accediendo a rutas admin dentro de la misma app).

5. **Extracción de Token Faltante**: El middleware no lee el token JWT de las cookies httpOnly para realizar validación.

## Propiedades de Corrección

Propiedad 1: Condición Bug - Middleware Valida Autenticación y Autorización

_Para cualquier_ request a una ruta protegida donde el token JWT está ausente, inválido, expirado, o el rol del usuario no coincide con el contexto de la ruta, el middleware DEBE rechazar el request ya sea redirigiendo a `/authentication/sign-in` (para fallos de autenticación) o retornando 403 Forbidden (para fallos de autorización), y DEBE limpiar tokens inválidos de las cookies.

**Valida: Requisitos 2.1, 2.3, 2.4, 2.5, 2.6**

Propiedad 2: Preservación - Comportamiento de Rutas No Protegidas

_Para cualquier_ request que NO es a una ruta protegida (rutas públicas, assets estáticos, rutas API, modo 'both'), el middleware DEBE producir exactamente el mismo comportamiento que el middleware original, preservando toda la funcionalidad existente para patrones de acceso no autenticados.

**Valida: Requisitos 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Implementación del Fix

### Cambios Requeridos

Asumiendo que nuestro análisis de causa raíz es correcto:

**Archivo**: `Frontend/src/middleware.ts`

**Función**: `onRequest` (manejador del middleware)

**Cambios Específicos**:

1. **Agregar Importación de Librería JWT**: Importar librería `jose` para verificación JWT (ligera, compatible con edge)
   - Agregar `import { jwtVerify } from 'jose';` al inicio
   - Usar jose en lugar de jsonwebtoken para compatibilidad con Astro edge

2. **Agregar Función de Extracción de Token**: Crear helper para extraer JWT de cookies
   - Leer cookie 'token' de los headers del request
   - Parsear string de cookie para extraer valor del token
   - Retornar null si el token no se encuentra

3. **Agregar Función de Validación JWT**: Crear helper para verificar firma JWT y expiración
   - Usar `jwtVerify` con JWT_SECRET del entorno
   - Capturar errores para firmas inválidas o tokens expirados
   - Retornar payload decodificado si es válido, null en caso contrario

4. **Agregar Función de Coincidencia de Rol**: Crear helper para validar que el rol coincide con el contexto de la ruta
   - Extraer rol del usuario del payload JWT
   - Mapear pathname de la ruta al rol requerido (admin/seller/client)
   - Manejar contexto 'both' (siempre permitir)
   - Retornar true si el rol coincide, false en caso contrario

5. **Agregar Detección de Ruta Pública**: Extender lógica de bypass para incluir rutas de autenticación
   - Agregar `/authentication/*` a la función shouldBypass
   - Agregar `/info/*` a la función shouldBypass
   - Mantener bypasses existentes de assets y API

6. **Implementar Flujo de Autenticación en Middleware**:
   - Después de validación de contexto, extraer token de cookies
   - Si no hay token y la ruta es protegida → redirigir a `/authentication/sign-in`
   - Si existe token, verificar firma y expiración
   - Si inválido/expirado → limpiar cookie y redirigir a `/authentication/sign-in`
   - Si válido, decodificar payload y almacenar en `context.locals.user`
   - Validar que el rol coincide con el contexto de la ruta
   - Si el rol no coincide → redirigir a página de error de acceso denegado (`/error/access-denied`) con diseño del layout existente
   - Si todas las verificaciones pasan → llamar `next()`

7. **Agregar Header de Respuesta para Limpiar Cookie**: Cuando se redirige por token inválido
   - Establecer header `Set-Cookie` para limpiar cookie de token
   - Usar `token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`

**Archivo**: `Frontend/public/js/user-menu.js`

**Función**: Múltiples funciones (fetchProfile, bootstrap)

**Cambios Específicos**:

1. **Eliminar Lógica de Validación de Token**: Remover cualquier verificación de autenticación
   - Mantener solo lógica de obtención y visualización de perfil
   - Remover lógica de inferencia de rol (el middleware maneja esto)
   - Simplificar para solo llamar `/api/auth/me` y mostrar resultados

2. **Simplificar Función Bootstrap**: Remover verificaciones de estado de autenticación
   - Mantener llamadas a loadCachedProfile y fetchProfile
   - Remover cualquier lógica de validación de token o redirección

3. **Mantener Flujo de Logout Sin Cambios**: Mantener funcionalidad de logout existente
   - Mantener limpieza de token de localStorage y cookies
   - Mantener redirección a `/authentication/sign-in`
   - Mantener llamada API de logout

## Estrategia de Testing

### Enfoque de Validación

La estrategia de testing sigue un enfoque de dos fases: primero, exponer contraejemplos que demuestran el bug en código sin fix (bypasses de autenticación), luego verificar que el fix funciona correctamente (bloquea acceso no autorizado) y preserva el comportamiento existente (permite acceso autorizado).

### Verificación Exploratoria de Condición de Bug

**Objetivo**: Exponer contraejemplos que demuestran el bug ANTES de implementar el fix. Confirmar que el acceso no autorizado es actualmente posible. Si no podemos reproducir el bug, necesitaremos re-hipotetizar.

**Plan de Prueba**: Escribir tests que simulen requests con tokens faltantes, inválidos, expirados y desajustes de rol a rutas protegidas. Ejecutar estos tests en el middleware SIN FIX para observar que el acceso no autorizado es permitido y entender las brechas de seguridad.

**Casos de Prueba**:
1. **Test de Token Faltante**: Request a `/admin/dashboard` sin cookie de token (tendrá éxito en código sin fix, debería fallar después del fix)
2. **Test de Token Expirado**: Request a `/seller/orders` con JWT exp en el pasado (tendrá éxito en código sin fix, debería fallar después del fix)
3. **Test de Firma Inválida**: Request a `/client/profile` con JWT malformado (tendrá éxito en código sin fix, debería fallar después del fix)
4. **Test de Desajuste de Rol**: Request a `/admin/users` con role='client' en JWT (tendrá éxito en código sin fix, debería redirigir a página de error después del fix)
5. **Test de Token Válido**: Request a `/admin/dashboard` con JWT válido y role='admin' (debería tener éxito en código con y sin fix)

**Contraejemplos Esperados**:
- Requests no autorizados son permitidos a rutas protegidas
- No hay redirecciones a `/authentication/sign-in` para tokens inválidos
- No hay redirecciones a página de error para desajustes de rol
- Causas posibles: validación JWT faltante, verificación de rol faltante, lógica de middleware incompleta

### Verificación del Fix

**Objetivo**: Verificar que para todas las entradas donde la condición de bug se cumple (requests no autorizados), el middleware corregido produce el comportamiento esperado (bloquea acceso).

**Pseudocódigo:**
```
PARA TODO request DONDE esCondiciónBug(request) HACER
  response := middleware_corregido(request)
  AFIRMAR (response.status === 302 Y response.location === '/authentication/sign-in') O
         (response.status === 302 Y response.location === '/error/access-denied')
FIN PARA
```

### Verificación de Preservación

**Objetivo**: Verificar que para todas las entradas donde la condición de bug NO se cumple (requests autorizados, rutas públicas), el middleware corregido produce el mismo resultado que el middleware original.

**Pseudocódigo:**
```
PARA TODO request DONDE NO esCondiciónBug(request) HACER
  AFIRMAR middleware_original(request) = middleware_corregido(request)
FIN PARA
```

**Enfoque de Testing**: Se recomienda testing basado en propiedades para verificación de preservación porque:
- Genera muchos casos de prueba automáticamente a través del dominio de entrada (varias rutas, tokens, roles)
- Captura casos extremos que tests unitarios manuales podrían perder (patrones de ruta inusuales, condiciones de frontera)
- Proporciona garantías fuertes de que el comportamiento no cambia para todos los patrones de acceso autorizados

**Plan de Prueba**: Observar comportamiento en código SIN FIX primero para acceso de usuario válido, assets estáticos, rutas API y modo 'both', luego escribir tests basados en propiedades capturando ese comportamiento.

**Casos de Prueba**:
1. **Preservación de Acceso de Usuario Válido**: Observar que usuarios con tokens válidos y roles coincidentes acceden a sus rutas exitosamente en código sin fix, luego verificar que esto continúa después del fix
2. **Preservación de Asset Estático**: Observar que assets estáticos son servidos sin autenticación en código sin fix, luego verificar que esto continúa después del fix
3. **Preservación de Ruta API**: Observar que rutas /api/* son accesibles en código sin fix, luego verificar que esto continúa después del fix
4. **Preservación de Modo Both**: Observar que appContext='both' permite todo acceso en código sin fix, luego verificar que esto continúa después del fix
5. **Preservación de 404 de Contexto**: Observar que desajustes de contexto retornan 404 en código sin fix, luego verificar que esto continúa después del fix

### Tests Unitarios

- Test de extracción JWT de cookies (cookie válida, cookie faltante, cookie malformada)
- Test de verificación JWT (firma válida, firma inválida, token expirado, secret faltante)
- Test de lógica de coincidencia de rol (coincidencia admin/admin, desajuste client/admin, modo 'both')
- Test de detección de ruta pública (rutas de autenticación, assets, rutas API)
- Test de respuestas de redirección (header de location correcto, header de limpieza de cookie)
- Test de respuestas de redirección a página de error para desajustes de rol
- Test de población de context.locals.user con payload JWT decodificado

### Tests Basados en Propiedades

- Generar JWTs válidos aleatorios con varios roles y verificar que acceden a rutas coincidentes
- Generar JWTs inválidos aleatorios (expirados, firma incorrecta, malformados) y verificar que son rechazados
- Generar paths de ruta aleatorios y verificar que rutas públicas omiten autenticación
- Generar valores de appContext aleatorios y verificar que modo 'both' permite todo acceso
- Generar combinaciones aleatorias de rol/ruta y verificar que desajustes redirigen a página de error

### Tests de Integración

- Test de flujo completo de autenticación: login → recibir JWT → acceder a ruta protegida → logout
- Test de flujo de expiración de token: login → esperar expiración → acceder a ruta → redirigir a sign-in
- Test de acceso basado en rol: login como client → acceder a rutas client (éxito) → acceder a rutas admin (redirigir a página de error)
- Test de flujo de usuario bloqueado: bloquear usuario en base de datos → JWT existente aún funciona hasta expiración (comportamiento stateless)
- Test de visualización de menú de usuario: login → menú de usuario muestra datos correctos de perfil desde contexto del middleware
- Test de acceso entre contextos: app client → acceder a rutas /admin → recibir 404 (validación de contexto)
