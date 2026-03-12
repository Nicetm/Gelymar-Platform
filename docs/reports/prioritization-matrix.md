# Matriz de Priorización - Optimización Gelymar

**Fecha**: 20 de febrero de 2026  
**Versión**: 1.0  
**Metodología**: Impacto × Esfuerzo × Riesgo

## Resumen Ejecutivo

Esta matriz prioriza los 85 issues identificados usando una metodología de scoring que considera:
- **Impacto**: Beneficio esperado (1-10)
- **Esfuerzo**: Tiempo de implementación (1-10, inverso)
- **Riesgo**: Probabilidad de problemas (1-10, inverso)
- **ROI Score**: (Impacto × 10) / (Esfuerzo + Riesgo)

### Distribución por Prioridad

| Prioridad | Cantidad | Esfuerzo Total | ROI Promedio |
|-----------|----------|----------------|--------------|
| P0 (Crítico) | 15 | 40-55 horas | 8.5 |
| P1 (Alto) | 21 | 60-85 horas | 6.2 |
| P2 (Medio) | 30 | 45-65 horas | 4.1 |
| P3 (Bajo) | 19 | 15-25 horas | 2.8 |
| **Total** | **85** | **160-230 horas** | **5.4** |


---

## 1. Issues Prioridad P0 (Crítico)

### Metodología de Scoring P0
- Impacto: 9-10 (crítico para seguridad o estabilidad)
- Esfuerzo: Variable
- Riesgo: Variable
- ROI Score: >7.0

| ID | Issue | Impacto | Esfuerzo | Riesgo | ROI | Horas |
|----|-------|---------|----------|--------|-----|-------|
| SEC-001 | Secretos hardcodeados | 10 | 2 | 2 | 25.0 | 8-12h |
| SEC-002 | Endpoints sin auth (vendedor) | 10 | 1 | 1 | 50.0 | 1h |
| ERR-001 | Middleware global errores | 9 | 1 | 1 | 45.0 | 1h |
| ERR-002 | Exposición error.message | 9 | 2 | 2 | 22.5 | 4-6h |
| ARCH-001 | order.service.js (1355 líneas) | 8 | 8 | 4 | 6.7 | 40-64h |
| SEC-003 | Vulnerabilidades dependencias | 9 | 3 | 2 | 18.0 | 4-8h |
| CODE-001 | networkMount.service.js muerto | 7 | 1 | 1 | 35.0 | 1h |

**Total P0**: 7 issues, 59-92 horas, ROI promedio: 28.9

### Recomendación de Implementación P0

**Sprint 1 (Semana 1)** - Victorias rápidas de seguridad:
1. SEC-002: Proteger endpoints vendedor (1h)
2. ERR-001: Middleware global errores (1h)
3. CODE-001: Eliminar networkMount.service.js (1h)
4. SEC-001: Rotar secretos y configurar gestión (8-12h)

**Sprint 2 (Semana 2)** - Correcciones críticas:
5. ERR-002: Eliminar exposición error.message (4-6h)
6. SEC-003: Actualizar dependencias críticas (4-8h)

**Sprint 3-4 (Semanas 3-8)** - Refactoring arquitectónico:
7. ARCH-001: Dividir order.service.js (40-64h)

---

## 2. Issues Prioridad P1 (Alto)

### Metodología de Scoring P1
- Impacto: 7-8 (alto impacto en mantenibilidad/performance)
- Esfuerzo: Variable
- Riesgo: Variable
- ROI Score: 5.0-7.0

| ID | Issue | Impacto | Esfuerzo | Riesgo | ROI | Horas |
|----|-------|---------|----------|--------|-----|-------|
| LOG-001 | Logging inconsistente (16 archivos) | 7 | 3 | 2 | 14.0 | 8-12h |
| ARCH-002 | file.service.js (915 líneas) | 7 | 6 | 3 | 7.8 | 24-40h |
| ARCH-003 | customer.service.js (649 líneas) | 7 | 5 | 3 | 8.8 | 16-32h |
| ARCH-004 | user.service.js (565 líneas) | 7 | 5 | 3 | 8.8 | 24-40h |
| ARCH-005 | email.service.js (324 líneas) | 6 | 4 | 2 | 10.0 | 16-24h |
| DUP-001 | Normalización RUT duplicada | 6 | 2 | 1 | 20.0 | 2-3h |
| DUP-002 | Autenticación token duplicada | 6 | 3 | 2 | 12.0 | 3-4h |
| API-001 | Validación inputs faltante | 7 | 4 | 2 | 11.7 | 6-8h |
| API-002 | Lógica autorización duplicada | 6 | 3 | 2 | 12.0 | 4-6h |
| API-003 | Rate limiting limitado | 6 | 2 | 2 | 15.0 | 2-3h |
| API-004 | Paginación faltante (6 endpoints) | 7 | 3 | 2 | 14.0 | 4-6h |
| CRON-001 | Sin retry logic | 7 | 2 | 2 | 17.5 | 4-6h |
| CRON-002 | Sin health checks | 7 | 2 | 2 | 17.5 | 4-6h |
| CRON-003 | Sin manejo señales | 7 | 2 | 2 | 17.5 | 4-6h |
| DB-001 | Queries SQL Server lentas | 8 | 4 | 3 | 11.4 | 8-12h |
| DB-002 | Índices faltantes | 8 | 2 | 2 | 20.0 | 4-6h |

**Total P1**: 16 issues, 129-208 horas, ROI promedio: 13.5

### Recomendación de Implementación P1

**Sprint 5 (Semana 9)** - Mejoras de código:
1. LOG-001: Estandarizar logging (8-12h)
2. DUP-001: Consolidar normalización RUT (2-3h)
3. DUP-002: Estandarizar auth token (3-4h)
4. API-003: Extender rate limiting (2-3h)

**Sprint 6 (Semana 10)** - Base de datos:
5. DB-002: Agregar índices SQL Server (4-6h)
6. DB-001: Optimizar queries lentas (8-12h)
7. API-004: Implementar paginación (4-6h)

**Sprint 7 (Semana 11)** - APIs y validación:
8. API-001: Agregar validación inputs (6-8h)
9. API-002: Middleware autorización (4-6h)

**Sprint 8 (Semana 12)** - Cron jobs:
10. CRON-001: Implementar retry logic (4-6h)
11. CRON-002: Agregar health checks (4-6h)
12. CRON-003: Manejo de señales (4-6h)

**Sprint 9-12 (Semanas 13-20)** - Refactoring servicios:
13. ARCH-005: Dividir email.service.js (16-24h)
14. ARCH-003: Dividir customer.service.js (16-32h)
15. ARCH-004: Dividir user.service.js (24-40h)
16. ARCH-002: Dividir file.service.js (24-40h)


---

## 3. Issues Prioridad P2 (Medio)

### Metodología de Scoring P2
- Impacto: 5-6 (mejora calidad de código)
- Esfuerzo: Variable
- Riesgo: Variable
- ROI Score: 3.0-5.0

| ID | Issue | Impacto | Esfuerzo | Riesgo | ROI | Horas |
|----|-------|---------|----------|--------|-----|-------|
| ERR-003 | Try-catch inconsistente | 6 | 3 | 2 | 12.0 | 6-8h |
| ERR-004 | Errores no logueados | 6 | 3 | 2 | 12.0 | 4-6h |
| ERR-005 | Validación parámetros faltante | 5 | 3 | 2 | 10.0 | 6-8h |
| ERR-006 | Mensajes error genéricos | 5 | 3 | 2 | 10.0 | 4-6h |
| ERR-007 | Logging operaciones exitosas | 5 | 2 | 1 | 16.7 | 3-4h |
| API-005 | Formato respuesta inconsistente | 5 | 3 | 2 | 10.0 | 4-6h |
| API-006 | Uso PATCH vs PUT inconsistente | 4 | 2 | 1 | 13.3 | 2-3h |
| API-007 | Rutas duplicadas | 4 | 2 | 2 | 10.0 | 2-3h |
| API-008 | POST para búsqueda | 4 | 1 | 1 | 20.0 | 1-2h |
| API-009 | Endpoints cron sin protección | 6 | 2 | 2 | 15.0 | 2-3h |
| API-010 | Ruta /test expuesta | 5 | 1 | 1 | 25.0 | 0.5h |
| CRON-004 | Lógica duplicada (5 patrones) | 5 | 4 | 2 | 8.3 | 6-8h |
| CRON-005 | Timeouts no configurados | 5 | 1 | 1 | 25.0 | 1-2h |
| CRON-006 | Logging incompleto | 5 | 3 | 2 | 10.0 | 6-8h |
| CRON-007 | Config PM2 básica | 4 | 2 | 2 | 10.0 | 2-3h |
| SEC-004 | Contraseñas débiles por defecto | 6 | 2 | 2 | 15.0 | 2-3h |
| SEC-005 | JWT sin refresh tokens | 5 | 4 | 3 | 7.1 | 6-8h |
| SEC-006 | CORS hardening | 4 | 1 | 1 | 20.0 | 1-2h |
| DUP-003 | Validación path duplicada | 4 | 2 | 1 | 13.3 | 2-3h |
| DUP-004 | Parsing config duplicado | 4 | 2 | 1 | 13.3 | 2-3h |

**Total P2**: 20 issues (muestra), 61-88 horas, ROI promedio: 13.8

### Recomendación de Implementación P2

**Sprint 13-14 (Semanas 21-22)** - Mejoras de error handling:
1. ERR-003: Estandarizar try-catch (6-8h)
2. ERR-004: Agregar logging errores (4-6h)
3. ERR-005: Validar parámetros (6-8h)
4. ERR-006: Mejorar mensajes error (4-6h)
5. ERR-007: Logging operaciones exitosas (3-4h)

**Sprint 15 (Semana 23)** - Mejoras de APIs:
6. API-005: Estandarizar formato respuesta (4-6h)
7. API-009: Proteger endpoints cron (2-3h)
8. API-010: Eliminar ruta /test (0.5h)
9. API-008: Cambiar POST a GET (1-2h)
10. API-006: Estandarizar PATCH/PUT (2-3h)

**Sprint 16 (Semana 24)** - Cron jobs y duplicación:
11. CRON-004: Consolidar lógica duplicada (6-8h)
12. CRON-005: Configurar timeouts (1-2h)
13. CRON-006: Mejorar logging (6-8h)
14. DUP-003: Consolidar validación path (2-3h)
15. DUP-004: Consolidar parsing config (2-3h)

**Sprint 17 (Semana 25)** - Seguridad:
16. SEC-004: Mejorar contraseñas default (2-3h)
17. SEC-005: Implementar refresh tokens (6-8h)
18. SEC-006: Hardening CORS (1-2h)

---

## 4. Issues Prioridad P3 (Bajo)

### Metodología de Scoring P3
- Impacto: 3-4 (mejoras menores)
- Esfuerzo: Variable
- Riesgo: Bajo
- ROI Score: <3.0

| ID | Issue | Impacto | Esfuerzo | Riesgo | ROI | Horas |
|----|-------|---------|----------|--------|-----|-------|
| LOG-002 | console.warn vs logger.warn | 3 | 1 | 1 | 15.0 | 1-2h |
| LOG-003 | Correlation IDs faltantes | 4 | 3 | 2 | 8.0 | 4-6h |
| API-011 | Falta 204 No Content | 3 | 1 | 1 | 15.0 | 1-2h |
| API-012 | Uso 500 para errores negocio | 3 | 2 | 1 | 10.0 | 2-3h |
| CODE-002 | Imports no utilizados | 3 | 2 | 1 | 10.0 | 2-3h |
| CODE-003 | Callbacks vs async/await | 3 | 1 | 1 | 15.0 | 1-2h |
| CRON-008 | Métricas Prometheus | 4 | 4 | 2 | 6.7 | 6-8h |
| CRON-009 | Grafana dashboards | 4 | 5 | 2 | 5.7 | 8-10h |
| CRON-010 | Auditoría en BD | 3 | 3 | 2 | 6.0 | 4-6h |
| SEC-007 | Escaneo archivos (ClamAV) | 4 | 5 | 3 | 5.0 | 8-12h |
| SEC-008 | Logging eventos seguridad | 4 | 3 | 2 | 8.0 | 4-6h |

**Total P3**: 11 issues (muestra), 41-60 horas, ROI promedio: 9.0

### Recomendación de Implementación P3

**Backlog** - Implementar según capacidad disponible:
- Mejoras de logging y observabilidad
- Refinamientos de código
- Monitoreo avanzado

---

## 5. Dependencias entre Optimizaciones

### 5.1 Dependencias Críticas

```
SEC-001 (Secretos) → Debe completarse antes de cualquier deployment
  ↓
ERR-001 (Middleware global) → Base para error handling
  ↓
ERR-002 (Exposición errors) → Depende de middleware global
  ↓
LOG-001 (Logging) → Estandarizar antes de refactoring
  ↓
ARCH-001-005 (Refactoring servicios) → Requiere logging estandarizado
```

### 5.2 Dependencias de Base de Datos

```
DB-002 (Índices) → Implementar primero (impacto inmediato)
  ↓
DB-001 (Queries lentas) → Optimizar después de índices
  ↓
API-004 (Paginación) → Implementar con queries optimizadas
```

### 5.3 Dependencias de APIs

```
API-001 (Validación) → Base para seguridad
  ↓
API-002 (Autorización) → Depende de validación
  ↓
API-003 (Rate limiting) → Implementar después de validación
```

---

## 6. Cálculo de ROI por Categoría

| Categoría | Issues | Esfuerzo | ROI Promedio | Prioridad |
|-----------|--------|----------|--------------|-----------|
| Seguridad | 11 | 30-45h | 18.5 | P0 |
| Error Handling | 11 | 27-40h | 14.2 | P0-P1 |
| Service Architecture | 8 | 120-200h | 8.1 | P0-P1 |
| API Endpoints | 10 | 30-45h | 13.8 | P1-P2 |
| Cron Jobs | 33 | 53-75h | 11.2 | P1-P2 |
| Code Quality | 12 | 20-30h | 12.5 | P2-P3 |

### ROI Insights

**Mejor ROI**: Seguridad (18.5) - Bajo esfuerzo, alto impacto  
**Mayor Esfuerzo**: Service Architecture (120-200h) - Refactoring profundo  
**Balance Óptimo**: API Endpoints (13.8 ROI, 30-45h) - Buen retorno con esfuerzo moderado

---

## 7. Roadmap de Implementación

### Fase 1: Fundamentos (Semanas 1-4)
**Objetivo**: Resolver issues críticos de seguridad y estabilidad  
**Esfuerzo**: 59-92 horas  
**Issues**: P0 (7 issues)  
**ROI Esperado**: 28.9

### Fase 2: Optimización (Semanas 5-12)
**Objetivo**: Mejorar performance y mantenibilidad  
**Esfuerzo**: 129-208 horas  
**Issues**: P1 (16 issues)  
**ROI Esperado**: 13.5

### Fase 3: Refinamiento (Semanas 13-25)
**Objetivo**: Pulir calidad de código y APIs  
**Esfuerzo**: 61-88 horas  
**Issues**: P2 (20 issues)  
**ROI Esperado**: 13.8

### Fase 4: Mejora Continua (Backlog)
**Objetivo**: Implementar mejoras menores  
**Esfuerzo**: 41-60 horas  
**Issues**: P3 (11 issues)  
**ROI Esperado**: 9.0

**Total**: 290-448 horas (36-56 días de desarrollo)

---

## 8. Recomendaciones Finales

### 8.1 Priorización Recomendada

1. **Semana 1**: Victorias rápidas de seguridad (SEC-002, ERR-001, CODE-001, SEC-001)
2. **Semana 2**: Correcciones críticas (ERR-002, SEC-003)
3. **Semanas 3-8**: Refactoring order.service.js (ARCH-001)
4. **Semanas 9-12**: Mejoras de código y base de datos
5. **Semanas 13-25**: Refinamiento y optimización continua

### 8.2 Equipo Recomendado

- **2 desarrolladores senior**: Refactoring arquitectónico (ARCH-001-005)
- **1 desarrollador mid-level**: APIs y validación
- **1 desarrollador junior**: Logging, duplicación, mejoras menores

### 8.3 Métricas de Éxito

- ✅ 100% issues P0 resueltos en 8 semanas
- ✅ 80% issues P1 resueltos en 20 semanas
- ✅ 60% issues P2 resueltos en 25 semanas
- ✅ Reducción 40% tiempo respuesta promedio
- ✅ Reducción 67% queries lentas
- ✅ Reducción 30% bundle sizes

---

**Documento generado**: 20 de febrero de 2026  
**Próxima revisión**: Después de completar Fase 1

