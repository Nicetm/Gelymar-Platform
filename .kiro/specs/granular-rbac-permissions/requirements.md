# Documento de Requisitos — Sistema Granular de Permisos RBAC

## Introducción

Este documento define los requisitos para implementar un sistema granular de control de acceso basado en roles (RBAC) en la plataforma existente. El sistema reemplazará el mecanismo actual de verificación de roles hardcodeados (`authorizeRoles(['admin'])`) y la tabla `param_config` por un modelo de permisos gestionado desde la base de datos MySQL. Cada elemento de la interfaz (menús del sidebar, elementos del header, botones de acción, enlaces) y cada endpoint de la API será controlado por permisos asignados a roles. Un rol Super Admin tendrá control total sobre la gestión de permisos.

## Glosario

- **Sistema_RBAC**: Módulo de control de acceso basado en roles que gestiona permisos, roles y su asignación a usuarios.
- **Permiso**: Registro en la base de datos que representa una acción o recurso específico al que se puede otorgar o denegar acceso (ej: `orders.create`, `sidebar.clients`, `header.notifications`).
- **Rol**: Agrupación nombrada de permisos que se asigna a usuarios. Ejemplos: Super Admin, Admin, Vendedor, Cliente.
- **Super_Admin**: Rol con acceso total al sistema, incluyendo la gestión de roles y permisos de otros usuarios.
- **Elemento_UI**: Cualquier componente visible en la interfaz: ítems del sidebar, botones del header, botones de acción, enlaces y secciones de configuración.
- **Middleware_Permisos**: Middleware de Express que valida si el usuario autenticado posee el permiso requerido para acceder a un endpoint.
- **Servicio_Permisos**: Servicio backend que consulta y cachea los permisos efectivos de un usuario según su rol.
- **API_Permisos**: Conjunto de endpoints REST para gestionar roles, permisos y asignaciones.
- **Caché_Permisos**: Almacenamiento en memoria de los permisos del usuario para evitar consultas repetidas a la base de datos durante una misma sesión.
- **MySQL**: Base de datos relacional donde se almacenan las tablas de roles, permisos y asignaciones.

## Requisitos

### Requisito 1: Modelo de datos de permisos y roles

**Historia de Usuario:** Como Super Admin, quiero que existan tablas en MySQL para roles, permisos y sus relaciones, para poder gestionar el acceso granular desde la base de datos.

#### Criterios de Aceptación

1. THE Sistema_RBAC SHALL almacenar los roles en una tabla `roles` con columnas: `id` (INT, PK, AUTO_INCREMENT), `name` (VARCHAR, UNIQUE, NOT NULL), `description` (VARCHAR), `is_system` (BOOLEAN, default FALSE), `created_at` (TIMESTAMP), `updated_at` (TIMESTAMP).
2. THE Sistema_RBAC SHALL almacenar los permisos en una tabla `permissions` con columnas: `id` (INT, PK, AUTO_INCREMENT), `key` (VARCHAR, UNIQUE, NOT NULL), `description` (VARCHAR), `category` (VARCHAR, NOT NULL), `created_at` (TIMESTAMP).
3. THE Sistema_RBAC SHALL almacenar la relación roles-permisos en una tabla `role_permissions` con columnas: `role_id` (INT, FK a roles), `permission_id` (INT, FK a permissions), con clave primaria compuesta (`role_id`, `permission_id`).
4. THE Sistema_RBAC SHALL vincular usuarios a roles mediante una columna `role_id` en la tabla `users` que referencia a la tabla `roles`.
5. WHEN se ejecute la migración inicial, THE Sistema_RBAC SHALL crear los roles por defecto: Super Admin (id=0), Admin (id=1), Cliente (id=2), Vendedor (id=3), preservando los IDs existentes para Admin, Cliente y Vendedor.
6. WHEN se ejecute la migración inicial, THE Sistema_RBAC SHALL poblar la tabla `permissions` con todos los permisos correspondientes a los elementos actuales del sidebar, header, acciones de órdenes y endpoints de la API.

### Requisito 2: Servicio backend de permisos

**Historia de Usuario:** Como desarrollador, quiero un servicio centralizado que resuelva los permisos efectivos de un usuario, para que toda verificación de acceso pase por un único punto.

#### Criterios de Aceptación

1. THE Servicio_Permisos SHALL consultar los permisos efectivos de un usuario a partir de su `role_id` realizando un JOIN entre las tablas `roles`, `role_permissions` y `permissions`.
2. THE Servicio_Permisos SHALL retornar los permisos como un arreglo de strings con las claves de permiso (ej: `["orders.view", "orders.create", "sidebar.clients"]`).
3. WHEN se soliciten los permisos de un usuario por segunda vez dentro de la misma petición HTTP, THE Servicio_Permisos SHALL retornar los permisos desde la Caché_Permisos sin consultar la base de datos.
4. THE Servicio_Permisos SHALL exponer un método `hasPermission(userId, permissionKey)` que retorne `true` si el usuario posee el permiso y `false` en caso contrario.
5. THE Servicio_Permisos SHALL exponer un método `getUserPermissions(userId)` que retorne el arreglo completo de permisos del usuario.
6. WHEN el rol del usuario sea Super_Admin, THE Servicio_Permisos SHALL retornar `true` para cualquier verificación de permiso sin consultar la tabla `role_permissions`.

### Requisito 3: Middleware de autorización por permisos

**Historia de Usuario:** Como desarrollador, quiero un middleware que reemplace `authorizeRoles()` y valide permisos granulares, para proteger cada endpoint de la API con permisos específicos.

#### Criterios de Aceptación

1. THE Middleware_Permisos SHALL aceptar uno o más permisos requeridos como parámetro (ej: `authorizePermission('orders.create')`).
2. WHEN el usuario autenticado posea al menos uno de los permisos requeridos, THE Middleware_Permisos SHALL permitir continuar al siguiente handler.
3. WHEN el usuario autenticado no posea ninguno de los permisos requeridos, THE Middleware_Permisos SHALL responder con código HTTP 403 y un mensaje JSON `{ "message": "No tiene permisos para acceder a este recurso" }`.
4. WHEN el token JWT del usuario no contenga información de usuario válida, THE Middleware_Permisos SHALL responder con código HTTP 401.
5. THE Middleware_Permisos SHALL ser compatible con el middleware `authMiddleware` existente, ejecutándose después de la autenticación JWT.
6. WHILE el sistema esté en período de migración, THE Middleware_Permisos SHALL soportar un modo de compatibilidad donde `authorizeRoles()` siga funcionando en paralelo con `authorizePermission()`.

### Requisito 4: API de gestión de roles y permisos

**Historia de Usuario:** Como Super Admin, quiero endpoints para crear, editar y eliminar roles, y asignar permisos a cada rol, para gestionar el acceso sin modificar código.

#### Criterios de Aceptación

1. THE API_Permisos SHALL exponer `GET /api/rbac/roles` que retorne la lista de todos los roles con sus permisos asociados.
2. THE API_Permisos SHALL exponer `POST /api/rbac/roles` que permita crear un nuevo rol con nombre, descripción y lista de permisos.
3. THE API_Permisos SHALL exponer `PUT /api/rbac/roles/:id` que permita actualizar el nombre, descripción y permisos de un rol existente.
4. THE API_Permisos SHALL exponer `DELETE /api/rbac/roles/:id` que permita eliminar un rol que no sea de sistema (`is_system = false`).
5. IF se intenta eliminar un rol con `is_system = true`, THEN THE API_Permisos SHALL responder con código HTTP 400 y mensaje `{ "message": "No se puede eliminar un rol de sistema" }`.
6. THE API_Permisos SHALL exponer `GET /api/rbac/permissions` que retorne la lista completa de permisos agrupados por categoría.
7. THE API_Permisos SHALL exponer `PUT /api/rbac/users/:id/role` que permita asignar un rol a un usuario específico.
8. WHEN se modifiquen los permisos de un rol, THE API_Permisos SHALL invalidar la Caché_Permisos de todos los usuarios con ese rol.
9. THE API_Permisos SHALL restringir todos sus endpoints exclusivamente al rol Super_Admin.

### Requisito 5: Control de visibilidad de elementos del sidebar

**Historia de Usuario:** Como Super Admin, quiero controlar qué ítems del sidebar ve cada rol, para que cada usuario solo vea las secciones a las que tiene acceso.

#### Criterios de Aceptación

1. THE Sistema_RBAC SHALL definir permisos con categoría `sidebar` para cada sección: `sidebar.dashboard`, `sidebar.clients`, `sidebar.sellers`, `sidebar.orders`, `sidebar.messaging`.
2. WHEN el frontend solicite la configuración del sidebar, THE API_Permisos SHALL retornar un endpoint `GET /api/rbac/me/permissions` con los permisos del usuario autenticado.
3. WHEN el usuario no posea el permiso correspondiente a un ítem del sidebar, THE Elemento_UI del sidebar SHALL ocultarse completamente (no renderizarse en el DOM).
4. THE Sistema_RBAC SHALL reemplazar la lógica actual de `sidebarMenuPorRol` en `param_config` por la consulta de permisos del Sistema_RBAC.
5. WHILE el sistema esté en período de migración, THE Sistema_RBAC SHALL consultar primero los permisos RBAC y usar `param_config` como fallback si el usuario no tiene rol RBAC asignado.

### Requisito 6: Control de visibilidad de elementos del header

**Historia de Usuario:** Como Super Admin, quiero controlar qué elementos del header ve cada rol (búsqueda de clientes, notificaciones, alertas), para personalizar la experiencia por rol.

#### Criterios de Aceptación

1. THE Sistema_RBAC SHALL definir permisos con categoría `header` para cada elemento: `header.client_search`, `header.notifications`, `header.users_without_account`, `header.orders_without_documents`.
2. WHEN el usuario no posea el permiso correspondiente a un elemento del header, THE Elemento_UI del header SHALL ocultarse completamente.
3. THE Sistema_RBAC SHALL reemplazar la lógica actual de `headerBusquedaClienteChat`, `headerNotificaciones`, `headerUsersSinCuenta` y `headerOrdenesSinDocumentos` en `param_config` por permisos RBAC.

### Requisito 7: Control granular de acciones sobre órdenes

**Historia de Usuario:** Como Super Admin, quiero controlar qué acciones puede realizar cada rol sobre las órdenes (crear, editar, eliminar, enviar por email, dar visibilidad a clientes), para limitar operaciones según el perfil del usuario.

#### Criterios de Aceptación

1. THE Sistema_RBAC SHALL definir permisos con categoría `orders` para las siguientes acciones: `orders.view`, `orders.create`, `orders.edit`, `orders.delete`, `orders.send_email`, `orders.client_visibility`, `orders.view_details`, `orders.search`, `orders.view_items`, `orders.view_price_analysis`, `orders.view_sales_dashboard`, `orders.view_alerts`.
2. WHEN el usuario no posea el permiso para una acción específica sobre órdenes, THE Middleware_Permisos SHALL denegar el acceso al endpoint correspondiente con código HTTP 403.
3. WHEN el usuario no posea el permiso para una acción sobre órdenes, THE Elemento_UI correspondiente (botón, enlace, opción de menú) SHALL ocultarse en la interfaz.
4. THE Sistema_RBAC SHALL proteger cada endpoint de órdenes en `order.routes.js` con el permiso granular correspondiente en lugar de `authorizeRoles()`.

### Requisito 8: Control de acciones sobre documentos y archivos

**Historia de Usuario:** Como Super Admin, quiero controlar qué acciones puede realizar cada rol sobre documentos (subir, generar, enviar, eliminar, renombrar), para limitar operaciones sensibles.

#### Criterios de Aceptación

1. THE Sistema_RBAC SHALL definir permisos con categoría `documents` para las siguientes acciones: `documents.view`, `documents.upload`, `documents.generate`, `documents.regenerate`, `documents.send`, `documents.bulk_send`, `documents.resend`, `documents.rename`, `documents.delete`, `documents.create_default`.
2. WHEN el usuario no posea el permiso para una acción sobre documentos, THE Middleware_Permisos SHALL denegar el acceso al endpoint correspondiente con código HTTP 403.
3. WHEN el usuario no posea el permiso para una acción sobre documentos, THE Elemento_UI correspondiente SHALL ocultarse en la interfaz.

### Requisito 9: Control de acciones sobre usuarios y vendedores

**Historia de Usuario:** Como Super Admin, quiero controlar qué acciones puede realizar cada rol sobre la gestión de usuarios y vendedores, para que solo los autorizados puedan crear, editar o eliminar cuentas.

#### Criterios de Aceptación

1. THE Sistema_RBAC SHALL definir permisos con categoría `users` para: `users.view`, `users.create`, `users.edit`, `users.delete`, `users.reset_password`, `users.block`, `users.view_admins`, `users.manage_admins`.
2. THE Sistema_RBAC SHALL definir permisos con categoría `sellers` para: `sellers.view`, `sellers.edit`, `sellers.change_password`.
3. THE Sistema_RBAC SHALL definir permisos con categoría `customers` para: `customers.view`, `customers.edit`.
4. WHEN el usuario no posea el permiso requerido, THE Middleware_Permisos SHALL denegar el acceso al endpoint correspondiente con código HTTP 403.

### Requisito 10: Control de acceso a configuración del sistema

**Historia de Usuario:** Como Super Admin, quiero controlar qué usuarios pueden acceder y modificar la configuración del sistema (param_config, listas de email, ajustes), para proteger configuraciones sensibles.

#### Criterios de Aceptación

1. THE Sistema_RBAC SHALL definir permisos con categoría `settings` para: `settings.view`, `settings.edit`, `settings.pdf_mail_list`, `settings.notification_email_list`, `settings.profile`, `settings.change_password`, `settings.param_config`, `settings.admin_users`.
2. WHEN el usuario no posea el permiso `settings.view`, THE Elemento_UI del botón de configuración en el sidebar SHALL ocultarse.
3. WHEN el usuario posea `settings.view` pero no posea un permiso específico de configuración (ej: `settings.pdf_mail_list`), THE Elemento_UI de esa opción dentro del menú de configuración SHALL ocultarse.

### Requisito 11: Endpoint de permisos del usuario autenticado

**Historia de Usuario:** Como desarrollador frontend, quiero un endpoint que retorne todos los permisos del usuario autenticado, para renderizar la interfaz condicionalmente.

#### Criterios de Aceptación

1. THE API_Permisos SHALL exponer `GET /api/rbac/me/permissions` que retorne un objeto con la estructura: `{ "role": { "id": number, "name": string }, "permissions": string[] }`.
2. WHEN el usuario esté autenticado, THE API_Permisos SHALL retornar los permisos en menos de 200ms.
3. THE API_Permisos SHALL permitir acceso a `GET /api/rbac/me/permissions` a cualquier usuario autenticado independientemente de su rol.
4. WHEN el frontend cargue la aplicación, THE Elemento_UI SHALL solicitar los permisos del usuario una sola vez y almacenarlos en memoria del cliente para uso durante toda la sesión.

### Requisito 12: Migración y compatibilidad retroactiva

**Historia de Usuario:** Como desarrollador, quiero que la migración al sistema RBAC sea gradual y no rompa la funcionalidad existente, para minimizar riesgos en producción.

#### Criterios de Aceptación

1. THE Sistema_RBAC SHALL incluir un script de migración SQL que cree las tablas `roles`, `permissions` y `role_permissions` sin modificar tablas existentes.
2. THE Sistema_RBAC SHALL incluir un script de seed que asigne permisos por defecto a los roles Admin (id=1), Cliente (id=2) y Vendedor (id=3) equivalentes a los accesos actuales del sistema.
3. WHILE el middleware `authorizeRoles()` siga en uso en alguna ruta, THE Sistema_RBAC SHALL mantener su funcionamiento sin alteraciones.
4. THE Sistema_RBAC SHALL proveer un script de migración que mapee los valores actuales de `sidebarMenuPorRol` y los parámetros de header en `param_config` a permisos RBAC equivalentes.
5. IF la consulta de permisos RBAC falla por error de base de datos, THEN THE Middleware_Permisos SHALL hacer fallback al comportamiento de `authorizeRoles()` y registrar el error en el log.
