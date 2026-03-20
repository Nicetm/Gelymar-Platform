# Plan de Implementación: Frontend Code Refactoring

## Resumen

Refactorización incremental del frontend para consolidar funciones duplicadas en `utils.js`. Cada tarea migra una función a la vez, verificando que no se rompa funcionalidad existente. El orden sigue las fases del diseño: primero mover funciones existentes, luego eliminar copias redundantes, y finalmente crear nuevas abstracciones.

## Tareas

- [ ] 1. Centralizar setupStickyHorizontalScrollbar en utils.js
  - [ ] 1.1 Copiar la función `setupStickyHorizontalScrollbar` desde `orders.js` a `utils.js` y exportarla
    - Copiar la implementación completa de `setupStickyHorizontalScrollbar` de `Frontend/public/js/orders.js` a `Frontend/public/js/utils.js`
    - Agregar `export` a la función en utils.js
    - _Requerimientos: 1.1_

  - [ ] 1.2 Migrar `orders.js` para importar `setupStickyHorizontalScrollbar` desde utils.js
    - Eliminar la definición local de `setupStickyHorizontalScrollbar` en `Frontend/public/js/orders.js`
    - Agregar `setupStickyHorizontalScrollbar` al import existente desde `'./utils.js'`
    - Verificar que las llamadas a la función siguen funcionando sin cambios
    - _Requerimientos: 1.2, 1.3, 7.1_

  - [ ] 1.3 Migrar `document-center.js` para importar `setupStickyHorizontalScrollbar` desde utils.js
    - Eliminar la definición local de `setupStickyHorizontalScrollbar` en `Frontend/public/js/document-center.js`
    - Agregar `setupStickyHorizontalScrollbar` al import existente desde `'./utils.js'`
    - Verificar que las llamadas a la función siguen funcionando sin cambios
    - _Requerimientos: 1.2, 1.3, 7.1_

- [ ] 2. Centralizar setupFloatingTooltips en utils.js
  - [ ] 2.1 Copiar `setupFloatingTooltips` y sus handlers internos (`handleTooltipEnter`, `handleTooltipLeave`) a utils.js y exportar
    - Copiar `handleTooltipEnter`, `handleTooltipLeave` y `setupFloatingTooltips` desde uno de los archivos fuente a `Frontend/public/js/utils.js`
    - Exportar solo `setupFloatingTooltips` (los handlers son internos)
    - _Requerimientos: 2.1_

  - [ ] 2.2 Migrar `orders.js` para importar `setupFloatingTooltips` desde utils.js
    - Eliminar definición local de `setupFloatingTooltips`, `handleTooltipEnter` y `handleTooltipLeave` en `orders.js`
    - Agregar `setupFloatingTooltips` al import desde `'./utils.js'`
    - _Requerimientos: 2.2, 2.3, 7.3_

  - [ ] 2.3 Migrar `document-center.js` para importar `setupFloatingTooltips` desde utils.js
    - Eliminar definición local y handlers en `document-center.js`
    - Agregar `setupFloatingTooltips` al import desde `'./utils.js'`
    - _Requerimientos: 2.2, 2.3, 7.3_

  - [ ] 2.4 Migrar `folders.js` para importar `setupFloatingTooltips` desde utils.js
    - Eliminar definición local y handlers en `folders.js`
    - Agregar `setupFloatingTooltips` al import desde `'./utils.js'`
    - _Requerimientos: 2.2, 2.3, 7.3_

  - [ ] 2.5 Migrar `files.js` para importar `setupFloatingTooltips` desde utils.js
    - Eliminar definición local y handlers en `files.js`
    - Agregar `setupFloatingTooltips` al import desde `'./utils.js'`
    - _Requerimientos: 2.2, 2.3, 7.3_

  - [ ] 2.6 Migrar `clients.js` para importar `setupFloatingTooltips` desde utils.js
    - Eliminar definición local y handlers en `clients.js`
    - Agregar `setupFloatingTooltips` al import desde `'./utils.js'`
    - _Requerimientos: 2.2, 2.3, 7.3_

  - [ ] 2.7 Migrar `sidebar-admin.js`, `sidebar-client.js` y `sidebar-seller.js` para importar `setupFloatingTooltips` desde utils.js
    - Eliminar definición local y handlers en cada archivo sidebar
    - Agregar `setupFloatingTooltips` al import desde `'./utils.js'` en cada uno
    - _Requerimientos: 2.2, 2.3, 7.3_

- [ ] 3. Checkpoint - Verificar funciones movidas
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que `setupStickyHorizontalScrollbar` y `setupFloatingTooltips` se exportan correctamente desde utils.js
  - Verificar que ningún archivo consumidor tiene copias locales residuales

- [ ] 4. Eliminar copias locales de formatDateShort
  - [ ] 4.1 Migrar `orders.js` para importar `formatDateShort` desde utils.js
    - Eliminar la definición local de `formatDateShort` en `orders.js`
    - Agregar `formatDateShort` al import existente desde `'./utils.js'`
    - _Requerimientos: 3.1, 3.2, 3.3, 7.1_

  - [ ] 4.2 Migrar `folders.js` para importar `formatDateShort` desde utils.js
    - Eliminar la definición local de `formatDateShort` en `folders.js`
    - Agregar `formatDateShort` al import existente desde `'./utils.js'`
    - _Requerimientos: 3.1, 3.2, 3.3, 7.1_

  - [ ] 4.3 Analizar y migrar `formatDateShort` en `document-center.js`
    - La implementación local en `document-center.js` calcula fechas relativas ("hoy", "ayer"), diferente a la versión de utils.js (formato `YYYY-MM-DD`)
    - Verificar todos los usos de `formatDateShort` en `document-center.js` para determinar si requieren formato relativo o estándar
    - Si los usos requieren formato relativo, renombrar la función local a `formatDateRelative` para evitar conflicto de nombres y agregar import de `formatDateShort` desde utils.js si se necesita
    - Si los usos son compatibles con `YYYY-MM-DD`, eliminar la copia local e importar desde utils.js
    - _Requerimientos: 3.2, 3.3, 3.4, 7.1_

  - [ ]* 4.4 Escribir test de propiedad para formatDateShort
    - **Propiedad 1: formatDateShort produce formato YYYY-MM-DD**
    - **Propiedad 2: Equivalencia de formatDateShort entre utils y copias locales**
    - **Valida: Requerimientos 3.1, 3.3**

- [ ] 5. Eliminar copias locales de confirmAction
  - [ ] 5.1 Analizar diferencias entre `confirmAction` local de `files.js` y la versión de utils.js
    - Comparar firmas, parámetros y tipos soportados
    - Si la versión de utils.js no soporta tipo `question` o botón "Entendido" para tipo `error`, extender utils.js para soportarlos sin romper usos existentes
    - _Requerimientos: 4.4_

  - [ ] 5.2 Migrar `files.js` para importar `confirmAction` desde utils.js
    - Eliminar la definición local de `confirmAction` en `files.js`
    - Agregar `confirmAction` al import desde `'./utils.js'`
    - Adaptar las llamadas existentes para usar la firma de utils.js
    - _Requerimientos: 4.1, 4.2, 4.4, 7.1_

  - [ ] 5.3 Migrar `notification-bell.js` para importar `confirmAction` desde utils.js
    - Eliminar la definición local de `confirmAction` en `notification-bell.js`
    - Agregar `confirmAction` al import desde `'./utils.js'`
    - Adaptar las llamadas para pasar textos de traducción via el parámetro `options`
    - _Requerimientos: 4.1, 4.3, 4.4, 7.1_

- [ ] 6. Checkpoint - Verificar eliminación de copias
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que no quedan copias locales de `formatDateShort` ni `confirmAction` en archivos consumidores
  - Verificar que el comportamiento de modales y formateo de fechas es idéntico al original

- [ ] 7. Crear función apiFetch en utils.js
  - [ ] 7.1 Implementar `apiFetch` en utils.js
    - Agregar la función `apiFetch(url, options)` a `Frontend/public/js/utils.js` según el diseño
    - Implementar: obtención de token desde localStorage, header Authorization, fusión de headers, manejo de 401, redirección a sign-in
    - Exportar la función
    - _Requerimientos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 7.2 Escribir tests de propiedad para apiFetch
    - **Propiedad 3: apiFetch preserva headers de autorización y headers personalizados**
    - **Propiedad 4: apiFetch retorna Response**
    - **Valida: Requerimientos 5.2, 5.5, 5.6**

  - [ ] 7.3 Migrar peticiones fetch en `orders.js` para usar `apiFetch`
    - Reemplazar llamadas `fetch` con headers de Authorization por `apiFetch`
    - Eliminar lógica local de obtención de token y manejo de 401 donde sea redundante
    - _Requerimientos: 5.7, 7.1, 7.2_

  - [ ] 7.4 Migrar peticiones fetch en `clients.js` para usar `apiFetch`
    - Reemplazar llamadas `fetch` con headers de Authorization por `apiFetch`
    - Eliminar lógica local de obtención de token y manejo de 401 donde sea redundante
    - _Requerimientos: 5.7, 7.1_

  - [ ] 7.5 Migrar peticiones fetch en `document-center.js` para usar `apiFetch`
    - Reemplazar llamadas `fetch` con headers de Authorization por `apiFetch`
    - _Requerimientos: 5.7, 7.1_

  - [ ] 7.6 Migrar peticiones fetch en `files.js` para usar `apiFetch`
    - Reemplazar llamadas `fetch` con headers de Authorization por `apiFetch`
    - _Requerimientos: 5.7, 7.1_

  - [ ] 7.7 Migrar peticiones fetch en `folders.js` para usar `apiFetch`
    - Reemplazar llamadas `fetch` con headers de Authorization por `apiFetch`
    - _Requerimientos: 5.7, 7.1_

  - [ ] 7.8 Migrar peticiones fetch en los archivos restantes para usar `apiFetch`
    - Migrar `notification-bell.js`, `sellers.js`, `projections.js`, `messages.js`, `sidebar-admin.js`, `sidebar-client.js`, `sidebar-seller.js`, `user-menu.js` y cualquier otro archivo con el patrón `Authorization: Bearer`
    - _Requerimientos: 5.7, 7.1_

- [ ] 8. Checkpoint - Verificar migración de apiFetch
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que no quedan llamadas `fetch` con `Authorization: Bearer` manuales en archivos migrados
  - Verificar que la autenticación y redirección a login funcionan correctamente

- [ ] 9. Crear createCacheManager en utils.js
  - [ ] 9.1 Implementar `createCacheManager` en utils.js
    - Agregar la función `createCacheManager(cacheKey, duration)` a `Frontend/public/js/utils.js` según el diseño
    - Implementar métodos: `isValid()`, `save(data)`, `load()`, `clear()`
    - Manejo de errores con `try/catch` y `console.warn`
    - Exportar la función
    - _Requerimientos: 6.1, 6.2, 6.3, 6.6_

  - [ ]* 9.2 Escribir test de propiedad para createCacheManager
    - **Propiedad 5: CacheManager round-trip (save/load)**
    - **Valida: Requerimientos 6.2, 6.3**

  - [ ] 9.3 Migrar `orders.js` para usar `createCacheManager`
    - Reemplazar funciones locales de caché (`isCacheValid`, `saveToCache`, `loadFromCache`, `clearCache`) por una instancia de `createCacheManager('orders_cache', 5 * 60 * 1000)`
    - Adaptar todas las llamadas a las funciones de caché para usar los métodos del CacheManager
    - _Requerimientos: 6.4, 7.1_

  - [ ] 9.4 Migrar `clients.js` para usar `createCacheManager`
    - Reemplazar funciones locales de caché por una instancia de `createCacheManager('customers_cache', 5 * 60 * 1000)`
    - Adaptar todas las llamadas a las funciones de caché para usar los métodos del CacheManager
    - _Requerimientos: 6.5, 7.1_

- [ ] 10. Checkpoint final - Verificación completa
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que `utils.js` exporta todas las funciones nuevas: `setupStickyHorizontalScrollbar`, `setupFloatingTooltips`, `apiFetch`, `createCacheManager`
  - Verificar que no quedan copias locales de funciones migradas en ningún archivo consumidor
  - Verificar que no hay imports sin usar ni funciones huérfanas

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requerimientos específicos para trazabilidad
- Los checkpoints aseguran validación incremental entre fases
- Los tests de propiedades validan propiedades universales de correctitud
- La migración de `apiFetch` (tarea 7) es la más extensa por la cantidad de archivos afectados; se puede dividir en sesiones
