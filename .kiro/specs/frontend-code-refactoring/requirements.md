# Documento de Requerimientos

## Introducción

Refactorización del código frontend de la plataforma Gelymar para eliminar duplicaciones de funciones y patrones repetidos en múltiples archivos JavaScript. El proyecto usa Astro con módulos ES (`import`/`export`) y los archivos JS residen en `Frontend/public/js/`. El archivo `utils.js` ya actúa como módulo central de utilidades compartidas. El objetivo es consolidar código duplicado sin alterar ninguna funcionalidad existente.

## Glosario

- **Utils**: Módulo central de utilidades compartidas (`Frontend/public/js/utils.js`) que exporta funciones reutilizables vía ES modules.
- **Módulo_Consumidor**: Cualquier archivo JS en `Frontend/public/js/` que importa funciones desde Utils u otros módulos.
- **apiFetch**: Función centralizada propuesta para realizar peticiones HTTP autenticadas con el token JWT del usuario.
- **CacheManager**: Módulo genérico propuesto para gestionar caché en `localStorage` con expiración configurable.
- **setupStickyHorizontalScrollbar**: Función que crea una barra de scroll horizontal sticky sincronizada con el contenido de tablas.
- **setupFloatingTooltips**: Función que inicializa tooltips flotantes en elementos con atributo `data-tooltip`.
- **formatDateShort**: Función que formatea una fecha a formato corto `YYYY-MM-DD`.
- **confirmAction**: Función que muestra un modal de confirmación personalizado y retorna una promesa con la decisión del usuario.

## Requerimientos

### Requerimiento 1: Centralizar setupStickyHorizontalScrollbar en Utils

**Historia de Usuario:** Como desarrollador, quiero que `setupStickyHorizontalScrollbar` exista en un solo lugar, para evitar mantener copias idénticas en múltiples archivos.

#### Criterios de Aceptación

1. THE Utils SHALL exportar la función `setupStickyHorizontalScrollbar` con la misma firma y comportamiento que las implementaciones actuales en `orders.js` y `document-center.js`.
2. WHEN un Módulo_Consumidor necesite la funcionalidad de scrollbar horizontal sticky, THE Módulo_Consumidor SHALL importar `setupStickyHorizontalScrollbar` desde Utils en lugar de definir una copia local.
3. WHEN se eliminen las copias locales de `setupStickyHorizontalScrollbar`, THE sistema SHALL mantener el mismo comportamiento visual y funcional de las barras de scroll horizontales sticky en las vistas de órdenes y centro de documentos.

### Requerimiento 2: Centralizar setupFloatingTooltips en Utils

**Historia de Usuario:** Como desarrollador, quiero que `setupFloatingTooltips` exista en un solo lugar, para no tener 7 copias de la misma función repartidas en el código.

#### Criterios de Aceptación

1. THE Utils SHALL exportar la función `setupFloatingTooltips` con la misma firma y comportamiento que las implementaciones actuales.
2. WHEN un Módulo_Consumidor necesite tooltips flotantes, THE Módulo_Consumidor SHALL importar `setupFloatingTooltips` desde Utils en lugar de definir una copia local.
3. WHEN se eliminen las copias locales de `setupFloatingTooltips` en `orders.js`, `document-center.js`, `folders.js`, `files.js`, `clients.js`, `sidebar-admin.js`, `sidebar-client.js` y `sidebar-seller.js`, THE sistema SHALL mantener el mismo comportamiento de tooltips flotantes en todas las vistas afectadas.

### Requerimiento 3: Eliminar copias locales de formatDateShort

**Historia de Usuario:** Como desarrollador, quiero que todos los archivos usen la función `formatDateShort` ya existente en Utils, para eliminar las 3 copias redundantes.

#### Criterios de Aceptación

1. THE Utils SHALL continuar exportando la función `formatDateShort` existente sin modificaciones a su comportamiento.
2. WHEN un Módulo_Consumidor necesite formatear una fecha en formato corto, THE Módulo_Consumidor SHALL importar `formatDateShort` desde Utils.
3. WHEN se eliminen las copias locales de `formatDateShort` en `orders.js`, `document-center.js` y `folders.js`, THE sistema SHALL producir los mismos resultados de formateo de fechas en todas las vistas afectadas.
4. IF la implementación local de `formatDateShort` en algún archivo difiere de la versión en Utils, THEN THE desarrollador SHALL verificar que la versión de Utils cubre todos los casos de uso antes de eliminar la copia local.

### Requerimiento 4: Eliminar copias locales de confirmAction

**Historia de Usuario:** Como desarrollador, quiero que `files.js` y `notification-bell.js` usen la función `confirmAction` ya existente en Utils, para eliminar las copias redundantes.

#### Criterios de Aceptación

1. THE Utils SHALL continuar exportando la función `confirmAction` existente sin modificaciones a su firma pública.
2. WHEN `files.js` necesite mostrar un diálogo de confirmación, THE `files.js` SHALL importar `confirmAction` desde Utils en lugar de definir una copia local.
3. WHEN `notification-bell.js` necesite mostrar un diálogo de confirmación, THE `notification-bell.js` SHALL importar `confirmAction` desde Utils en lugar de definir una copia local.
4. IF la copia local de `confirmAction` en algún archivo tiene parámetros o comportamiento diferente a la versión de Utils, THEN THE desarrollador SHALL adaptar las llamadas existentes para que sean compatibles con la firma de Utils, o extender la versión de Utils para soportar los casos adicionales sin romper los usos existentes.

### Requerimiento 5: Crear función centralizada apiFetch

**Historia de Usuario:** Como desarrollador, quiero una función `apiFetch` centralizada que agregue automáticamente el token de autenticación y maneje errores comunes, para no repetir el mismo patrón de fetch con headers de autorización en más de 12 archivos.

#### Criterios de Aceptación

1. THE Utils SHALL exportar una función `apiFetch(url, options)` que realice peticiones HTTP usando `fetch`.
2. THE apiFetch SHALL agregar automáticamente el header `Authorization: Bearer ${token}` obteniendo el token desde `localStorage`.
3. WHEN el token no exista o sea inválido, THE apiFetch SHALL redirigir al usuario a la página de inicio de sesión (`/authentication/sign-in`).
4. WHEN la respuesta HTTP tenga código 401, THE apiFetch SHALL redirigir al usuario a la página de inicio de sesión.
5. WHEN el Módulo_Consumidor pase headers adicionales en `options`, THE apiFetch SHALL fusionar esos headers con el header de autorización sin sobrescribirlos.
6. THE apiFetch SHALL retornar el objeto `Response` de `fetch` para que el Módulo_Consumidor pueda procesarlo según su necesidad.
7. WHEN un Módulo_Consumidor migre a usar apiFetch, THE sistema SHALL mantener el mismo comportamiento funcional de las peticiones HTTP existentes.

### Requerimiento 6: Crear módulo genérico de caché CacheManager

**Historia de Usuario:** Como desarrollador, quiero un módulo genérico de caché basado en `localStorage`, para no duplicar las funciones `isCacheValid`, `saveToCache`, `loadFromCache` y `clearCache` en cada archivo que necesite caché.

#### Criterios de Aceptación

1. THE Utils SHALL exportar una función `createCacheManager(cacheKey, duration)` que retorne un objeto con los métodos `isValid()`, `save(data)`, `load()` y `clear()`.
2. THE CacheManager SHALL almacenar datos en `localStorage` usando el `cacheKey` proporcionado como prefijo para las claves de datos y timestamp.
3. THE CacheManager SHALL considerar el caché como válido solo cuando la diferencia entre la hora actual y el timestamp almacenado sea menor que `duration` (en milisegundos).
4. WHEN `orders.js` use CacheManager, THE `orders.js` SHALL crear una instancia con clave `orders_cache` y duración de 5 minutos, reemplazando las funciones locales de caché.
5. WHEN `clients.js` use CacheManager, THE `clients.js` SHALL crear una instancia con clave `customers_cache` y duración de 5 minutos, reemplazando las funciones locales de caché.
6. IF `localStorage` lanza una excepción al guardar datos, THEN THE CacheManager SHALL capturar el error y registrarlo en consola sin interrumpir la ejecución.

### Requerimiento 7: Preservación de funcionalidad existente

**Historia de Usuario:** Como usuario de la plataforma, quiero que la refactorización no altere ningún comportamiento visible, para seguir usando la plataforma sin interrupciones.

#### Criterios de Aceptación

1. WHEN se complete la refactorización, THE sistema SHALL mantener el mismo comportamiento funcional en todas las vistas: órdenes, centro de documentos, archivos, carpetas, clientes, vendedores, proyecciones, mensajería, notificaciones y menú de usuario.
2. WHEN se complete la refactorización, THE sistema SHALL mantener la misma gestión de autenticación (redirección a login cuando el token es inválido o ausente).
3. WHEN se complete la refactorización, THE sistema SHALL mantener el mismo comportamiento visual de tooltips, scrollbars sticky, modales de confirmación y notificaciones.
4. THE refactorización SHALL realizarse de forma incremental (una función a la vez) para minimizar el riesgo de regresiones.
