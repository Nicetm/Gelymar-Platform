# Plan de Implementación: Detección de Cambios en Órdenes

## Resumen

Implementar el sistema de detección de cambios en órdenes como cron job. El servicio consulta SQL Server, genera snapshots normalizados, compara hashes SHA-256, registra cambios campo a campo en MySQL, notifica por correo a admins, y expone endpoints REST para consultar/reconocer cambios. Se asume que las tablas MySQL (`order_snapshots`, `order_changes`) ya fueron creadas manualmente.

## Tareas

- [x] 1. Crear el servicio principal de detección de cambios
  - [x] 1.1 Crear `Backend/services/orderChangeDetection.service.js` con las funciones utilitarias
    - Implementar `normalizeSnapshotValue`, `buildSnapshot`, `deterministicStringify`, `computeSnapshotHash`, `compareSnapshots`
    - Reutilizar `normalizeValue`, `normalizeDate`, `normalizeDecimal` de `Backend/mappers/sqlsoftkey/utils.js`
    - Para `compareSnapshots`, comparar campos escalares directamente y campos de items por `linea` (reportar como `items[linea].campo`)
    - _Requerimientos: 1.1, 1.2, 1.3, 1.4, 2.1, 7.1, 7.2, 7.3, 7.4_

  - [x] 1.2 Implementar `runDetectionCycle()` en el mismo servicio
    - Verificar conexión a SQL Server al inicio; si falla, loguear y abortar (Req 6.2)
    - Consultar órdenes activas con JOIN de HDR + FACT + ITEM desde SQL Server
    - Agrupar resultados por `(pc, factura)`
    - Por cada orden: buildSnapshot → computeHash → buscar snapshot previo en MySQL
    - Si no existe snapshot previo: INSERT inicial sin registrar cambios (Req 2.5)
    - Si hash coincide: skip (Req 2.4)
    - Si hash difiere: compareSnapshots → INSERT cambios en `order_changes` → UPDATE `order_snapshots` (Req 2.1, 2.2, 2.3)
    - Manejo de errores por orden individual: loguear y continuar (Req 6.1, 6.3)
    - Loguear resumen al final: órdenes procesadas, cambios detectados, tiempo de ejecución (Req 3.3)
    - _Requerimientos: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 6.1, 6.2, 6.3_

  - [x] 1.3 Implementar envío de correo a administradores al detectar cambios
    - Al finalizar el ciclo, si hay cambios: obtener admins con `getAdminNotificationRecipients()` de `user.service.js`
    - Construir `summaryText` con detalle de cambios por orden (pc, factura, campos, valores anterior/nuevo)
    - Enviar usando `sendAdminNotificationSummary` de `email.service.js`
    - Si no hay cambios, no enviar correo (Req 5.4)
    - Manejar errores de envío sin detener el proceso (loguear y continuar)
    - _Requerimientos: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2. Checkpoint - Verificar que el servicio funciona correctamente
  - Asegurar que el servicio se puede importar sin errores, preguntar al usuario si hay dudas.

- [x] 3. Crear controller y rutas REST
  - [x] 3.1 Crear `Backend/controllers/orderChangeDetection.controller.js`
    - `detectOrderChanges` (POST): leer config desde `getCronTasksConfig()`, si deshabilitado retornar `{ skipped: true }`, si no ejecutar `runDetectionCycle()` y retornar resumen (Req 3.1, 3.2)
    - `getOrderChanges` (GET /:pc): retornar cambios no reconocidos de una orden con `field_name`, `old_value`, `new_value`, `detected_at` (Req 4.2)
    - `acknowledgeOrderChanges` (POST /:pc/acknowledge): marcar cambios como `acknowledged=1` con `acknowledged_by` y `acknowledged_at` (Req 4.3)
    - `getChangeSummary` (GET /summary): retornar lista de órdenes con `has_unacknowledged_changes` (Req 4.1)
    - _Requerimientos: 3.1, 3.2, 4.1, 4.2, 4.3_

  - [x] 3.2 Crear `Backend/routes/orderChangeDetection.routes.js`
    - GET `/summary` → `getChangeSummary`
    - GET `/:pc` → `getOrderChanges`
    - POST `/:pc/acknowledge` → `acknowledgeOrderChanges`
    - _Requerimientos: 4.1, 4.2, 4.3_

- [x] 4. Integrar con el sistema existente
  - [x] 4.1 Registrar el servicio en `Backend/config/container.js`
    - Importar `orderChangeDetection.service.js` y registrarlo con `asValue`
    - _Requerimientos: 3.1_

  - [x] 4.2 Registrar rutas y endpoint cron en `Backend/app.js`
    - Agregar `app.post('/api/cron/detect-order-changes', cronLimiter, detectOrderChangesController)` junto a los otros endpoints cron
    - Agregar `app.use('/api/order-changes', authMiddleware, readLimiter, authorizeRoles(['admin']), orderChangeRoutes)` para las rutas REST protegidas
    - _Requerimientos: 3.1, 4.1, 4.2, 4.3_

- [x] 5. Checkpoint final - Verificar integración completa
  - Asegurar que todos los archivos se importan correctamente y no hay errores de sintaxis. Preguntar al usuario si hay dudas.

## Notas

- Las tablas MySQL (`order_snapshots`, `order_changes`) se crean manualmente por el usuario
- Se debe insertar la configuración en `param_config` manualmente: `INSERT INTO param_config (name, type, params) VALUES ('orderChangeDetection', 'configuración', '{"enable": 1, "schedule": "*/30 * * * *"}')`
- El servicio reutiliza funciones de normalización existentes en `Backend/mappers/sqlsoftkey/utils.js`
- El correo usa `sendAdminNotificationSummary` existente en `email.service.js`
