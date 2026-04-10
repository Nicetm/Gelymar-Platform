# Documento de Diseño — Super Admin Panel

## Resumen

Aplicación de escritorio Electron para Windows que provee herramientas de operación para super-administradores de la plataforma Gelymar. La app se conecta directamente a MySQL y SQL Server, a la Docker API del host, y al filesystem del fileserver. Reutiliza las mismas librerías del Backend existente (`mysql2`, `mssql`, `bcrypt`, `jsonwebtoken`) y replica el estilo visual del file-manager.php.

La arquitectura es un proceso Electron con un servidor Express embebido que sirve páginas HTML con vanilla JS. No hay framework frontend ni bundler. Cada módulo (Órdenes, Huérfanos, Logs Docker, Logs PM2, Base de Datos) es una vista HTML independiente cargada dinámicamente en el contenido principal.

## Arquitectura

La app sigue un patrón de dos procesos Electron:

- **Main process**: Crea la ventana (`BrowserWindow`), levanta un servidor Express interno en un puerto local aleatorio, y gestiona el ciclo de vida de la app.
- **Renderer process**: Carga `index.html` que apunta al Express interno. Toda la UI es HTML + vanilla JS que consume endpoints REST locales.

El Express interno expone rutas API bajo `/api/` que manejan:
- Autenticación contra BD_MySQL
- Queries a MySQL y SQL Server
- Conexión a Docker API (via `dockerode`)
- Acceso al filesystem para escaneo de huérfanos

Las configuraciones de conexión (hosts, puertos, credenciales por ambiente) se almacenan en `config.json` dentro del directorio de datos de la app (`app.getPath('userData')`).

### Decisiones clave

1. **Express embebido vs IPC directo**: Se usa Express interno para mantener consistencia con el Backend existente y reutilizar patrones de rutas/controladores. El renderer hace `fetch()` al localhost.
2. **`dockerode` para Docker API**: Librería estándar de Node para Docker. Soporta socket Unix y TCP remoto.
3. **Sin ORM**: Queries directas con `mysql2` y `mssql`, igual que el Backend existente.
4. **Sesión en memoria**: JWT generado localmente, almacenado en `localStorage` del renderer. No persiste entre reinicios de la app.
5. **electron-builder para empaquetado**: Genera `.exe` portable para Windows.

## Componentes e Interfaces

### Estructura de directorios

```
SuperAdminPanel/
├── package.json
├── main.js                  # Proceso principal Electron
├── preload.js               # Preload script (expone API mínima)
├── server/
│   ├── index.js             # Express server setup
│   ├── config/
│   │   ├── database.js      # Pools MySQL y SQL Server por ambiente
│   │   └── docker.js        # Configuración dockerode
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── orders.routes.js
│   │   ├── orphans.routes.js
│   │   ├── docker.routes.js
│   │   ├── pm2.routes.js
│   │   └── database.routes.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── orders.controller.js
│   │   ├── orphans.controller.js
│   │   ├── docker.controller.js
│   │   ├── pm2.controller.js
│   │   └── database.controller.js
│   └── middleware/
│       └── auth.middleware.js
├── renderer/
│   ├── index.html           # Shell principal con sidebar
│   ├── css/
│   │   └── styles.css       # Estilos globales (basados en file-manager.php)
│   ├── js/
│   │   ├── app.js           # Router SPA, auth state, navegación
│   │   ├── api.js           # Wrapper fetch con token
│   │   ├── orders.js
│   │   ├── orphans.js
│   │   ├── docker-logs.js
│   │   ├── pm2-logs.js
│   │   └── db-browser.js
│   └── views/
│       ├── login.html
│       ├── orders.html
│       ├── orphans.html
│       ├── docker-logs.html
│       ├── pm2-logs.html
│       └── db-browser.html
└── build/                   # Configuración electron-builder
```

### Componentes del servidor Express

**Auth**: Login contra tabla `users` de BD_MySQL. Valida password con `bcrypt.compare()`, verifica `role_id` sea admin (role_id 1 o 3 según `role.util.js`), genera JWT local con `jsonwebtoken`. El middleware protege todas las rutas API.

**Database config**: Módulo que mantiene pools de conexión MySQL y SQL Server. Expone `getPool(ambiente)` y `getSqlPool(ambiente)`. Al cambiar ambiente, cierra pools anteriores y crea nuevos.

**Orders**: Busca órdenes por PC, OC o RUT en BD_MySQL. Retorna detalle con `order_files` asociados. Permite editar campos específicos de `order_files` (status_id, path, is_visible_to_client, fechas).

**Orphans**: Escanea recursivamente el directorio `uploads/` del fileserver (ruta configurable), compara contra registros de `order_files` en BD_MySQL. Retorna lista de huérfanos con ruta y tamaño. Permite eliminar archivos seleccionados.

**Docker logs**: Usa `dockerode` para listar contenedores y obtener logs. Soporta configuración de socket local (`/var/run/docker.sock`) o TCP remoto (`tcp://host:port`).

**PM2 logs**: Ejecuta `docker exec` en el contenedor cron via `dockerode` para correr `pm2 jlist` y `pm2 logs`. Parsea la salida JSON de PM2 para mostrar estado de procesos.

**DB Browser**: Queries paginadas a tablas predefinidas (`order_files`, `order_snapshots`, `param_config`, `users`). Soporta filtros dinámicos y edición inline de campos.

### Componentes del renderer

**Shell principal** (`index.html`): Layout con sidebar fija a la izquierda (navegación por módulos), header con indicador de ambiente y usuario, y área de contenido principal donde se cargan las vistas dinámicamente.

**api.js**: Wrapper de `fetch()` que inyecta el token JWT en headers y maneja errores 401 (redirige a login).

**Cada módulo** (orders.js, orphans.js, etc.): Carga su vista HTML en el contenido principal, inicializa event listeners, y consume la API local.

## Modelos de Datos

### config.json (almacenado en userData)

```json
{
  "environments": {
    "dev": {
      "mysql": { "host": "", "port": 3306, "user": "", "password": "", "database": "" },
      "sqlserver": { "host": "", "port": 1433, "user": "", "password": "", "database": "" },
      "docker": { "socketPath": "/var/run/docker.sock" },
      "fileserverRoot": ""
    },
    "prod": {
      "mysql": { "host": "", "port": 3306, "user": "", "password": "", "database": "" },
      "sqlserver": { "host": "", "port": 1433, "user": "", "password": "", "database": "" },
      "docker": { "host": "tcp://host:2375" },
      "fileserverRoot": ""
    }
  },
  "cronContainerName": "gelymar-cron",
  "defaultLogLines": 200,
  "pm2ContainerName": "gelymar-cron"
}
```

### Tablas MySQL consultadas

- `users`: Autenticación (id, rut, full_name, password, role_id, bloqueado)
- `order_files`: Archivos de órdenes (id, pc, oc, factura, status_id, path, is_visible_to_client, fechas)
- `order_snapshots`: Snapshots de órdenes
- `param_config`: Configuración de parámetros del sistema

### Tablas SQL Server consultadas

- Tablas del ERP para datos complementarios de órdenes (solo lectura)

## Manejo de Errores

- **Conexión BD fallida**: Mostrar mensaje en UI indicando que no se pudo conectar al ambiente seleccionado. No crashear la app. Permitir reintentar o cambiar ambiente.
- **Docker API no disponible**: Mostrar estado "desconectado" en los módulos de logs. Permitir reconfigurar la conexión.
- **Fileserver inaccesible**: En el módulo de huérfanos, mostrar error si la ruta configurada no es accesible. Permitir cambiar la ruta.
- **Credenciales inválidas**: Mensaje claro en el login. No revelar si el usuario existe o no.
- **Errores de escritura en BD**: Mostrar el mensaje de error de MySQL al operador. Rollback implícito (queries individuales, no transacciones complejas).
- **Timeout de queries**: Configurar timeouts razonables (30s para queries normales, 120s para escaneo de huérfanos).

## Estrategia de Testing

Esta feature no es candidata para property-based testing. Se trata de una aplicación de escritorio con operaciones CRUD, integración con servicios externos (MySQL, SQL Server, Docker API) y UI. Las pruebas apropiadas son:

- **Tests manuales**: Verificar flujos completos en la app (login, cambio de ambiente, búsqueda de órdenes, escaneo de huérfanos, visualización de logs).
- **Tests de integración**: Verificar conexiones a BD y Docker API con datos reales en ambiente dev.
- **Smoke tests**: Verificar que la app arranca, el Express interno responde, y la ventana Electron se muestra correctamente.

No se incluye sección de Correctness Properties porque PBT no aplica a este tipo de feature (app de escritorio con CRUD, integración a servicios externos, y UI).
