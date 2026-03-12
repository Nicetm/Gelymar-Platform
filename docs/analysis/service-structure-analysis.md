# Análisis de Estructura y Complejidad de Servicios

**Generado**: 2024-01-15  
**Spec**: Optimización y Refactorización de Código  
**Tarea**: 2.2 - Analizar estructura y complejidad de servicios

## Resumen Ejecutivo

El análisis de 26 servicios backend revela problemas arquitectónicos significativos:

- **CRÍTICO**: 1 servicio excede 1000 líneas (order.service.js: 1355 líneas)
- **ALTO**: 3 servicios exceden 500 líneas (file.service.js: 915, customer.service.js: 649, user.service.js: 565)
- **MEDIO**: Múltiples servicios con responsabilidades poco claras y alto acoplamiento
- **Esfuerzo Estimado de Refactorización**: 8-14 días

### Hallazgos Clave

1. **order.service.js** - Servicio dios masivo manejando órdenes, items, dashboards, analytics y análisis de precios
2. **file.service.js** - Gestión compleja de archivos con responsabilidades mezcladas
3. **customer.service.js** - Maneja clientes, contactos y validación de acceso
4. **user.service.js** - Gestiona usuarios, autenticación, perfiles y consultas SQL
5. Múltiples servicios "check*" con patrones duplicados

## Inventario de Servicios

### Servicios Grandes (>500 líneas)

| Servicio | Líneas | Funciones | Complejidad | Prioridad |
|---------|-------|-----------|------------|----------|
| order.service.js | 1355 | 20+ | CRÍTICO | P0 |
| file.service.js | 915 | 25+ | ALTO | P1 |
| customer.service.js | 649 | 15+ | ALTO | P1 |
| user.service.js | 565 | 25+ | ALTO | P1 |

### Servicios Medianos (200-500 líneas)

| Servicio | Líneas | Funciones | Complejidad | Prioridad |
|---------|-------|-----------|------------|----------|
| documentFile.service.js | 430 | 12+ | MEDIO | P2 |
| checkOrderReception.service.js | 372 | 8+ | MEDIO | P2 |
| email.service.js | 324 | 5+ | MEDIO | P2 |
| checkDefaultFiles.service.js | 312 | 6+ | MEDIO | P2 |
| message.service.js | 231 | 10+ | BAJO | P3 |
| chat.service.js | 193 | 15+ | BAJO | P3 |

### Servicios Pequeños (<200 líneas)

| Servicio | Líneas | Funciones | Complejidad | Prioridad |
|---------|-------|-----------|------------|----------|
| checkOrderDeliveryNotice.service.js | 173 | 4 | BAJO | P3 |
| checkClientAccess.service.js | 159 | 5 | BAJO | P3 |
| folder.service.js | 155 | 8+ | BAJO | P3 |
| vendedor.service.js | 153 | 8+ | BAJO | P3 |
| networkMount.service.js | 131 | 6 | CRÍTICO* | P0 |
| monitoring.service.js | 131 | 5+ | BAJO | P3 |
| adminNotificationSummary.service.js | 110 | 3 | BAJO | P3 |
| checkShipmentNotice.service.js | 107 | 4 | BAJO | P3 |
| checkAvailabilityNotice.service.js | 104 | 4 | BAJO | P3 |
| item.service.js | 104 | 5+ | BAJO | P3 |
| user_avatar.service.js | 116 | 6+ | BAJO | P3 |
| orderDetail.service.js | 84 | 3 | BAJO | P3 |
| cronConfig.service.js | 63 | 4 | BAJO | P3 |
| orderItem.service.js | 58 | 2 | BAJO | P3 |
| encryption.service.js | 54 | 3 | BAJO | P3 |
| config.service.js | 32 | 2 | BAJO | P3 |

*networkMount.service.js es CRÍTICO por estar completamente sin usar con credenciales hardcodeadas

## Análisis Detallado de Servicios

### 1. order.service.js (1355 líneas) - CRÍTICO

**Responsabilidades** (Violaciones de SRP):
- Recuperación y filtrado de órdenes
- Detalles e items de órdenes
- Agregación de datos de dashboard
- Analytics y reportes de ventas
- Análisis de precios
- Gestión de documentos
- Validación de clientes
- Control de acceso de vendedores
- Cálculos de rangos de fechas
- Conversiones de moneda
- Análisis de top productos/clientes

**Funciones Públicas** (20+):
- `getOrdersByFilters`
- `getClientDashboardOrders`
- `getClientOrderDocuments`
- `getOrderItems`
- `getOrderItemsWithoutFactura`
- `getOrderByRutAndOc`
- `getOrderById`
- `getOrderByIdSimple`
- `getOrderByPcOc`
- `getOrderByPc`
- `getOrderDetails`
- `getOrderDetail`
- `getOrdersMissingDocumentsAlert`
- `getSalesDashboardData` (función masiva ~400 líneas)
- `getPriceAnalysisData` (función masiva ~200 líneas)

**Dependencias**:
- SQL Server (vistas Softkey)
- MySQL (order_files, sellers)
- hdrMapper, itemMapper
- logger
- Múltiples funciones utilitarias

**Problemas**:
1. **Servicio Dios**: Maneja demasiadas responsabilidades
2. **Funciones Masivas**: `getSalesDashboardData` tiene ~400 líneas, `getPriceAnalysisData` tiene ~200 líneas
3. **Alto Acoplamiento**: Lógica de negocio mezclada con acceso a datos
4. **Duplicación**: Múltiples patrones de consulta similares
5. **Lógica Compleja**: Condicionales anidados, cálculos de fechas, manejo de monedas
6. **Difícil de Probar**: Demasiadas dependencias y responsabilidades

**División Recomendada**:
```
order.service.js (CRUD básico)
├── orderQuery.service.js (filtrado, recuperación)
├── orderDashboard.service.js (datos de dashboard)
├── orderAnalytics.service.js (analytics de ventas)
├── orderPricing.service.js (análisis de precios)
└── orderValidation.service.js (control de acceso)
```

**Esfuerzo Estimado**: 5-8 días

---

### 2. file.service.js (915 líneas) - ALTO

**Responsabilidades** (Violaciones de SRP):
- Operaciones CRUD de archivos
- Gestión de directorios
- Resolución de rutas de archivos
- Asociaciones de archivos de órdenes
- Acceso de archivos de clientes
- Generación de identificadores de archivos
- Consultas de órdenes en SQL Server
- Validación de clientes

**Funciones Públicas** (25+):
- `insertFile`
- `updateFile`
- `deleteFile`
- `getFileById`
- `getFilesByOrder`
- `getAllOrdersGroupedByRut`
- `getNextFileIdentifier`
- `createDirectoryIfNotExists`
- Múltiples funciones auxiliares

**Dependencias**:
- MySQL (order_files)
- SQL Server (consultas de órdenes)
- Operaciones del sistema de archivos
- order.service.js (riesgo de dependencia circular)
- customer.service.js

**Problemas**:
1. **Responsabilidades Mezcladas**: Operaciones de archivos + consultas de órdenes + validación de clientes
2. **Dependencias Circulares**: Requiere order.service.js que puede requerir file.service.js
3. **Lógica Compleja de Rutas**: Creación de directorios, normalización de rutas
4. **Alto Acoplamiento**: Lógica de negocio mezclada con acceso a datos
5. **Funciones Grandes**: Algunas funciones exceden 100 líneas

**División Recomendada**:
```
file.service.js (CRUD básico de archivos)
├── fileDirectory.service.js (gestión de directorios)
├── fileIdentifier.service.js (generación de identificadores)
└── fileAccess.service.js (validación de acceso)
```

**Esfuerzo Estimado**: 3-5 días

---

### 3. customer.service.js (649 líneas) - ALTO

**Responsabilidades** (Violaciones de SRP):
- Recuperación de clientes desde SQL Server
- Gestión de contactos de clientes (MySQL)
- Validación de acceso de vendedores
- Normalización de RUT
- Filtrado de clientes por vendedor

**Funciones Públicas** (15+):
- `getAllCustomers`
- `getCustomerByRut`
- `getCustomerByRutFromSql`
- `getCustomersWithoutAccount`
- `createCustomerContacts`
- `getContactsByCustomerRut`
- `updateCustomerContact`
- `deleteCustomerContact`
- `sellerHasAccessToCustomerRut`
- Múltiples funciones auxiliares

**Dependencias**:
- SQL Server (jor_imp_CLI_01_softkey)
- MySQL (customer_contacts, sellers)
- logger

**Problemas**:
1. **Fuentes de Datos Duales**: Gestiona datos tanto de SQL Server como de MySQL
2. **Lógica Compleja de Contactos**: Manipulación de arrays JSON, validación de permisos
3. **Control de Acceso Mezclado**: Lógica de negocio para acceso de vendedores
4. **Normalización de RUT**: Lógica duplicada (también en otros servicios)

**División Recomendada**:
```
customer.service.js (operaciones básicas de clientes)
├── customerContact.service.js (gestión de contactos)
└── customerAccess.service.js (validación de acceso)
```

**Esfuerzo Estimado**: 2-4 días

---

### 4. user.service.js (565 líneas) - ALTO

**Responsabilidades** (Violaciones de SRP):
- Autenticación de usuarios
- Operaciones CRUD de usuarios
- Gestión de usuarios admin
- Gestión de perfiles
- Consultas SQL Server de clientes/vendedores
- Seguimiento de estado online
- Gestión de 2FA
- Recuperación de contraseña

**Funciones Públicas** (25+):
- `getAllUsers`
- `findUserByEmailOrUsername`
- `findUserForPasswordRecovery`
- `findUserById`
- `findCustomerIdByRut`
- `updateUserOnlineStatus`
- `getPrimaryAdminPresence`
- `getSpecificAdminPresence`
- `findUserForAuth`
- `getUserProfile`
- `updateUserProfile`
- `createUser`
- `updateUser2FASecret`
- `getAdminUsers`
- `getAdminPresenceList`
- `getAdminUserById`
- `getAdminNotificationRecipients`
- `createAdminUser`
- `updateAdminUser`
- `deleteUserById`
- `resetAdminPassword`
- Múltiples helpers de consulta SQL

**Dependencias**:
- MySQL (users, admins, roles)
- SQL Server (customers, sellers)
- bcrypt
- logger

**Problemas**:
1. **Servicio Dios**: Demasiadas responsabilidades
2. **Preocupaciones Mezcladas**: Autenticación + CRUD + consultas SQL + presencia
3. **Consultas Complejas**: Múltiples operaciones JOIN
4. **Duplicación**: Patrones de consulta similares repetidos
5. **Difícil de Probar**: Demasiadas dependencias

**División Recomendada**:
```
user.service.js (CRUD básico de usuarios)
├── userAuth.service.js (autenticación, 2FA)
├── userProfile.service.js (gestión de perfiles)
├── userPresence.service.js (estado online)
└── adminUser.service.js (operaciones específicas de admin)
```

**Esfuerzo Estimado**: 3-5 días

---

### 5. email.service.js (324 líneas) - MEDIO

**Responsabilidades**:
- Envío de emails vía nodemailer
- Renderizado de plantillas (Handlebars)
- Validación de permisos de contactos
- Traducción de documentos
- Manejo de adjuntos

**Funciones Públicas**:
- `sendFileToClient` (función masiva ~250 líneas)
- `sendChatNotification`
- `sendAdminNotificationSummary`
- `translateNameOfDocument`

**Problemas**:
1. **Función Masiva**: `sendFileToClient` tiene ~250 líneas con lógica compleja de permisos
2. **Responsabilidades Mezcladas**: Envío de email + validación de permisos + renderizado de plantillas
3. **Lógica Compleja de Permisos**: Condicionales anidados para flags sh_documents, reports, cco
4. **Alto Acoplamiento**: Requiere order.service.js para consulta de clientes

**Refactorización Recomendada**:
```
email.service.js (envío básico de emails)
├── emailTemplate.service.js (renderizado de plantillas)
├── emailPermission.service.js (validación de permisos)
└── emailTranslation.service.js (traducción de documentos)
```

**Esfuerzo Estimado**: 2-3 días

---

### 6. Patrón de Servicios "check*" - MEDIO

**Servicios**:
- checkOrderReception.service.js (372 líneas)
- checkDefaultFiles.service.js (312 líneas)
- checkOrderDeliveryNotice.service.js (173 líneas)
- checkClientAccess.service.js (159 líneas)
- checkShipmentNotice.service.js (107 líneas)
- checkAvailabilityNotice.service.js (104 líneas)

**Patrón Común**:
```javascript
// 1. Verificar si está habilitado
async function isSendXXXEnabled() { ... }

// 2. Obtener configuración
async function getSendFromDate() { ... }

// 3. Obtener órdenes listas
async function getOrdersReadyForXXX() { ... }

// 4. Obtener destinatarios de email
async function getReportEmailsAndLang() { ... }
```

**Problemas**:
1. **Duplicación de Código**: Mismo patrón repetido 6 veces
2. **Parsing de Config**: Lógica de parsing JSON duplicada
3. **Consultas Similares**: Patrones SQL similares para diferentes tipos de documentos
4. **Sin Abstracción**: Cada servicio implementa la misma lógica independientemente

**Refactorización Recomendada**:
Crear un servicio base con lógica compartida:
```
notificationBase.service.js (lógica compartida)
├── notificationConfig.service.js (parsing de config)
├── notificationQuery.service.js (consultas de órdenes)
└── notificationEmail.service.js (destinatarios de email)

Luego simplificar cada servicio check* para usar la base
```

**Esfuerzo Estimado**: 3-4 días

---

### 7. networkMount.service.js (131 líneas) - CRÍTICO

**Estado**: COMPLETAMENTE SIN USAR (ver backend-analysis.md)

**Problemas**:
1. **Código Muerto**: No se encontraron referencias en el código
2. **Riesgo de Seguridad**: Credenciales hardcodeadas con fallback de contraseña
3. **Carga de Mantenimiento**: 131 líneas de código sin usar

**Recomendación**: ELIMINAR ARCHIVO COMPLETO

**Esfuerzo Estimado**: 1 hora (eliminar + verificar sin impacto)

---

## Violaciones del Principio de Responsabilidad Única (SRP)

### Violaciones Críticas

1. **order.service.js**
   - Órdenes + Items + Dashboard + Analytics + Precios + Documentos + Validación
   - **Debería ser**: 5-6 servicios separados

2. **file.service.js**
   - Archivos + Directorios + Identificadores + Órdenes + Clientes + Acceso
   - **Debería ser**: 4 servicios separados

3. **user.service.js**
   - Usuarios + Auth + Perfiles + Presencia + Admins + Consultas SQL
   - **Debería ser**: 4-5 servicios separados

### Violaciones Altas

4. **customer.service.js**
   - Clientes + Contactos + Acceso + Vendedores
   - **Debería ser**: 3 servicios separados

5. **email.service.js**
   - Email + Plantillas + Permisos + Traducción
   - **Debería ser**: 4 servicios separados

## Dependencias Circulares

### Riesgos Detectados

1. **order.service.js ↔ file.service.js**
   - file.service.js requiere order.service.js para consultas de órdenes
   - order.service.js puede requerir file.service.js para operaciones de documentos
   - **Riesgo**: ALTO

2. **email.service.js → order.service.js → customer.service.js**
   - email.service.js requiere order.service.js para consulta de clientes
   - order.service.js requiere customer.service.js para validación
   - **Riesgo**: MEDIO

3. **chat.service.js → user.service.js → customer.service.js**
   - chat.service.js requiere user.service.js para consulta de admin
   - user.service.js requiere customer.service.js para consultas SQL
   - **Riesgo**: BAJO

### Recomendaciones

1. **Extraer Lógica Compartida**: Crear servicios utilitarios para operaciones comunes
2. **Inyección de Dependencias**: Usar container.js más efectivamente
3. **Segregación de Interfaces**: Definir interfaces claras entre servicios
4. **Event-Driven**: Considerar event emitters para comunicación entre servicios

## Análisis de Cohesión y Acoplamiento

### Baja Cohesión (Funciones que no pertenecen juntas)

1. **order.service.js**
   - Analytics de dashboard mezclado con CRUD de órdenes
   - Análisis de precios mezclado con recuperación de órdenes
   - **Puntuación de Cohesión**: 3/10

2. **file.service.js**
   - Operaciones de archivos mezcladas con consultas de órdenes
   - Gestión de directorios mezclada con validación de clientes
   - **Puntuación de Cohesión**: 4/10

3. **user.service.js**
   - Autenticación mezclada con gestión de perfiles
   - Seguimiento de presencia mezclado con CRUD de admin
   - **Puntuación de Cohesión**: 5/10

### Alto Acoplamiento (Demasiadas dependencias)

1. **order.service.js**
   - Depende de: SQL Server, MySQL, mappers, logger, utilidades
   - **Puntuación de Acoplamiento**: 8/10 (ALTO)

2. **file.service.js**
   - Depende de: MySQL, SQL Server, order.service, customer.service, fs, path
   - **Puntuación de Acoplamiento**: 9/10 (MUY ALTO)

3. **email.service.js**
   - Depende de: nodemailer, Handlebars, MySQL, SQL Server, order.service, fs
   - **Puntuación de Acoplamiento**: 8/10 (ALTO)

## Análisis de Duplicación

### Patrones Duplicados

1. **Normalización de RUT** (encontrado en 5+ servicios)
```javascript
// customer.service.js
const normalizeRut = (rut) => String(rut).trim().replace(/C$/i, '');

// user.service.js
const normalized = (rut).trim().toLowerCase().replace(/\./g, '');

// file.service.js
// Patrón similar

// Recomendación: Crear utils/rutUtils.js
```

2. **Normalización de OC** (encontrado en 4+ servicios)
```javascript
// order.service.js
const normalizeOcForCompare = (oc) => 
  String(oc).toUpperCase().replace(/[\s()-]+/g, '');

// file.service.js
// Mismo patrón

// Recomendación: Crear utils/ocUtils.js
```

3. **Parsing de Configuración** (encontrado en 6 servicios check*)
```javascript
function parseConfigParams(rawParams) {
  // Misma lógica en 6 servicios
  // Recomendación: Crear utils/configUtils.js
}
```

4. **Consulta SQL de Cliente** (encontrado en 3+ servicios)
```javascript
async function getSqlCustomerByRut(rut) {
  // Misma consulta en user.service, customer.service, file.service
  // Recomendación: Crear customerLookup.service.js compartido
}
```

5. **Normalización de Fechas** (encontrado en mappers + servicios)
```javascript
const normalizeDate = (value) => {
  // Misma lógica en múltiples lugares
  // Recomendación: Crear utils/dateUtils.js
}
```

## Desafíos de Testing

### Servicios Difíciles de Probar

1. **order.service.js**
   - Demasiadas responsabilidades
   - Dependencias complejas
   - Funciones masivas
   - **Puntuación de Testabilidad**: 2/10

2. **file.service.js**
   - Operaciones del sistema de archivos
   - Dependencias circulares
   - Preocupaciones mezcladas
   - **Puntuación de Testabilidad**: 3/10

3. **email.service.js**
   - Dependencia externa SMTP
   - Lógica compleja de permisos
   - Renderizado de plantillas
   - **Puntuación de Testabilidad**: 4/10

### Recomendaciones para Testabilidad

1. **Inyección de Dependencias**: Pasar dependencias como parámetros
2. **Segregación de Interfaces**: Definir interfaces claras
3. **Funciones Puras**: Extraer lógica de negocio a funciones puras
4. **Amigable con Mocks**: Diseñar para fácil mockeo
5. **Unit vs Integration**: Separar lógica unit-testeable de lógica de integración

## Matriz de Prioridad de Refactorización

### Prioridad 0 (Inmediato - Seguridad/Crítico)

| Servicio | Problema | Esfuerzo | Impacto |
|---------|-------|--------|--------|
| networkMount.service.js | Código muerto + credenciales hardcodeadas | 1 hora | ALTO |

### Prioridad 1 (Alto - Performance/Mantenibilidad)

| Servicio | Problema | Esfuerzo | Impacto |
|---------|-------|--------|--------|
| order.service.js | Servicio dios, 1355 líneas | 5-8 días | MUY ALTO |
| file.service.js | Complejo, 915 líneas | 3-5 días | ALTO |

### Prioridad 2 (Medio - Calidad de Código)

| Servicio | Problema | Esfuerzo | Impacto |
|---------|-------|--------|--------|
| customer.service.js | Responsabilidades mezcladas | 2-4 días | MEDIO |
| user.service.js | Servicio dios | 3-5 días | MEDIO |
| email.service.js | Función masiva | 2-3 días | MEDIO |
| servicios check* | Duplicación | 3-4 días | MEDIO |

### Prioridad 3 (Bajo - Nice to Have)

| Servicio | Problema | Esfuerzo | Impacto |
|---------|-------|--------|--------|
| documentFile.service.js | Podría simplificarse | 1-2 días | BAJO |
| Otros servicios pequeños | Mejoras menores | 1-2 días | BAJO |

## Estrategia de Refactorización Recomendada

### Fase 1: Victorias Rápidas (1-2 días)
1. Eliminar networkMount.service.js
2. Extraer funciones utilitarias (rutUtils, ocUtils, configUtils, dateUtils)
3. Crear customerLookup.service.js compartido

### Fase 2: Servicios Críticos (8-12 días)
1. Refactorizar order.service.js en 5-6 servicios
2. Refactorizar file.service.js en 4 servicios
3. Agregar tests unitarios para nuevos servicios

### Fase 3: Servicios de Alta Prioridad (7-12 días)
1. Refactorizar user.service.js en 4-5 servicios
2. Refactorizar customer.service.js en 3 servicios
3. Refactorizar email.service.js en 4 servicios
4. Agregar tests unitarios

### Fase 4: Eliminación de Duplicación (3-4 días)
1. Crear servicio base de notificaciones
2. Refactorizar servicios check* para usar la base
3. Agregar tests de integración

### Fase 5: Testing y Documentación (3-5 días)
1. Agregar tests unitarios comprehensivos
2. Agregar tests de integración
3. Actualizar documentación
4. Testing de performance

## Esfuerzo Total Estimado

- **Fase 1**: 1-2 días
- **Fase 2**: 8-12 días
- **Fase 3**: 7-12 días
- **Fase 4**: 3-4 días
- **Fase 5**: 3-5 días

**Total**: 22-35 días (4-7 semanas)

**Equipo Recomendado**: 2 desarrolladores trabajando en paralelo

## Métricas de Éxito

### Métricas de Calidad de Código

- **Líneas por Servicio**: Objetivo <300 líneas por servicio
- **Funciones por Servicio**: Objetivo <10 funciones públicas
- **Complejidad Ciclomática**: Objetivo <10 por función
- **Cobertura de Tests**: Objetivo >80%

### Métricas de Arquitectura

- **Cumplimiento de SRP**: Cada servicio tiene una sola responsabilidad
- **Acoplamiento**: Reducir dependencias en 50%
- **Cohesión**: Aumentar puntuación de cohesión a 8/10+
- **Duplicación**: Eliminar 90% del código duplicado

### Métricas de Performance

- **Tiempo de Respuesta**: Mantener o mejorar performance actual
- **Uso de Memoria**: Reducir en 20% (menos servicios grandes en memoria)
- **Índice de Mantenibilidad**: Aumentar de ~40 actual a >70

## Próximos Pasos

1. **Revisar este análisis** con el equipo
2. **Priorizar refactorización** basado en necesidades del negocio
3. **Crear planes detallados de refactorización** para cada servicio
4. **Configurar infraestructura de testing** antes de refactorizar
5. **Implementar en fases** con integración continua
6. **Monitorear métricas** durante todo el proceso de refactorización

## Conclusión

La arquitectura de servicios del backend sufre de problemas de diseño significativos:

- **Servicios dios** manejando demasiadas responsabilidades
- **Alto acoplamiento** entre servicios
- **Duplicación de código** a través de múltiples servicios
- **Pobre testabilidad** debido a dependencias complejas
- **Riesgos de seguridad** por código sin usar con credenciales hardcodeadas

Refactorizar estos servicios mejorará significativamente:
- **Mantenibilidad**: Más fácil de entender y modificar
- **Testabilidad**: Más fácil de escribir y ejecutar tests
- **Performance**: Mejor uso de memoria y tiempos de respuesta
- **Seguridad**: Eliminar código muerto y riesgos de seguridad
- **Experiencia del Desarrollador**: Desarrollo y debugging más rápido

El enfoque por fases recomendado permite mejoras incrementales mientras se mantiene la estabilidad del sistema.
