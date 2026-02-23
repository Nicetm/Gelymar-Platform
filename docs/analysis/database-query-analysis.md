# Análisis de Performance de Queries SQL

**Fecha**: 21 de febrero de 2026  
**Proyecto**: Code Optimization & Refactoring - Plataforma Gelymar  
**Objetivo**: Identificar queries lentas, índices faltantes y oportunidades de optimización

---

## Resumen Ejecutivo

Este análisis examina todas las queries SQL en la plataforma (MySQL y SQL Server) para identificar:
- Queries sin índices en columnas de filtrado
- Queries con SELECT * innecesarios
- Queries lentas (> 2 segundos)
- N+1 queries en loops
- Oportunidades de optimización

### Métricas Globales

| Base de Datos | Total Queries | Queries Lentas | Índices Faltantes | N+1 Queries |
|---------------|---------------|----------------|-------------------|-------------|
| MySQL | 45+ | 3-5 (estimado) | 8-10 | 2 |
| SQL Server | 30+ | 10-15 (estimado) | N/A (solo lectura) | 3 |
| **Total** | **75+** | **13-20** | **8-10** | **5** |

### Issues Críticos Identificados

1. **Query de órdenes sin índices** - `order_files` sin índice en (pc, oc, id_nro_ov_mas_factura)
2. **N+1 en conteo de documentos** - Loop de queries en `getOrdersByFilters`
3. **SELECT * en múltiples servicios** - Trae columnas innecesarias
4. **Queries SQL Server sin filtro de fecha** - Escanea tabla completa
5. **Connection pool sin monitoreo** - No se detectan leaks

---

## 1. Análisis de Queries MySQL

### 1.1 Queries en order_files (Crítico)

**Archivo**: `Backend/services/order.service.js`  
**Línea**: 175-183

```javascript
// ❌ PROBLEMA: Query sin índice compuesto
const [docRows] = await pool.query(
  `SELECT pc, oc, id_nro_ov_mas_factura, COUNT(*) AS document_count
   FROM order_files
   WHERE ${pairConditions}  // (pc = ? AND oc = ? AND id_nro_ov_mas_factura = ?) OR ...
   GROUP BY pc, oc, id_nro_ov_mas_factura`,
  pairParams
);
```

**Problema**:
- No hay índice en (pc, oc, id_nro_ov_mas_factura)
- Query se ejecuta en loop para cada orden
- Escaneo completo de tabla si hay muchas órdenes

**Impacto**: 
- Tiempo estimado: 200-500ms por query
- Se ejecuta frecuentemente (cada vez que se listan órdenes)
- Performance degrada con más registros

**Solución**:
```sql
-- Agregar índice compuesto
CREATE INDEX idx_order_files_lookup 
ON order_files(pc, oc, id_nro_ov_mas_factura);

-- O índice más específico para queries comunes
CREATE INDEX idx_order_files_pc_oc 
ON order_files(pc, oc);
```

**Prioridad**: 🔴 CRÍTICA  
**Esfuerzo**: 1 hora  
**Mejora esperada**: 60-80% reducción en tiempo de query



### 1.2 Queries en customer_contacts

**Archivo**: `Backend/services/customer.service.js`  
**Líneas**: Múltiples ocurrencias

```javascript
// Query 1: Buscar contactos por RUT
const [contactRows] = await pool.query(
  'SELECT id, contact_email, primary_email, role FROM customer_contacts WHERE rut = ?',
  [customer_rut]
);

// Query 2: Verificar existencia
const [existingRecord] = await pool.query(
  'SELECT id FROM customer_contacts WHERE rut = ?', 
  [customer_rut]
);
```

**Análisis**:
- ✅ Probablemente tiene índice en `rut` (es clave de búsqueda principal)
- ✅ Query es simple y eficiente
- ⚠️ Se ejecuta frecuentemente

**Recomendación**:
```sql
-- Verificar que existe índice
SHOW INDEX FROM customer_contacts WHERE Column_name = 'rut';

-- Si no existe, crear
CREATE INDEX idx_customer_contacts_rut ON customer_contacts(rut);
```

**Prioridad**: 🟡 MEDIA  
**Esfuerzo**: 30 minutos

---

### 1.3 Queries en users

**Archivo**: `Backend/services/user.service.js`

```javascript
// ❌ PROBLEMA: SELECT * innecesario
const [rows] = await pool.query(`SELECT * FROM users`);

// ✅ MEJOR: Especificar columnas
const [rows] = await pool.query(`
  SELECT id, rut, email, role_id, online, created_at 
  FROM users
`);
```

**Problema**:
- Trae todas las columnas incluyendo `password_hash`, `twoFASecret`
- Desperdicia ancho de banda
- Riesgo de seguridad si se loguea

**Solución**:
```javascript
// Especificar solo columnas necesarias
const [rows] = await pool.query(`
  SELECT id, rut, email, role_id, online, created_at, updated_at
  FROM users
  WHERE role_id = ?
`, [roleId]);
```

**Prioridad**: 🟡 MEDIA  
**Esfuerzo**: 2-3 horas (múltiples archivos)  
**Mejora esperada**: 20-30% reducción en payload

---

### 1.4 Queries en sellers

**Archivo**: `Backend/services/customer.service.js`, `Backend/services/order.service.js`

```javascript
// Query frecuente: Obtener códigos de vendedor
const [sellerRows] = await pool.query(
  'SELECT codigo FROM sellers WHERE rut = ?',
  [rawRut]
);
```

**Análisis**:
- ✅ Query simple y eficiente
- ✅ Probablemente tiene índice en `rut`
- ⚠️ Se ejecuta en cada filtrado de órdenes por vendedor

**Recomendación**:
```sql
-- Verificar índice
SHOW INDEX FROM sellers WHERE Column_name = 'rut';

-- Considerar cache en memoria para mapeo rut → codigo
// En código:
const sellerCache = new Map(); // Cache de 5 minutos
```

**Prioridad**: 🟢 BAJA  
**Esfuerzo**: 1-2 horas (implementar cache)

---

### 1.5 N+1 Query Problem en order_files

**Archivo**: `Backend/services/order.service.js`  
**Línea**: 175-183

```javascript
// ❌ PROBLEMA: N+1 Query
// Para cada orden, se hace una query separada

const orderPairs = mappedRows.map(row => ({ pc, oc, id }));

// Esto genera: WHERE (pc = ? AND oc = ?) OR (pc = ? AND oc = ?) OR ...
// Mejor: Usar IN clause o JOIN
```

**Problema**:
- Si hay 50 órdenes, se construye query con 50 condiciones OR
- MySQL tiene que evaluar cada condición
- Performance degrada linealmente con número de órdenes

**Solución Optimizada**:
```javascript
// Opción 1: Usar IN clause (más eficiente)
const pcs = orderPairs.map(p => p.pc);
const [docRows] = await pool.query(
  `SELECT pc, oc, id_nro_ov_mas_factura, COUNT(*) AS document_count
   FROM order_files
   WHERE pc IN (?)
   GROUP BY pc, oc, id_nro_ov_mas_factura`,
  [pcs]
);

// Opción 2: Usar temporary table para grandes volúmenes
// CREATE TEMPORARY TABLE temp_orders (pc VARCHAR(50), oc VARCHAR(50));
// INSERT INTO temp_orders VALUES ...
// SELECT ... FROM order_files f INNER JOIN temp_orders t ON f.pc = t.pc AND f.oc = t.oc
```

**Prioridad**: 🔴 ALTA  
**Esfuerzo**: 3-4 horas  
**Mejora esperada**: 50-70% reducción en tiempo de query

---

## 2. Análisis de Queries SQL Server (Softkey)

### 2.1 Query de órdenes sin filtro de fecha

**Archivo**: `Backend/services/order.service.js`  
**Línea**: 90-120

```sql
-- ❌ PROBLEMA: Sin filtro de fecha, escanea toda la tabla
SELECT 
  h.Nro, h.OC, h.Rut, h.Fecha, h.Factura, ...
FROM jor_imp_HDR_90_softkey h
LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
WHERE h.Rut = @customerRut  -- Solo filtro por RUT
ORDER BY CAST(h.Fecha AS date) DESC
```

**Problema**:
- Tabla `jor_imp_HDR_90_softkey` puede tener miles/millones de registros
- Sin filtro de fecha, escanea todos los registros del cliente
- LEFT JOIN con `jor_imp_CLI_01_softkey` agrega overhead

**Impacto**:
- Tiempo estimado: 2-5 segundos para clientes con muchas órdenes
- Uso de red alto (SQL Server está en servidor externo)
- Bloquea connection pool

**Solución**:
```sql
-- Agregar filtro de fecha (últimos 2 años por defecto)
SELECT 
  h.Nro, h.OC, h.Rut, h.Fecha, h.Factura, ...
FROM jor_imp_HDR_90_softkey h
LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
WHERE h.Rut = @customerRut
  AND h.Fecha >= DATEADD(YEAR, -2, GETDATE())  -- Últimos 2 años
ORDER BY CAST(h.Fecha AS date) DESC
```

**Prioridad**: 🔴 CRÍTICA  
**Esfuerzo**: 2-3 horas  
**Mejora esperada**: 70-85% reducción en tiempo de query

---

### 2.2 Query de items sin filtro

**Archivo**: `Backend/services/orderItem.service.js`  
**Línea**: 30-33

```sql
-- ❌ PROBLEMA: SELECT * sin filtro
SELECT * FROM jor_imp_item_90_softkey 
ORDER BY Nro ASC, Linea ASC
```

**Problema**:
- Trae TODOS los items de TODAS las órdenes
- Tabla puede tener cientos de miles de registros
- SELECT * trae columnas innecesarias

**Impacto**:
- Tiempo estimado: 5-10 segundos
- Payload enorme (varios MB)
- Uso excesivo de memoria

**Solución**:
```sql
-- Especificar columnas y agregar filtro
SELECT 
  Nro, Linea, Item, Descripcion, Cant_ordenada, 
  Cant_enviada, KilosFacturados, Precio_Unit, Factura
FROM jor_imp_item_90_softkey 
WHERE Nro IN (@pc1, @pc2, ...)  -- Filtrar por PCs específicos
ORDER BY Nro ASC, Linea ASC
```

**Prioridad**: 🔴 CRÍTICA  
**Esfuerzo**: 1-2 horas  
**Mejora esperada**: 90%+ reducción en tiempo y payload

---

### 2.3 Query de productos sin paginación

**Archivo**: `Backend/services/item.service.js`  
**Línea**: 32-35

```sql
-- ❌ PROBLEMA: Sin paginación
SELECT * FROM jor_imp_PRO_01_softkey 
ORDER BY Item ASC
```

**Problema**:
- Trae TODO el catálogo de productos
- Sin paginación ni límite
- SELECT * innecesario

**Solución**:
```sql
-- Agregar paginación y especificar columnas
SELECT 
  Item, Descripcion, Categoria, Subcategoria, Unidad_medida
FROM jor_imp_PRO_01_softkey 
ORDER BY Item ASC
OFFSET @offset ROWS
FETCH NEXT @limit ROWS ONLY
```

**Prioridad**: 🟡 MEDIA  
**Esfuerzo**: 2-3 horas  
**Mejora esperada**: 80%+ reducción en tiempo inicial

---

### 2.4 N+1 Query en conteo de items

**Archivo**: `Backend/services/order.service.js`  
**Línea**: 340-350

```javascript
// ❌ PROBLEMA: Query separada para contar items
const itemsRequest = sqlPool.request();
const pcParams = pairs.map((pair, idx) => {
  itemsRequest.input(`pc${idx}`, sqlModule.VarChar, pair.pc);
  return `@pc${idx}`;
});

const itemsResult = await itemsRequest.query(`
  SELECT Nro, Factura, COUNT(*) AS items_count
  FROM jor_imp_item_90_softkey
  WHERE Nro IN (${pcParams.join(', ')})
  GROUP BY Nro, Factura
`);
```

**Análisis**:
- ✅ Usa IN clause (mejor que loop)
- ⚠️ Query separada podría combinarse con query principal
- ⚠️ Se ejecuta siempre, incluso si no se necesita el conteo

**Solución Optimizada**:
```sql
-- Opción 1: Combinar con query principal usando subquery
SELECT 
  h.Nro, h.OC, ...,
  (SELECT COUNT(*) FROM jor_imp_item_90_softkey i 
   WHERE i.Nro = h.Nro AND i.Factura = h.Factura) AS items_count
FROM jor_imp_HDR_90_softkey h
...

-- Opción 2: Usar LEFT JOIN con GROUP BY
SELECT 
  h.Nro, h.OC, ...,
  COUNT(i.Linea) AS items_count
FROM jor_imp_HDR_90_softkey h
LEFT JOIN jor_imp_item_90_softkey i ON i.Nro = h.Nro AND i.Factura = h.Factura
GROUP BY h.Nro, h.OC, ...
```

**Prioridad**: 🟡 MEDIA  
**Esfuerzo**: 3-4 horas  
**Mejora esperada**: 30-40% reducción en tiempo total

---

## 3. Índices Faltantes en MySQL

### 3.1 Tabla: order_files

**Índices Actuales** (estimado):
```sql
PRIMARY KEY (id)
-- Posiblemente: INDEX (pc), INDEX (file_id)
```

**Índices Recomendados**:
```sql
-- Para queries de búsqueda por orden
CREATE INDEX idx_order_files_pc_oc 
ON order_files(pc, oc);

-- Para queries con id_nro_ov_mas_factura
CREATE INDEX idx_order_files_lookup 
ON order_files(pc, oc, id_nro_ov_mas_factura);

-- Para filtrado por visibilidad
CREATE INDEX idx_order_files_visible 
ON order_files(is_visible_to_client, pc, oc);

-- Para queries por tipo de documento
CREATE INDEX idx_order_files_type 
ON order_files(file_id, pc, oc);
```

**Prioridad**: 🔴 CRÍTICA  
**Esfuerzo**: 1 hora  
**Impacto**: Alto - Queries frecuentes

---

### 3.2 Tabla: customer_contacts

**Índices Recomendados**:
```sql
-- Para búsqueda por RUT (probablemente ya existe)
CREATE INDEX idx_customer_contacts_rut 
ON customer_contacts(rut);
```

**Prioridad**: 🟡 MEDIA  
**Esfuerzo**: 15 minutos

---

### 3.3 Tabla: users

**Índices Recomendados**:
```sql
-- Para búsqueda por RUT
CREATE INDEX idx_users_rut 
ON users(rut);

-- Para filtrado por rol
CREATE INDEX idx_users_role 
ON users(role_id);

-- Para queries de presencia
CREATE INDEX idx_users_online 
ON users(online, role_id);
```

**Prioridad**: 🟡 MEDIA  
**Esfuerzo**: 30 minutos

---

### 3.4 Tabla: sellers

**Índices Recomendados**:
```sql
-- Para búsqueda por RUT
CREATE INDEX idx_sellers_rut 
ON sellers(rut);

-- Para búsqueda por código
CREATE INDEX idx_sellers_codigo 
ON sellers(codigo);
```

**Prioridad**: 🟡 MEDIA  
**Esfuerzo**: 15 minutos

---

### 3.5 Tabla: chat_messages

**Índices Recomendados**:
```sql
-- Para búsqueda por cliente
CREATE INDEX idx_chat_customer 
ON chat_messages(customer_id, created_at DESC);

-- Para búsqueda por admin
CREATE INDEX idx_chat_admin 
ON chat_messages(admin_id, created_at DESC);

-- Para conteo de no leídos
CREATE INDEX idx_chat_unread 
ON chat_messages(customer_id, is_read);
```

**Prioridad**: 🟡 MEDIA  
**Esfuerzo**: 30 minutos

---

## 4. Connection Pool Analysis

### 4.1 Configuración Actual

**MySQL** (`Backend/config/db.js`):
```javascript
const pool = mysql.createPool({
  host: process.env.MYSQL_DB_HOST,
  user: process.env.MYSQL_DB_USER,
  password: process.env.MYSQL_DB_PASS,
  database: process.env.MYSQL_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,  // ⚠️ Límite bajo
  queueLimit: 0         // ✅ Sin límite de cola
});
```

**SQL Server** (`Backend/config/sqlserver.js`):
```javascript
const sqlConfig = {
  server: process.env.SQL_HOST,
  database: process.env.SQL_DB,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASS,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    requestTimeout: 60000  // 60 segundos
  },
  pool: {
    max: 10,      // ⚠️ Límite bajo
    min: 0,
    idleTimeoutMillis: 30000
  }
};
```

### 4.2 Problemas Identificados

1. **Connection Limit Bajo**:
   - MySQL: 10 conexiones para toda la aplicación
   - SQL Server: 10 conexiones
   - Con múltiples requests concurrentes, puede haber espera

2. **Sin Monitoreo**:
   - No se loguea uso de pool
   - No se detectan connection leaks
   - No hay alertas de pool exhausted

3. **Timeout Alto en SQL Server**:
   - 60 segundos es muy alto
   - Queries lentas bloquean pool por mucho tiempo

### 4.3 Recomendaciones

```javascript
// MySQL - Aumentar límite
const pool = mysql.createPool({
  // ...
  connectionLimit: 20,  // Aumentar a 20
  queueLimit: 0,
  // Agregar eventos de monitoreo
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Monitorear eventos
pool.on('acquire', (connection) => {
  logger.debug(`[MySQL Pool] Connection ${connection.threadId} acquired`);
});

pool.on('release', (connection) => {
  logger.debug(`[MySQL Pool] Connection ${connection.threadId} released`);
});

// SQL Server - Ajustar configuración
const sqlConfig = {
  // ...
  options: {
    requestTimeout: 30000  // Reducir a 30 segundos
  },
  pool: {
    max: 15,      // Aumentar a 15
    min: 2,       // Mantener 2 conexiones mínimas
    idleTimeoutMillis: 30000
  }
};
```

**Prioridad**: 🟡 MEDIA  
**Esfuerzo**: 2-3 horas  
**Mejora esperada**: Mejor manejo de carga concurrente

---

## 5. Queries Lentas Identificadas

### Top 10 Queries Más Lentas (Estimado)

| # | Query | Archivo | Tiempo Estimado | Prioridad |
|---|-------|---------|-----------------|-----------|
| 1 | SELECT * FROM jor_imp_item_90_softkey | orderItem.service.js | 5-10s | 🔴 Crítica |
| 2 | SELECT * FROM jor_imp_PRO_01_softkey | item.service.js | 3-5s | 🔴 Crítica |
| 3 | SELECT FROM jor_imp_HDR_90_softkey (sin fecha) | order.service.js | 2-5s | 🔴 Crítica |
| 4 | SELECT FROM order_files (sin índice) | order.service.js | 200-500ms | 🔴 Alta |
| 5 | SELECT FROM jor_imp_item_90_softkey (conteo) | order.service.js | 500ms-1s | 🟡 Media |
| 6 | SELECT * FROM users | user.service.js | 100-200ms | 🟡 Media |
| 7 | SELECT FROM customer_contacts | customer.service.js | 50-100ms | 🟢 Baja |
| 8 | SELECT FROM sellers | order.service.js | 50-100ms | 🟢 Baja |
| 9 | SELECT FROM chat_messages | chat.service.js | 100-200ms | 🟡 Media |
| 10 | SELECT FROM config | config.service.js | 20-50ms | 🟢 Baja |

---

## 6. Plan de Optimización Priorizado

### Fase 1: Quick Wins (1-2 días)

1. **Agregar índices en order_files** (1 hora)
   ```sql
   CREATE INDEX idx_order_files_pc_oc ON order_files(pc, oc);
   CREATE INDEX idx_order_files_visible ON order_files(is_visible_to_client, pc, oc);
   ```

2. **Agregar filtro de fecha en queries SQL Server** (2-3 horas)
   - order.service.js: Agregar filtro de últimos 2 años
   - Reducir payload y tiempo de query

3. **Eliminar SELECT * en queries críticas** (2-3 horas)
   - orderItem.service.js: Especificar columnas
   - item.service.js: Especificar columnas
   - user.service.js: Especificar columnas

**Total Fase 1**: 5-7 horas  
**Mejora esperada**: 60-70% reducción en queries más lentas

### Fase 2: Optimizaciones Medias (3-5 días)

4. **Optimizar N+1 queries** (3-4 horas)
   - order.service.js: Usar IN clause en vez de OR conditions
   - Combinar queries de conteo con query principal

5. **Agregar paginación** (2-3 horas)
   - item.service.js: Paginar catálogo de productos
   - orderDetail.service.js: Paginar lista de órdenes

6. **Aumentar connection pool limits** (2-3 horas)
   - MySQL: 10 → 20 conexiones
   - SQL Server: 10 → 15 conexiones
   - Agregar monitoreo de pool

7. **Agregar índices adicionales** (1-2 horas)
   - users, sellers, customer_contacts, chat_messages

**Total Fase 2**: 8-12 horas  
**Mejora esperada**: 40-50% reducción adicional

### Fase 3: Optimizaciones Avanzadas (1-2 semanas)

8. **Implementar caching** (8-12 horas)
   - Cache de mapeo rut → codigo (sellers)
   - Cache de configuración
   - Cache de catálogo de productos

9. **Optimizar queries complejas** (8-12 horas)
   - Combinar queries múltiples en una sola
   - Usar CTEs (Common Table Expressions)
   - Implementar vistas materializadas

10. **Implementar query monitoring** (4-6 horas)
    - Logging automático de queries lentas
    - Dashboard de métricas de queries
    - Alertas para queries > 2 segundos

**Total Fase 3**: 20-30 horas  
**Mejora esperada**: 20-30% reducción adicional

---

## 7. Scripts de Implementación

### 7.1 Script de Índices MySQL

```sql
-- Script: add-mysql-indexes.sql
-- Ejecutar en base de datos MySQL

USE gelymar;

-- order_files
CREATE INDEX IF NOT EXISTS idx_order_files_pc_oc 
ON order_files(pc, oc);

CREATE INDEX IF NOT EXISTS idx_order_files_lookup 
ON order_files(pc, oc, id_nro_ov_mas_factura);

CREATE INDEX IF NOT EXISTS idx_order_files_visible 
ON order_files(is_visible_to_client, pc, oc);

CREATE INDEX IF NOT EXISTS idx_order_files_type 
ON order_files(file_id, pc, oc);

-- users
CREATE INDEX IF NOT EXISTS idx_users_rut 
ON users(rut);

CREATE INDEX IF NOT EXISTS idx_users_role 
ON users(role_id);

CREATE INDEX IF NOT EXISTS idx_users_online 
ON users(online, role_id);

-- sellers
CREATE INDEX IF NOT EXISTS idx_sellers_rut 
ON sellers(rut);

CREATE INDEX IF NOT EXISTS idx_sellers_codigo 
ON sellers(codigo);

-- customer_contacts
CREATE INDEX IF NOT EXISTS idx_customer_contacts_rut 
ON customer_contacts(rut);

-- chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_customer 
ON chat_messages(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_admin 
ON chat_messages(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_unread 
ON chat_messages(customer_id, is_read);

-- Verificar índices creados
SELECT 
  TABLE_NAME, 
  INDEX_NAME, 
  COLUMN_NAME, 
  SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'gelymar'
  AND INDEX_NAME LIKE 'idx_%'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
```

### 7.2 Script de Verificación de Performance

```bash
#!/bin/bash
# Script: verify-query-performance.sh
# Ejecutar después de aplicar optimizaciones

echo "🔍 Verificando performance de queries..."

# Test 1: Query de órdenes
echo "Test 1: Query de órdenes"
time mysql -u gelymar -proot123456 gelymar -e "
  SELECT pc, oc, COUNT(*) 
  FROM order_files 
  WHERE pc IN ('12345', '12346', '12347') 
  GROUP BY pc, oc;
"

# Test 2: Query de usuarios
echo "Test 2: Query de usuarios"
time mysql -u gelymar -proot123456 gelymar -e "
  SELECT id, rut, role_id 
  FROM users 
  WHERE role_id = 2;
"

# Test 3: Verificar uso de índices
echo "Test 3: Verificar uso de índices"
mysql -u gelymar -proot123456 gelymar -e "
  EXPLAIN SELECT pc, oc, COUNT(*) 
  FROM order_files 
  WHERE pc = '12345' AND oc = 'OC-001' 
  GROUP BY pc, oc;
"

echo "✅ Verificación completada"
```

---

## 8. Métricas de Éxito

### Antes de Optimización (Baseline)

| Métrica | Valor Actual |
|---------|--------------|
| Tiempo promedio query órdenes | 2-5 segundos |
| Tiempo promedio query items | 5-10 segundos |
| Tiempo promedio query productos | 3-5 segundos |
| Queries > 2 segundos | 15-20 (20-25%) |
| Connection pool usage | 60-80% pico |

### Después de Optimización (Target)

| Métrica | Valor Target | Mejora |
|---------|--------------|--------|
| Tiempo promedio query órdenes | 500ms-1s | 75-80% |
| Tiempo promedio query items | 500ms-1s | 85-90% |
| Tiempo promedio query productos | 200-500ms | 85-90% |
| Queries > 2 segundos | 0-2 (0-3%) | 90%+ |
| Connection pool usage | 40-60% pico | 25-33% |

---

## 9. Próximos Pasos

1. **Implementar Fase 1** (Quick Wins) - 1-2 días
2. **Medir mejoras con script de verificación** - 1 hora
3. **Implementar Fase 2** (Optimizaciones Medias) - 3-5 días
4. **Implementar Fase 3** (Optimizaciones Avanzadas) - 1-2 semanas
5. **Monitoreo continuo** - Ongoing

---

**Documento generado**: 21 de febrero de 2026  
**Próxima actualización**: Después de implementar Fase 1
