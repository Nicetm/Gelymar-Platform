# Análisis de Logging y Monitoreo de Cron Jobs

**Fecha**: 2024-01-15
**Categoría**: Cron Jobs - Logging y Monitoreo
**Severidad**: Media

## Resumen Ejecutivo

Se analizaron los 7 cron jobs del sistema para evaluar logging de inicio/progreso/finalización, health checks, configuración de PM2 y manejo de señales. Se encontraron 15 issues que afectan la observabilidad, monitoreo y gestión de procesos.

## Métricas Generales

- **Total de Cron Jobs**: 7
- **Issues Identificados**: 15
- **Jobs con Logging Completo**: 1/7 (14%) - solo cronMaster
- **Jobs con Health Checks**: 0/7 (0%)
- **Jobs con Manejo de Señales**: 0/7 (0%)
- **Configuración PM2**: Básica en todos

---

## 1. Logging de Inicio, Progreso y Finalización

### Issue 1.1: Logging Inconsistente de Inicio
**Severidad**: Media
**Archivos**: Todos los jobs

**Análisis por Job**:

**cronMaster.js** ✅ Logging completo:
```javascript
logger.info('[cronMaster] Iniciando secuencia de tareas...');
logger.info('[cronMaster] Iniciando tareas...');
logger.info(`[cronMaster] TAREA ${task.name} HABILITADA - EJECUTANDO...`);
```

**sendOrderReception.js** ❌ Sin logging de inicio:
```javascript
async function processNewOrdersAndSendEmails() {
  try {
    // No hay log de inicio
    const url = `${BACKEND_API_URL}/api/cron/process-new-orders`;
    const response = await axios.post(url, ...);
```

**Otros jobs** ❌ Sin logging de inicio:
- sendShipmentNotice.js
- sendOrderDeliveryNotice.js
- sendAvailableNotice.js
- sendDbBackup.js
- sendAdminNotifications.js

**Impacto**:
- Dificulta determinar si job inició correctamente
- No se puede rastrear frecuencia de ejecución
- Logs incompletos para auditoría

**Recomendación**: Estandarizar logging de inicio en todos los jobs:
```javascript
async function processJob() {
  const startTime = new Date();
  logger.info(`[${jobName}] Iniciando ejecución - ${startTime.toISOString()}`);
  
  try {
    // Lógica del job
  } catch (error) {
    // ...
  }
}
```

**Esfuerzo**: Bajo (1 hora)

---

### Issue 1.2: Logging Limitado de Progreso
**Severidad**: Media
**Archivos**: Todos los jobs HTTP

**Descripción**: Los jobs solo loguean resultado final, no progreso intermedio:
```javascript
// sendOrderReception.js
if (data.processed === 0) {
  logger.info('[processNewOrdersAndSendEmails] No se encontraron ordenes nuevas');
} else {
  logger.info(`[processNewOrdersAndSendEmails] Ordenes procesadas: ${data.processed}`);
}
```

**Impacto**:
- No se puede monitorear progreso de jobs largos
- Dificulta debugging de jobs que fallan a mitad de ejecución
- No hay visibilidad de operaciones intermedias

**Recomendación**: Implementar logging de progreso:
```javascript
logger.info(`[${jobName}] Consultando órdenes pendientes...`);
logger.info(`[${jobName}] Encontradas ${count} órdenes para procesar`);
logger.info(`[${jobName}] Procesando orden ${i}/${total}: ${orderId}`);
logger.info(`[${jobName}] Generando PDF para orden ${orderId}...`);
logger.info(`[${jobName}] Enviando email a ${recipients.length} destinatarios...`);
```

**Nota**: Esto requiere modificar servicios del backend, no solo cron jobs.

**Esfuerzo**: Medio (4-6 horas, incluye backend)

---

### Issue 1.3: Logging Inconsistente de Finalización
**Severidad**: Media
**Archivos**: Todos los jobs

**Análisis**:

**cronMaster.js** ✅ Logging completo de finalización:
```javascript
const endTime = new Date();
const totalDuration = endTime - startTime;
logger.info('[cronMaster] Secuencia completada!');
logger.info('[cronMaster] Secuencia completada');
```

**Otros jobs** ⚠️ Logging condicional:
```javascript
// Solo loguea si hay datos procesados
if (data.processed === 0) {
  logger.info('[jobName] No se encontraron X para enviar');
} else {
  logger.info(`[jobName] X enviados: ${data.processed}`);
}
// No hay log explícito de "Job completado"
```

**Impacto**:
- No hay confirmación clara de finalización exitosa
- Dificulta determinar si job terminó o se colgó
- No se registra duración total

**Recomendación**: Estandarizar logging de finalización:
```javascript
const startTime = Date.now();
try {
  await processJob();
  const duration = Date.now() - startTime;
  logger.info(`[${jobName}] Completado exitosamente en ${duration}ms`);
} catch (error) {
  const duration = Date.now() - startTime;
  logger.error(`[${jobName}] Falló después de ${duration}ms: ${error.message}`);
  throw error;
}
```

**Esfuerzo**: Bajo (1-2 horas)

---

### Issue 1.4: Sin Logging Estructurado
**Severidad**: Media
**Archivos**: Todos los jobs

**Descripción**: Los logs son texto plano, no estructurados:
```javascript
logger.info('[cronMaster] Secuencia completada!');
logger.info(`[processNewOrdersAndSendEmails] Ordenes procesadas: ${data.processed}`);
```

**Impacto**:
- Dificulta parsing automático de logs
- No se pueden extraer métricas fácilmente
- Dificulta integración con sistemas de monitoreo

**Recomendación**: Implementar logging estructurado (JSON):
```javascript
logger.info({
  job: 'sendOrderReception',
  event: 'job_completed',
  duration_ms: 5432,
  orders_processed: 10,
  orders_failed: 2,
  timestamp: new Date().toISOString()
});
```

**Configuración de Winston**:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'cron-jobs.log' })
  ]
});
```

**Esfuerzo**: Medio (3-4 horas)

---

### Issue 1.5: Sin Correlation IDs
**Severidad**: Baja
**Archivos**: Todos los jobs

**Descripción**: No hay IDs de correlación para rastrear ejecuciones:
```javascript
logger.info('[cronMaster] Iniciando secuencia...');
// No hay ID único para esta ejecución
```

**Impacto**:
- Dificulta rastrear logs de una ejecución específica
- No se pueden correlacionar logs entre job y backend
- Dificulta debugging de ejecuciones específicas

**Recomendación**: Generar correlation ID por ejecución:
```javascript
const { v4: uuidv4 } = require('uuid');

async function executeJob() {
  const executionId = uuidv4();
  
  logger.info({
    job: 'sendOrderReception',
    execution_id: executionId,
    event: 'job_started'
  });
  
  // Pasar executionId a backend en headers
  const response = await axios.post(url, data, {
    headers: {
      'X-Execution-ID': executionId
    }
  });
}
```

**Esfuerzo**: Medio (2-3 horas)

---

## 2. Health Checks para Monitoreo

### Issue 2.1: Sin Health Checks Implementados
**Severidad**: Alta
**Archivos**: Todos los jobs

**Descripción**: Ningún job expone health checks:
```javascript
// No hay endpoint HTTP para health check
// No hay archivo de estado
// No hay señal de heartbeat
```

**Impacto**:
- No se puede monitorear estado de jobs externamente
- Dificulta integración con sistemas de monitoreo (Prometheus, Grafana)
- No hay alertas automáticas si job falla

**Recomendación**: Implementar health checks de múltiples formas:

**Opción 1: Archivo de Estado**
```javascript
const fs = require('fs');
const path = require('path');

function updateHealthStatus(jobName, status, lastRun, nextRun) {
  const healthFile = path.join('/tmp', `${jobName}.health`);
  const health = {
    job: jobName,
    status: status, // 'running', 'idle', 'error'
    last_run: lastRun,
    next_run: nextRun,
    updated_at: new Date().toISOString()
  };
  fs.writeFileSync(healthFile, JSON.stringify(health, null, 2));
}

// Actualizar al inicio
updateHealthStatus('sendOrderReception', 'running', new Date(), null);

// Actualizar al finalizar
updateHealthStatus('sendOrderReception', 'idle', lastRun, nextRun);
```

**Opción 2: Endpoint HTTP Simple**
```javascript
const express = require('express');
const app = express();

let lastExecution = null;
let lastStatus = 'idle';

app.get('/health', (req, res) => {
  res.json({
    job: 'sendOrderReception',
    status: lastStatus,
    last_execution: lastExecution,
    uptime: process.uptime()
  });
});

app.listen(9000 + jobIndex); // Puerto único por job
```

**Opción 3: Métricas en PM2**
```javascript
// PM2 ya expone métricas básicas
// Accesibles vía: pm2 jlist
// O vía API: http://localhost:9615
```

**Esfuerzo**: Medio (4-6 horas para todos los jobs)

---

### Issue 2.2: Sin Métricas Exportadas
**Severidad**: Media
**Archivos**: Todos los jobs

**Descripción**: No se exportan métricas para monitoreo:
```javascript
// No hay métricas de:
// - Duración de ejecución
// - Tasa de éxito/fallo
// - Items procesados
// - Errores por tipo
```

**Impacto**:
- No se puede monitorear performance en tiempo real
- No hay alertas basadas en métricas
- Dificulta detección de degradación

**Recomendación**: Exportar métricas en formato Prometheus:
```javascript
const client = require('prom-client');

// Definir métricas
const jobDuration = new client.Histogram({
  name: 'cron_job_duration_seconds',
  help: 'Duration of cron job execution',
  labelNames: ['job_name', 'status']
});

const jobCounter = new client.Counter({
  name: 'cron_job_executions_total',
  help: 'Total number of cron job executions',
  labelNames: ['job_name', 'status']
});

const itemsProcessed = new client.Gauge({
  name: 'cron_job_items_processed',
  help: 'Number of items processed in last execution',
  labelNames: ['job_name']
});

// Usar métricas
const end = jobDuration.startTimer();
try {
  await processJob();
  end({ job_name: 'sendOrderReception', status: 'success' });
  jobCounter.inc({ job_name: 'sendOrderReception', status: 'success' });
  itemsProcessed.set({ job_name: 'sendOrderReception' }, processedCount);
} catch (error) {
  end({ job_name: 'sendOrderReception', status: 'error' });
  jobCounter.inc({ job_name: 'sendOrderReception', status: 'error' });
}

// Exponer métricas
app.get('/metrics', (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(client.register.metrics());
});
```

**Esfuerzo**: Alto (6-8 horas para todos los jobs)

---

### Issue 2.3: Sin Alertas Configuradas
**Severidad**: Media
**Archivos**: N/A (configuración externa)

**Descripción**: No hay alertas configuradas para fallos de cron jobs:
```javascript
// Si un job falla, solo se loguea
// No hay notificación a admins
// No hay integración con sistemas de alertas
```

**Impacto**:
- Fallos pueden pasar desapercibidos
- No hay respuesta rápida a problemas
- Requiere revisión manual de logs

**Recomendación**: Implementar alertas en múltiples niveles:

**Nivel 1: Alertas en el Job**
```javascript
async function notifyFailure(jobName, error) {
  try {
    await axios.post(`${BACKEND_API_URL}/api/notifications/cron-failure`, {
      job: jobName,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error(`Failed to send alert: ${err.message}`);
  }
}

try {
  await processJob();
} catch (error) {
  await notifyFailure('sendOrderReception', error);
  throw error;
}
```

**Nivel 2: Alertas en PM2**
```javascript
// ecosystem.config.js
{
  name: 'gelymar-order-reception',
  script: './cron/sendOrderReception.js',
  max_restarts: 3,
  min_uptime: '10s',
  // Si falla 3 veces en menos de 10s, PM2 lo marca como errored
}
```

**Nivel 3: Alertas en Prometheus/Grafana**
```yaml
# prometheus-alerts.yml
groups:
  - name: cron_jobs
    rules:
      - alert: CronJobFailed
        expr: rate(cron_job_executions_total{status="error"}[5m]) > 0
        for: 1m
        annotations:
          summary: "Cron job {{ $labels.job_name }} is failing"
```

**Esfuerzo**: Alto (8-10 horas, incluye configuración de infraestructura)

---

## 3. Configuración de PM2

### Issue 3.1: Configuración Básica de PM2
**Severidad**: Media
**Archivos**: ecosystem.config.js

**Descripción**: Configuración muy básica en ecosystem.config.js:
```javascript
{
  name: 'gelymar-order-reception',
  script: './cron/sendOrderReception.js',
  watch: false,
  autorestart: true,
  wait_ready: true,
  listen_timeout: 10000,
  kill_timeout: 5000
}
```

**Faltantes**:
- Límites de memoria
- Límites de reintentos
- Configuración de logs
- Variables de entorno
- Modo cluster (si aplica)

**Impacto**:
- Jobs pueden consumir memoria ilimitada
- Reintentos infinitos en caso de fallo
- Logs no configurados correctamente

**Recomendación**: Mejorar configuración de PM2:
```javascript
{
  name: 'gelymar-order-reception',
  script: './cron/sendOrderReception.js',
  
  // Gestión de procesos
  watch: false,
  autorestart: true,
  max_restarts: 10,
  min_uptime: '10s',
  restart_delay: 4000,
  
  // Recursos
  max_memory_restart: '500M',
  
  // Señales
  wait_ready: true,
  listen_timeout: 10000,
  kill_timeout: 5000,
  shutdown_with_message: true,
  
  // Logs
  error_file: './logs/order-reception-error.log',
  out_file: './logs/order-reception-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
  log_type: 'json',
  
  // Variables de entorno
  env: {
    NODE_ENV: 'production',
    CRON_HTTP_TIMEOUT: '300000'
  },
  
  // Monitoreo
  pmx: true,
  instance_var: 'INSTANCE_ID'
}
```

**Esfuerzo**: Bajo (1-2 horas)

---

### Issue 3.2: Sin Rotación de Logs en PM2
**Severidad**: Media
**Archivos**: ecosystem.config.js

**Descripción**: No hay configuración de rotación de logs:
```javascript
// Logs crecen indefinidamente
error_file: './logs/order-reception-error.log',
out_file: './logs/order-reception-out.log',
```

**Impacto**:
- Logs pueden llenar disco
- Dificulta búsqueda en logs grandes
- Performance degradada al escribir logs

**Recomendación**: Configurar pm2-logrotate:
```bash
# Instalar módulo
pm2 install pm2-logrotate

# Configurar rotación
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateModule true
```

**Esfuerzo**: Bajo (30 minutos)

---

### Issue 3.3: Sin Monitoreo de PM2
**Severidad**: Baja
**Archivos**: ecosystem.config.js

**Descripción**: PM2 web interface configurado pero no documentado:
```javascript
// Puerto 9615 expuesto en Docker
// Pero no hay documentación de uso
```

**Impacto**:
- Funcionalidad de monitoreo no utilizada
- No hay dashboards configurados
- Métricas de PM2 no aprovechadas

**Recomendación**: 
1. Documentar acceso a PM2 web interface
2. Configurar PM2 Plus (opcional, servicio pago)
3. Integrar métricas de PM2 con Prometheus

**PM2 Metrics Exporter**:
```bash
npm install pm2-prometheus-exporter
pm2 install pm2-prometheus-exporter
```

**Esfuerzo**: Bajo (1-2 horas)

---

## 4. Manejo de Señales (SIGTERM, SIGINT)

### Issue 4.1: Sin Manejo de Señales
**Severidad**: Alta
**Archivos**: Todos los jobs

**Descripción**: Ningún job maneja señales de terminación:
```javascript
// No hay listeners para SIGTERM, SIGINT
// No hay graceful shutdown
// No hay cleanup de recursos
```

**Impacto**:
- Jobs pueden terminar abruptamente
- Operaciones en progreso se pierden
- Recursos no se liberan correctamente
- Puede corromper datos

**Recomendación**: Implementar graceful shutdown:
```javascript
let isShuttingDown = false;
let currentOperation = null;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn(`[${jobName}] Shutdown already in progress`);
    return;
  }
  
  isShuttingDown = true;
  logger.info(`[${jobName}] Received ${signal}, starting graceful shutdown...`);
  
  // Esperar operación actual
  if (currentOperation) {
    logger.info(`[${jobName}] Waiting for current operation to complete...`);
    try {
      await Promise.race([
        currentOperation,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shutdown timeout')), 30000)
        )
      ]);
      logger.info(`[${jobName}] Current operation completed`);
    } catch (error) {
      logger.error(`[${jobName}] Error during shutdown: ${error.message}`);
    }
  }
  
  // Cleanup de recursos
  logger.info(`[${jobName}] Cleaning up resources...`);
  // Cerrar conexiones, archivos, etc.
  
  logger.info(`[${jobName}] Graceful shutdown complete`);
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Marcar operación actual
async function processJob() {
  currentOperation = actualProcessing();
  try {
    await currentOperation;
  } finally {
    currentOperation = null;
  }
}
```

**Esfuerzo**: Medio (4-6 horas para todos los jobs)

---

### Issue 4.2: Sin Timeout en Graceful Shutdown
**Severidad**: Media
**Archivos**: ecosystem.config.js

**Descripción**: kill_timeout de 5 segundos puede ser insuficiente:
```javascript
{
  kill_timeout: 5000 // 5 segundos
}
```

**Impacto**:
- Jobs con operaciones largas pueden ser killed abruptamente
- No hay tiempo suficiente para cleanup
- Puede causar inconsistencias

**Recomendación**: Ajustar timeout según job:
```javascript
{
  name: 'gelymar-order-reception',
  kill_timeout: 30000, // 30 segundos para jobs que procesan múltiples órdenes
}

{
  name: 'gelymar-db-backup',
  kill_timeout: 60000, // 60 segundos para backup
}
```

**Esfuerzo**: Muy bajo (15 minutos)

---

### Issue 4.3: Sin Manejo de Errores No Capturados
**Severidad**: Media
**Archivos**: Todos los jobs

**Descripción**: No hay handlers para errores no capturados:
```javascript
// No hay listeners para:
// - uncaughtException
// - unhandledRejection
```

**Impacto**:
- Errores no capturados pueden crashear el proceso
- No se loguean errores inesperados
- Dificulta debugging

**Recomendación**: Implementar handlers globales:
```javascript
process.on('uncaughtException', (error) => {
  logger.error({
    job: jobName,
    event: 'uncaught_exception',
    error: error.message,
    stack: error.stack
  });
  
  // Intentar graceful shutdown
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    job: jobName,
    event: 'unhandled_rejection',
    reason: reason,
    promise: promise
  });
  
  // No terminar proceso, solo loguear
  // PM2 reiniciará si es necesario
});
```

**Esfuerzo**: Bajo (1 hora)

---

## 5. Issues Adicionales de Observabilidad

### Issue 5.1: Sin Dashboards de Monitoreo
**Severidad**: Media
**Archivos**: N/A (infraestructura)

**Descripción**: No hay dashboards para visualizar estado de cron jobs:
```
- No hay Grafana configurado
- No hay visualización de métricas
- No hay histórico de ejecuciones
```

**Impacto**:
- No hay visibilidad centralizada
- Dificulta análisis de tendencias
- No hay alertas visuales

**Recomendación**: Configurar Grafana con dashboards:

**Dashboard sugerido**:
- Estado actual de todos los jobs (running/idle/error)
- Última ejecución de cada job
- Duración promedio por job
- Tasa de éxito/fallo
- Items procesados por día
- Alertas activas

**Esfuerzo**: Alto (8-10 horas, incluye configuración de Grafana)

---

### Issue 5.2: Sin Auditoría de Ejecuciones
**Severidad**: Baja
**Archivos**: Todos los jobs

**Descripción**: No se guarda histórico de ejecuciones en BD:
```javascript
// Logs solo en archivos
// No hay tabla de auditoría
// No hay histórico consultable
```

**Impacto**:
- No se puede consultar histórico fácilmente
- Dificulta análisis de patrones
- No hay trazabilidad en BD

**Recomendación**: Crear tabla de auditoría:
```sql
CREATE TABLE cron_job_executions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  job_name VARCHAR(100) NOT NULL,
  execution_id VARCHAR(36) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status ENUM('running', 'success', 'error') NOT NULL,
  duration_ms INT,
  items_processed INT,
  error_message TEXT,
  INDEX idx_job_started (job_name, started_at),
  INDEX idx_execution_id (execution_id)
);
```

**Insertar al inicio y actualizar al finalizar**:
```javascript
const executionId = uuidv4();
await pool.query(
  'INSERT INTO cron_job_executions (job_name, execution_id, started_at, status) VALUES (?, ?, NOW(), "running")',
  [jobName, executionId]
);

// Al finalizar
await pool.query(
  'UPDATE cron_job_executions SET completed_at = NOW(), status = ?, duration_ms = ?, items_processed = ? WHERE execution_id = ?',
  [status, duration, itemsProcessed, executionId]
);
```

**Esfuerzo**: Medio (4-6 horas)

---

## Resumen de Issues por Severidad

### Críticos (0)
Ninguno

### Altos (2)
- Issue 2.1: Sin Health Checks Implementados
- Issue 4.1: Sin Manejo de Señales

### Medios (9)
- Issue 1.1: Logging Inconsistente de Inicio
- Issue 1.2: Logging Limitado de Progreso
- Issue 1.3: Logging Inconsistente de Finalización
- Issue 1.4: Sin Logging Estructurado
- Issue 2.2: Sin Métricas Exportadas
- Issue 2.3: Sin Alertas Configuradas
- Issue 3.1: Configuración Básica de PM2
- Issue 3.2: Sin Rotación de Logs en PM2
- Issue 4.2: Sin Timeout en Graceful Shutdown
- Issue 4.3: Sin Manejo de Errores No Capturados
- Issue 5.1: Sin Dashboards de Monitoreo

### Bajos (4)
- Issue 1.5: Sin Correlation IDs
- Issue 3.3: Sin Monitoreo de PM2
- Issue 5.2: Sin Auditoría de Ejecuciones

---

## Recomendaciones Prioritarias

### Prioridad 1 (Crítico para Producción)
1. **Implementar Manejo de Señales** (Issue 4.1) - Previene pérdida de datos
2. **Implementar Health Checks** (Issue 2.1) - Permite monitoreo externo
3. **Estandarizar Logging** (Issues 1.1, 1.3) - Mejora observabilidad

### Prioridad 2 (Mejora Operacional)
4. **Configurar Alertas** (Issue 2.3) - Respuesta rápida a fallos
5. **Mejorar Configuración PM2** (Issue 3.1) - Mejor gestión de procesos
6. **Implementar Logging Estructurado** (Issue 1.4) - Facilita análisis

### Prioridad 3 (Mejoras Incrementales)
7. **Exportar Métricas** (Issue 2.2) - Monitoreo avanzado
8. **Configurar Dashboards** (Issue 5.1) - Visualización centralizada
9. **Auditoría en BD** (Issue 5.2) - Histórico consultable

---

## Estimación de Esfuerzo Total

- **Prioridad 1**: 10-14 horas
- **Prioridad 2**: 13-17 horas
- **Prioridad 3**: 16-24 horas
- **Total**: 39-55 horas (5-7 días de desarrollo)

---

## Plan de Implementación Sugerido

### Fase 1: Observabilidad Básica (1-2 días)
1. Estandarizar logging de inicio/finalización
2. Implementar manejo de señales
3. Mejorar configuración de PM2
4. Configurar rotación de logs

### Fase 2: Monitoreo Activo (2-3 días)
5. Implementar health checks
6. Configurar alertas básicas
7. Implementar logging estructurado
8. Agregar correlation IDs

### Fase 3: Monitoreo Avanzado (2-3 días)
9. Exportar métricas Prometheus
10. Configurar Grafana dashboards
11. Implementar auditoría en BD
12. Configurar alertas avanzadas

---

## Próximos Pasos

1. Revisar análisis con equipo de operaciones
2. Priorizar según impacto en producción
3. Configurar infraestructura de monitoreo (Prometheus/Grafana)
4. Implementar cambios por fases
5. Probar en staging
6. Desplegar a producción con monitoreo activo
7. Ajustar alertas según comportamiento real
