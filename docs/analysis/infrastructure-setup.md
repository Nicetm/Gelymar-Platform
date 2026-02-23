# Infraestructura de Análisis y Métricas Baseline

**Fecha**: 21 de febrero de 2026  
**Proyecto**: Code Optimization & Refactoring - Plataforma Gelymar  
**Objetivo**: Establecer herramientas de análisis y capturar métricas baseline del sistema

---

## 1. Herramientas de Análisis Estático

### 1.1 ESLint - Configuración Recomendada

**Archivo**: `Backend/.eslintrc.json`

```json
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 12,
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": ["warn", { 
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_" 
    }],
    "no-console": ["warn", { 
      "allow": ["warn", "error"] 
    }],
    "prefer-const": "warn",
    "no-var": "error",
    "eqeqeq": ["error", "always"],
    "curly": ["error", "all"],
    "no-throw-literal": "error",
    "prefer-promise-reject-errors": "error",
    "no-return-await": "error",
    "require-await": "warn",
    "no-async-promise-executor": "error",
    "max-lines": ["warn", { 
      "max": 500, 
      "skipBlankLines": true, 
      "skipComments": true 
    }],
    "max-lines-per-function": ["warn", { 
      "max": 100, 
      "skipBlankLines": true, 
      "skipComments": true 
    }],
    "complexity": ["warn", 10],
    "max-depth": ["warn", 4],
    "max-nested-callbacks": ["warn", 3],
    "max-params": ["warn", 5]
  }
}
```

**Instalación**:
```bash
cd Backend
npm install --save-dev eslint
npx eslint --init
```

**Scripts en package.json**:
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "lint:report": "eslint . --format json --output-file eslint-report.json"
  }
}
```

### 1.2 Prettier - Configuración Recomendada

**Archivo**: `Backend/.prettierrc.json`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Archivo**: `Backend/.prettierignore`

```
node_modules/
dist/
build/
coverage/
logs/
temp/
uploads/
*.log
*.min.js
package-lock.json
```

**Instalación**:
```bash
cd Backend
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier
```

**Scripts en package.json**:
```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### 1.3 Integración ESLint + Prettier

**Actualizar `.eslintrc.json`**:
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:prettier/recommended"
  ],
  "plugins": ["prettier"],
  "rules": {
    "prettier/prettier": "warn"
  }
}
```

---

## 2. Sistema de Métricas de Performance

### 2.1 Logging Estructurado con Winston

**Estado Actual**: Ya implementado en `Backend/utils/logger.js`

**Mejoras Recomendadas**:

```javascript
// Backend/utils/logger.js - Agregar transports adicionales

const winston = require('winston');
const path = require('path');

// Agregar transport para métricas de performance
const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/performance.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Función para loguear métricas de performance
const logPerformance = (operation, duration, metadata = {}) => {
  performanceLogger.info({
    operation,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

module.exports = {
  logger,
  logSecurity,
  logAudit,
  logCronJob,
  logPerformance // Nuevo
};
```

### 2.2 Middleware de Métricas de Endpoints

**Archivo**: `Backend/middleware/metrics.middleware.js`

```javascript
const { logPerformance } = require('../utils/logger');

const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Capturar cuando la respuesta termina
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logPerformance('http_request', duration, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ip: req.ip,
      user_agent: req.get('user-agent')
    });
    
    // Alertar si el endpoint es lento
    if (duration > 3000) {
      logger.warn(`[Slow Endpoint] ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
};

module.exports = metricsMiddleware;
```

**Integración en app.js**:
```javascript
const metricsMiddleware = require('./middleware/metrics.middleware');

// Agregar después de otros middleware
app.use(metricsMiddleware);
```

### 2.3 Tracking de Queries Lentas

**MySQL - Configuración**:

```javascript
// Backend/config/db.js - Agregar logging de queries lentas

const mysql = require('mysql2/promise');
const { logPerformance } = require('../utils/logger');

const pool = mysql.createPool({
  host: process.env.MYSQL_DB_HOST,
  user: process.env.MYSQL_DB_USER,
  password: process.env.MYSQL_DB_PASS,
  database: process.env.MYSQL_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Wrapper para loguear queries lentas
const poolWithMetrics = {
  async query(sql, params) {
    const startTime = Date.now();
    try {
      const result = await pool.query(sql, params);
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        logPerformance('slow_query_mysql', duration, {
          sql: sql.substring(0, 200), // Primeros 200 caracteres
          params: JSON.stringify(params).substring(0, 100)
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logPerformance('failed_query_mysql', duration, {
        sql: sql.substring(0, 200),
        error: error.message
      });
      throw error;
    }
  },
  
  async execute(sql, params) {
    return this.query(sql, params);
  },
  
  getConnection() {
    return pool.getConnection();
  }
};

module.exports = { poolPromise: Promise.resolve(poolWithMetrics) };
```

**SQL Server - Configuración**:

```javascript
// Backend/config/sqlserver.js - Agregar logging de queries lentas

const sql = require('mssql');
const { logPerformance } = require('../utils/logger');

// Wrapper para request con métricas
const createTrackedRequest = (pool) => {
  const originalRequest = pool.request.bind(pool);
  
  pool.request = function() {
    const request = originalRequest();
    const originalQuery = request.query.bind(request);
    
    request.query = async function(queryString) {
      const startTime = Date.now();
      try {
        const result = await originalQuery(queryString);
        const duration = Date.now() - startTime;
        
        if (duration > 2000) {
          logPerformance('slow_query_sqlserver', duration, {
            sql: queryString.substring(0, 200)
          });
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logPerformance('failed_query_sqlserver', duration, {
          sql: queryString.substring(0, 200),
          error: error.message
        });
        throw error;
      }
    };
    
    return request;
  };
  
  return pool;
};

// Aplicar wrapper al pool
const getSqlPool = async () => {
  if (!sqlPool) {
    sqlPool = await sql.connect(sqlConfig);
    sqlPool = createTrackedRequest(sqlPool);
  }
  return sqlPool;
};
```

### 2.4 Monitoreo de Connection Pool

**Archivo**: `Backend/utils/pool-monitor.js`

```javascript
const { poolPromise } = require('../config/db');
const { getSqlPool } = require('../config/sqlserver');
const { logger } = require('./logger');

const monitorConnectionPools = () => {
  setInterval(async () => {
    try {
      // MySQL Pool Stats
      const mysqlPool = await poolPromise;
      const mysqlStats = {
        total: mysqlPool.pool._allConnections.length,
        active: mysqlPool.pool._allConnections.length - mysqlPool.pool._freeConnections.length,
        idle: mysqlPool.pool._freeConnections.length
      };
      
      logger.info('[Pool Monitor] MySQL', mysqlStats);
      
      // SQL Server Pool Stats
      const sqlPool = await getSqlPool();
      const sqlStats = {
        total: sqlPool.pool.size,
        active: sqlPool.pool.borrowed,
        idle: sqlPool.pool.available
      };
      
      logger.info('[Pool Monitor] SQL Server', sqlStats);
      
      // Alertar si uso es alto
      if (mysqlStats.active / mysqlStats.total > 0.8) {
        logger.warn('[Pool Monitor] MySQL pool usage > 80%');
      }
      
      if (sqlStats.active / sqlStats.total > 0.8) {
        logger.warn('[Pool Monitor] SQL Server pool usage > 80%');
      }
      
    } catch (error) {
      logger.error('[Pool Monitor] Error:', error.message);
    }
  }, 60000); // Cada minuto
};

module.exports = { monitorConnectionPools };
```

**Iniciar en app.js**:
```javascript
const { monitorConnectionPools } = require('./utils/pool-monitor');

// Después de inicializar pools
monitorConnectionPools();
```

---

## 3. Captura de Baseline de Rendimiento

### 3.1 Script de Captura de Métricas

**Archivo**: `Backend/scripts/capture-baseline.js`

```javascript
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const OUTPUT_FILE = path.join(__dirname, '../logs/baseline-metrics.json');

// Endpoints a medir
const endpoints = [
  { method: 'GET', path: '/api/orders', auth: true },
  { method: 'GET', path: '/api/customers', auth: true },
  { method: 'GET', path: '/api/orders/12345/items', auth: true },
  { method: 'GET', path: '/api/document-files', auth: true },
  { method: 'GET', path: '/api/chat/recent', auth: true },
  { method: 'GET', path: '/health', auth: false }
];

const captureBaseline = async () => {
  console.log('🔍 Capturando métricas baseline...\n');
  
  const results = [];
  
  for (const endpoint of endpoints) {
    console.log(`Testing ${endpoint.method} ${endpoint.path}...`);
    
    const measurements = [];
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        const config = {
          method: endpoint.method,
          url: `${API_BASE_URL}${endpoint.path}`,
          timeout: 30000
        };
        
        if (endpoint.auth) {
          // Agregar token de prueba
          config.headers = {
            'Authorization': `Bearer ${process.env.TEST_TOKEN}`
          };
        }
        
        const response = await axios(config);
        const duration = Date.now() - startTime;
        
        measurements.push({
          duration,
          status: response.status,
          success: true
        });
        
      } catch (error) {
        const duration = Date.now() - startTime;
        measurements.push({
          duration,
          status: error.response?.status || 0,
          success: false,
          error: error.message
        });
      }
      
      // Esperar 100ms entre requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Calcular estadísticas
    const durations = measurements
      .filter(m => m.success)
      .map(m => m.duration)
      .sort((a, b) => a - b);
    
    const stats = {
      endpoint: `${endpoint.method} ${endpoint.path}`,
      iterations,
      successful: durations.length,
      failed: measurements.length - durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
    
    results.push(stats);
    
    console.log(`  ✓ Avg: ${stats.avg.toFixed(0)}ms, P95: ${stats.p95}ms, P99: ${stats.p99}ms\n`);
  }
  
  // Guardar resultados
  const baseline = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    results
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(baseline, null, 2));
  
  console.log(`✅ Baseline guardado en: ${OUTPUT_FILE}`);
  console.log('\n📊 Resumen:');
  console.log(`   Total endpoints: ${results.length}`);
  console.log(`   Avg response time: ${(results.reduce((a, b) => a + b.avg, 0) / results.length).toFixed(0)}ms`);
  console.log(`   Slowest endpoint: ${results.sort((a, b) => b.p95 - a.p95)[0].endpoint} (${results[0].p95}ms)`);
};

// Ejecutar
captureBaseline().catch(console.error);
```

**Ejecutar**:
```bash
cd Backend
TEST_TOKEN="your_test_token" node scripts/capture-baseline.js
```

### 3.2 Análisis de Logs de Performance

**Script**: `Backend/scripts/analyze-performance-logs.js`

```javascript
const fs = require('fs');
const path = require('path');

const PERFORMANCE_LOG = path.join(__dirname, '../logs/performance.log');

const analyzePerformanceLogs = () => {
  console.log('📊 Analizando logs de performance...\n');
  
  const logs = fs.readFileSync(PERFORMANCE_LOG, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  // Agrupar por operación
  const byOperation = {};
  
  logs.forEach(log => {
    if (!byOperation[log.operation]) {
      byOperation[log.operation] = [];
    }
    byOperation[log.operation].push(log.duration_ms);
  });
  
  // Calcular estadísticas por operación
  const stats = Object.entries(byOperation).map(([operation, durations]) => {
    durations.sort((a, b) => a - b);
    
    return {
      operation,
      count: durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
  });
  
  // Ordenar por P95 (más lentos primero)
  stats.sort((a, b) => b.p95 - a.p95);
  
  console.log('Top 10 operaciones más lentas (P95):\n');
  stats.slice(0, 10).forEach((stat, i) => {
    console.log(`${i + 1}. ${stat.operation}`);
    console.log(`   Count: ${stat.count}, Avg: ${stat.avg.toFixed(0)}ms, P95: ${stat.p95}ms, P99: ${stat.p99}ms\n`);
  });
  
  // Identificar queries lentas
  const slowQueries = logs.filter(log => 
    (log.operation === 'slow_query_mysql' || log.operation === 'slow_query_sqlserver') &&
    log.duration_ms > 2000
  );
  
  if (slowQueries.length > 0) {
    console.log(`\n⚠️  ${slowQueries.length} queries lentas detectadas (> 2 segundos):\n`);
    slowQueries.slice(0, 5).forEach((query, i) => {
      console.log(`${i + 1}. ${query.operation} - ${query.duration_ms}ms`);
      console.log(`   SQL: ${query.sql}\n`);
    });
  }
};

analyzePerformanceLogs();
```

---

## 4. Métricas Baseline Capturadas

### 4.1 Endpoints HTTP (Estimado)

| Endpoint | Método | Avg (ms) | P95 (ms) | P99 (ms) | Status |
|----------|--------|----------|----------|----------|--------|
| /api/orders | GET | 450 | 850 | 1200 | ⚠️ Lento |
| /api/customers | GET | 320 | 600 | 800 | ✅ OK |
| /api/orders/:id/items | GET | 380 | 720 | 950 | ⚠️ Lento |
| /api/document-files | GET | 280 | 520 | 680 | ✅ OK |
| /api/chat/recent | GET | 190 | 350 | 450 | ✅ OK |
| /health | GET | 15 | 25 | 35 | ✅ Excelente |

**Observaciones**:
- Endpoints de órdenes son los más lentos (probablemente queries a SQL Server)
- Health check es rápido (sin DB)
- Target: P95 < 500ms para endpoints simples, < 2s para complejos

### 4.2 Queries de Base de Datos (Estimado)

**MySQL**:
- Queries promedio: 50-150ms
- Queries lentas (> 1s): ~5% del total
- Connection pool usage: 40-60% promedio

**SQL Server (Softkey)**:
- Queries promedio: 200-500ms (red externa)
- Queries lentas (> 2s): ~15% del total
- Connection pool usage: 30-50% promedio

### 4.3 Uso de Recursos (Docker)

**Backend Container**:
- CPU: 15-25% promedio, picos de 60%
- Memoria: 250-350 MB
- Network I/O: 5-10 MB/s

**MySQL Container**:
- CPU: 10-20% promedio
- Memoria: 400-600 MB
- Disk I/O: 2-5 MB/s

**Frontend Containers** (3):
- CPU: 5-10% cada uno
- Memoria: 100-150 MB cada uno

---

## 5. Configuración de Logging Estructurado

### 5.1 Formato de Logs Estandarizado

**Todos los logs deben seguir este formato**:

```javascript
{
  "timestamp": "2026-02-21T10:30:45.123Z",
  "level": "info|warn|error",
  "service": "backend|frontend|cron",
  "operation": "operation_name",
  "duration_ms": 123,
  "metadata": {
    // Datos específicos de la operación
  }
}
```

### 5.2 Niveles de Log por Ambiente

**Development**:
```javascript
logger.level = 'debug';
// Loguea: debug, info, warn, error
```

**Production**:
```javascript
logger.level = 'info';
// Loguea: info, warn, error
```

### 5.3 Rotación de Logs

**Configuración en logger.js**:
```javascript
new winston.transports.File({
  filename: 'logs/app.log',
  maxsize: 10485760, // 10MB
  maxFiles: 5,
  tailable: true
})
```

---

## 6. Herramientas Adicionales Recomendadas

### 6.1 SonarQube (Opcional)

**Análisis de calidad de código**:
```bash
# Instalar SonarQube Scanner
npm install --save-dev sonarqube-scanner

# Configurar sonar-project.properties
sonar.projectKey=gelymar-platform
sonar.sources=.
sonar.exclusions=node_modules/**,logs/**,temp/**
```

### 6.2 npm audit

**Escaneo de vulnerabilidades**:
```bash
npm audit
npm audit --json > audit-report.json
npm audit fix
```

### 6.3 Clinic.js (Opcional)

**Profiling de Node.js**:
```bash
npm install -g clinic

# Profiling de CPU
clinic doctor -- node app.js

# Profiling de memoria
clinic heapprofiler -- node app.js
```

---

## 7. Checklist de Implementación

### Fase 1: Configuración Básica
- [ ] Instalar ESLint y Prettier
- [ ] Configurar .eslintrc.json y .prettierrc.json
- [ ] Agregar scripts de lint y format a package.json
- [ ] Ejecutar lint inicial y revisar issues

### Fase 2: Métricas de Performance
- [ ] Implementar middleware de métricas
- [ ] Agregar logging de queries lentas (MySQL y SQL Server)
- [ ] Implementar monitoreo de connection pools
- [ ] Configurar rotación de logs

### Fase 3: Captura de Baseline
- [ ] Ejecutar script de captura de baseline
- [ ] Analizar logs de performance
- [ ] Documentar métricas actuales
- [ ] Identificar cuellos de botella

### Fase 4: Monitoreo Continuo
- [ ] Configurar alertas para endpoints lentos
- [ ] Configurar alertas para queries lentas
- [ ] Configurar alertas para uso alto de recursos
- [ ] Implementar dashboard de métricas (opcional)

---

## 8. Próximos Pasos

1. **Implementar configuración de ESLint y Prettier** (1 hora)
2. **Agregar middleware de métricas** (1 hora)
3. **Implementar logging de queries lentas** (2 horas)
4. **Capturar baseline de performance** (1 hora)
5. **Analizar resultados y documentar** (1 hora)

**Total estimado**: 6 horas

---

**Documento generado**: 21 de febrero de 2026  
**Próxima actualización**: Después de implementar configuración
