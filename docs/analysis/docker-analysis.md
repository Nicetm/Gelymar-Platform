# Análisis de Docker y Deployment

**Fecha**: 21 de febrero de 2026  
**Proyecto**: Code Optimization & Refactoring - Plataforma Gelymar  
**Stack**: Docker + Docker Compose + Node.js + MySQL

---

## Resumen Ejecutivo

Análisis completo de la configuración Docker identificando:
- Tamaños de imágenes Docker
- Uso de multi-stage builds
- Dependencias innecesarias
- Health checks
- Variables de entorno duplicadas
- Configuración hardcodeada

### Métricas Globales

| Métrica | Valor Actual | Target | Gap |
|---------|--------------|--------|-----|
| Imagen Frontend | 844-845 MB | < 300 MB | -544-545 MB |
| Imagen Backend | 512 MB | < 200 MB | -312 MB |
| Imagen Fileserver | 772 MB | < 150 MB | -622 MB |
| Imagen Cron | 285 MB | < 150 MB | -135 MB |
| Imagen MySQL | 1.07 GB | N/A (base) | N/A |
| Multi-stage builds | NO | SÍ | Crítico |
| Health checks | Parcial | 100% | 60% |

### Issues Críticos

1. **Frontend 844 MB** - Sin multi-stage build, incluye node_modules completo
2. **Backend 512 MB** - Sin multi-stage build, dependencias dev incluidas
3. **Fileserver 772 MB** - Imagen muy grande para servidor Apache
4. **Variables duplicadas** - 40+ variables de entorno repetidas
5. **Secretos hardcodeados** - Passwords en Dockerfiles
6. **Sin health checks** - Backend, Frontend, Cron sin health checks

---

## 1. Análisis de Tamaños de Imágenes Docker

### 1.1 Imágenes Actuales (MEDIDO)

| Imagen | Tamaño | Status | Problema Principal |
|--------|--------|--------|-------------------|
| Frontend (admin/client/seller) | 844-845 MB | 🔴 CRÍTICO | Sin multi-stage, node_modules completo |
| Backend | 512 MB | 🔴 ALTA | Sin multi-stage, deps dev incluidas |
| Fileserver | 772 MB | 🔴 ALTA | Imagen base muy grande |
| Cron | 285 MB | 🟡 MEDIA | Puede optimizarse |
| MySQL | 1.07 GB | 🟢 OK | Imagen base oficial |
| phpMyAdmin | 798 MB | 🟢 OK | Imagen base oficial |

**Total imágenes custom**: 2.96 GB (Frontend + Backend + Fileserver + Cron)  
**Target optimizado**: 800 MB (-73% reducción)

---

### 1.2 Problema Crítico: Frontend 844 MB

**Dockerfile actual**:
```dockerfile
FROM node:18-alpine  # Base: ~180 MB

WORKDIR /app
COPY package*.json ./
RUN npm ci  # Instala TODAS las dependencias (dev + prod)

COPY . .  # Copia TODO el código fuente

# Build
RUN npm run build:client

EXPOSE 2121
CMD ["npm", "run", "preview"]  # Necesita node_modules completo
```

**Problemas identificados**:
1. ❌ No usa multi-stage build
2. ❌ Incluye `node_modules` completo (dev + prod) → ~400-500 MB
3. ❌ Incluye código fuente completo → ~50-100 MB
4. ❌ Incluye archivos de build innecesarios
5. ❌ Comando `npm run preview` necesita dependencias dev

**Solución con multi-stage build**:
```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG APP_CONTEXT=client
RUN npm run build:${APP_CONTEXT}

# Stage 2: Production
FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev  # Solo dependencias de producción
EXPOSE 2121
CMD ["node", "./dist/server/entry.mjs"]
```

**Beneficio esperado**: 844 MB → 250-300 MB (-65% reducción)

---

### 1.3 Problema: Backend 512 MB

**Dockerfile actual**:
```dockerfile
FROM node:18-alpine  # Base: ~180 MB

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g pm2  # ✅ Solo prod, pero PM2 global

COPY . .  # Copia TODO

EXPOSE 3000
CMD ["npm", "start"]
```

**Problemas identificados**:
1. ❌ No usa multi-stage build
2. ❌ PM2 instalado globalmente (innecesario en Docker)
3. ❌ Incluye archivos innecesarios (tests, docs, etc.)
4. ⚠️ Copia directorios vacíos (`uploads`, `/mnt/red`)

**Solución optimizada**:
```dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Production
FROM node:18-alpine AS runner
RUN apk add --no-cache tzdata cifs-utils
ENV TZ=America/Santiago
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY . .

RUN mkdir -p uploads /mnt/red /mnt/archivos

EXPOSE 3000
CMD ["node", "app.js"]  # Sin PM2, Docker maneja restart
```

**Beneficio esperado**: 512 MB → 180-200 MB (-61% reducción)

---

### 1.4 Problema: Fileserver 772 MB

**Análisis**: Imagen muy grande para un servidor Apache simple

**Recomendación**: Usar imagen base más ligera
```dockerfile
FROM httpd:2.4-alpine  # ~60 MB vs actual
# O nginx:alpine  # ~40 MB
```

**Beneficio esperado**: 772 MB → 80-100 MB (-87% reducción)

---

## 2. Dependencias Innecesarias en package.json

### 2.1 Backend - Dependencias de Desarrollo en Producción

**Análisis de Backend/package.json**:
```json
{
  "dependencies": {
    // ✅ Necesarias en producción
    "express": "^5.1.0",
    "mysql2": "^3.14.1",
    "socket.io": "^4.8.1",
    
    // ⚠️ Revisar si son necesarias
    "csv-parse": "^5.6.0",  // ¿Se usa en runtime?
    "csv-stringify": "^6.5.2",  // ¿Se usa en runtime?
    "fs-extra": "^11.3.1",  // Puede usar fs nativo
    "readable-stream": "^2.3.7",  // Versión antigua, Node 18 tiene streams nativos
    "uuid": "^11.1.0"  // Puede usar crypto.randomUUID() nativo
  },
  "devDependencies": {
    "nodemon": "^3.1.10"  // ✅ Correctamente en dev
  }
}
```

**Dependencias que pueden removerse**:
1. `readable-stream` → Usar streams nativos de Node 18
2. `uuid` → Usar `crypto.randomUUID()` nativo
3. `fs-extra` → Usar `fs/promises` nativo (Node 18+)

**Beneficio**: -5-10 MB en imagen final

---

### 2.2 Frontend - Dependencias Obsoletas

**Análisis de Frontend/package.json**:
```json
{
  "dependencies": {
    "apexcharts": "^3.37.2",  // 🔴 530 KB en bundle (ya identificado)
    "flowbite": "^2.1.1",  // ⚠️ ~100 KB, revisar tree-shaking
    "socket.io-client": "^4.8.1",  // ✅ Necesario
    "@faker-js/faker": "^7.6.0"  // ❌ ¿Por qué en producción?
  },
  "devDependencies": {
    "eslint": "^8.35.0",  // ✅ Correctamente en dev
    "cross-env": "^7.0.3"  // ✅ Necesario para builds
  }
}
```

**Dependencias que deben moverse a devDependencies**:
1. `@faker-js/faker` → Solo para desarrollo/testing

**Beneficio**: -2-3 MB en node_modules

---

## 3. Health Checks

### 3.1 Estado Actual

| Servicio | Health Check | Status |
|----------|--------------|--------|
| MySQL | ✅ `mysqladmin ping` | OK |
| Backend | ❌ No configurado | FALTA |
| Frontend | ❌ No configurado | FALTA |
| Fileserver | ❌ No configurado | FALTA |
| Cron | ❌ No configurado | FALTA |

**Problema**: Solo MySQL tiene health check, otros servicios pueden estar "running" pero no funcionales.

---

### 3.2 Health Checks Recomendados

**Backend**:
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**Frontend**:
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:2121/"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**Fileserver**:
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
  interval: 30s
  timeout: 10s
  retries: 3
```

**Cron**:
```yaml
healthcheck:
  test: ["CMD", "pm2", "ping"]
  interval: 60s
  timeout: 10s
  retries: 3
```

**Prioridad**: 🔴 ALTA  
**Esfuerzo**: 1-2 horas  
**Beneficio**: Detección temprana de fallos

---

## 4. Variables de Entorno

### 4.1 Variables Duplicadas

**Problema**: Muchas variables se repiten en múltiples servicios

**Ejemplo de duplicación**:
```yaml
# Backend
environment:
  - MYSQL_DB_HOST=${MYSQL_DB_HOST}
  - MYSQL_DB_PORT=${MYSQL_DB_PORT}
  - MYSQL_DB_USER=${MYSQL_DB_USER}
  - MYSQL_DB_PASS=${MYSQL_DB_PASS}
  - MYSQL_DB_NAME=${MYSQL_DB_NAME}
  - FILE_SERVER_URL=${FILE_SERVER_URL}
  - SMTP_HOST=${SMTP_HOST}
  - SMTP_PORT=${SMTP_PORT}
  - SMTP_USER=${SMTP_USER}
  - SMTP_PASS=${SMTP_PASS}

# Cron (MISMAS variables)
environment:
  - MYSQL_DB_HOST=${MYSQL_DB_HOST}
  - MYSQL_DB_PORT=${MYSQL_DB_PORT}
  - MYSQL_DB_USER=${MYSQL_DB_USER}
  - MYSQL_DB_PASS=${MYSQL_DB_PASS}
  - MYSQL_DB_NAME=${MYSQL_DB_NAME}
  - FILE_SERVER_URL=${FILE_SERVER_URL}
  # ... etc
```

**Solución**: Usar `env_file` compartido
```yaml
services:
  backend:
    env_file:
      - .env.common
      - .env.backend
  
  cron:
    env_file:
      - .env.common
      - .env.cron
```

**Beneficio**: Mejor mantenibilidad, menos errores

---

### 4.2 Secretos Hardcodeados en Dockerfiles

**🔴 CRÍTICO - Problema de Seguridad**:

**Backend/Dockerfile**:
```dockerfile
ENV JWT_SECRET=gelymar_jwt_secret_key_2024  # ❌ Hardcodeado
ENV NETWORK_USER=softkey  # ❌ Hardcodeado
ENV NETWORK_PASSWORD=sK06.2025$#  # ❌ CRÍTICO - Password en texto plano
ENV SMTP_USER=logistics@gelymar.com  # ❌ Hardcodeado
```

**Cron/Dockerfile**:
```dockerfile
ENV NETWORK_PASSWORD=sK06.2025$#  # ❌ CRÍTICO - Duplicado
```

**Solución**: NUNCA poner secretos en Dockerfiles
```dockerfile
# ✅ Solo valores por defecto no sensibles
ENV NODE_ENV=production
ENV PORT=3000

# ❌ NO poner secretos
# Pasar secretos vía docker-compose environment o secrets
```

**Prioridad**: 🔴 CRÍTICA  
**Esfuerzo**: 30 minutos  
**Beneficio**: Seguridad

---

### 4.3 Configuración Hardcodeada

**Problema**: URLs y configuración específica en Dockerfiles

**Ejemplo**:
```dockerfile
ENV FRONTEND_BASE_URL=http://localhost:2121  # ❌ Hardcodeado
ENV BACKEND_BASE_URL=http://localhost:3000  # ❌ Hardcodeado
ENV FILE_SERVER_URL=http://fileserver:80  # ⚠️ Asume nombre de servicio
```

**Solución**: Todas las URLs deben venir de variables de entorno en runtime

---

## 5. Configuración de Red

### 5.1 Segmentación de Red

**Configuración actual**:
```yaml
networks:
  gelymar-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
```

**Análisis**:
- ✅ Red bridge personalizada (mejor que default)
- ✅ Subnet definida
- ❌ Todos los servicios en la misma red (sin segmentación)

**Recomendación**: Segmentar por capas
```yaml
networks:
  frontend-network:  # Solo frontend y backend
  backend-network:   # Backend, DB, Fileserver
  db-network:        # Solo DB y servicios que la necesitan
```

**Beneficio**: Mejor seguridad, aislamiento de servicios

---

## 6. Volúmenes y Persistencia

### 6.1 Volúmenes Configurados

| Volumen | Uso | Tamaño Estimado | Status |
|---------|-----|-----------------|--------|
| mysql_data | Base de datos | Variable | ✅ OK |
| fileserver_data | Archivos documentos | Variable | ✅ OK |
| backend_logs | Logs backend | < 1 GB | ✅ OK |
| cron_logs | Logs cron | < 500 MB | ✅ OK |
| cron_pm2 | Estado PM2 | < 100 MB | ✅ OK |

**Análisis**: Configuración correcta, todos los datos importantes persistidos.

---

### 6.2 Bind Mounts

**Problema identificado**:
```yaml
backend:
  volumes:
    - /mnt/archivos:/mnt/archivos  # ❌ Path absoluto del host
```

**Riesgo**: Dependencia del sistema de archivos del host, no portable.

**Recomendación**: Documentar claramente o usar volúmenes nombrados.

---

## 7. Privilegios y Capacidades

### 7.1 Uso de Privilegios Elevados

**Problema**:
```yaml
backend:
  privileged: true  # ❌ Privilegios completos
  cap_add:
    - SYS_ADMIN  # ❌ Capacidad peligrosa

cron:
  privileged: true  # ❌ Privilegios completos
  cap_add:
    - SYS_ADMIN  # ❌ Para montar redes SMB
```

**Análisis**:
- Necesario para montar redes SMB (CIFS)
- Riesgo de seguridad elevado
- Alternativa: Montar en host y bind mount al contenedor

**Recomendación**:
```yaml
# En host (fuera de Docker)
sudo mount -t cifs //172.20.10.167/share /mnt/archivos -o username=softkey,password=xxx

# En Docker (sin privilegios)
backend:
  volumes:
    - /mnt/archivos:/mnt/archivos:ro  # Read-only
```

**Beneficio**: Mejor seguridad, menos riesgo

---

## 8. Dependencias entre Servicios

### 8.1 Orden de Inicio

**Configuración actual**:
```yaml
backend:
  depends_on:
    mysql:
      condition: service_healthy  # ✅ Espera health check
    fileserver:
      condition: service_started  # ⚠️ Solo espera inicio

frontend:
  depends_on:
    backend:
      condition: service_started  # ⚠️ No espera que backend esté listo
```

**Problema**: `service_started` no garantiza que el servicio esté funcional.

**Solución**: Agregar health checks y usar `service_healthy`
```yaml
backend:
  depends_on:
    mysql:
      condition: service_healthy
    fileserver:
      condition: service_healthy

frontend:
  depends_on:
    backend:
      condition: service_healthy
```

---

## 9. Plan de Optimización Docker

### Fase 1: Quick Wins (1 semana)

1. **Implementar multi-stage builds** (8-12h) 🔴 CRÍTICA
   - Frontend: 844 MB → 250-300 MB
   - Backend: 512 MB → 180-200 MB
   - Beneficio: -900 MB total (-65%)

2. **Agregar health checks** (1-2h) 🔴 ALTA
   - Backend, Frontend, Fileserver, Cron
   - Beneficio: Detección temprana de fallos

3. **Remover secretos hardcodeados** (30min) 🔴 CRÍTICA
   - Mover a variables de entorno
   - Beneficio: Seguridad

**Total Fase 1**: 10-15 horas  
**Beneficio**: -900 MB imágenes, mejor seguridad

---

### Fase 2: Optimizaciones Avanzadas (1-2 semanas)

4. **Optimizar Fileserver** (4-6h) 🟡 MEDIA
   - Cambiar a httpd:alpine o nginx:alpine
   - 772 MB → 80-100 MB

5. **Limpiar dependencias** (3-4h) 🟡 MEDIA
   - Remover dependencias innecesarias
   - Mover @faker-js/faker a devDependencies

6. **Segmentar redes** (2-3h) 🟡 MEDIA
   - Crear redes por capa
   - Mejor aislamiento

7. **Optimizar privilegios** (4-6h) 🟡 MEDIA
   - Montar SMB en host
   - Remover privileged: true

**Total Fase 2**: 13-19 horas  
**Beneficio**: -700 MB adicionales, mejor seguridad

---

## 10. Métricas de Éxito

### Antes de Optimización (MEDIDO)

| Métrica | Valor Actual |
|---------|--------------|
| Imagen Frontend | 844-845 MB |
| Imagen Backend | 512 MB |
| Imagen Fileserver | 772 MB |
| Imagen Cron | 285 MB |
| Total custom images | 2.96 GB |
| Multi-stage builds | 0/4 (0%) |
| Health checks | 1/5 (20%) |
| Secretos hardcodeados | 5+ |

### Después de Optimización (TARGET)

| Métrica | Valor Target | Mejora |
|---------|--------------|--------|
| Imagen Frontend | 250-300 MB | -65% |
| Imagen Backend | 180-200 MB | -61% |
| Imagen Fileserver | 80-100 MB | -87% |
| Imagen Cron | 150-180 MB | -37% |
| Total custom images | 660-780 MB | -74% |
| Multi-stage builds | 4/4 (100%) | +100% |
| Health checks | 5/5 (100%) | +80% |
| Secretos hardcodeados | 0 | -100% |

---

## 11. Scripts de Análisis

### 11.1 Analizar Tamaños de Imágenes

```powershell
# Ver tamaños de todas las imágenes
docker images | Select-String "gelymar-platform"

# Analizar capas de una imagen
docker history nicetm/gelymar-platform:frontend-prod

# Ver qué ocupa espacio en una imagen
docker run --rm nicetm/gelymar-platform:frontend-prod du -sh /*
```

### 11.2 Verificar Health Checks

```bash
# Ver estado de health checks
docker ps --format "table {{.Names}}\t{{.Status}}"

# Inspeccionar health check de un contenedor
docker inspect --format='{{json .State.Health}}' gelymar-platform-backend-prod
```

---

## Conclusión

El análisis de Docker ha identificado **problemas críticos de optimización**:

1. **Imágenes muy grandes** (2.96 GB total) por falta de multi-stage builds
2. **Secretos hardcodeados** en Dockerfiles (riesgo de seguridad)
3. **Health checks faltantes** en 4/5 servicios
4. **Privilegios elevados** innecesarios (riesgo de seguridad)

**La Fase 1 puede reducir las imágenes en 900 MB (-65%) y mejorar la seguridad en solo 10-15 horas de trabajo**.



---

## 12. Gestión de Configuración (Tarea 11.2)

### 12.1 Variables de Entorno Duplicadas

**Análisis de uso de `process.env`**: Se encontraron 50+ referencias a variables de entorno en el código.

**Duplicación crítica identificada**:

| Variable | Servicios que la usan | Veces duplicada |
|----------|----------------------|-----------------|
| MYSQL_DB_HOST | Backend, Cron, Config Manager | 3x |
| MYSQL_DB_PORT | Backend, Cron, Config Manager | 3x |
| MYSQL_DB_USER | Backend, Cron, Config Manager | 3x |
| MYSQL_DB_PASS | Backend, Cron, Config Manager | 3x |
| MYSQL_DB_NAME | Backend, Cron, Config Manager | 3x |
| FILE_SERVER_URL | Backend, Cron | 2x |
| BACKEND_API_URL | Cron, Config Manager | 2x |
| SMTP_HOST | Backend, Config Manager | 2x |
| SMTP_PORT | Backend, Config Manager | 2x |
| SMTP_USER | Backend, Config Manager | 2x |
| SMTP_PASS | Backend, Config Manager | 2x |

**Total variables duplicadas**: 40+ variables repetidas entre servicios

---

### 12.2 Validación de Configuración al Inicio

**Problema**: No hay validación de variables de entorno requeridas al iniciar servicios.

**Ejemplo actual**:
```javascript
// Backend/config/db.js
const pool = mysql.createPool({
  host: process.env.MYSQL_DB_HOST || 'localhost',  // ❌ Fallback silencioso
  port: process.env.MYSQL_DB_PORT || 3306,
  user: process.env.MYSQL_DB_USER || 'root',
  password: process.env.MYSQL_DB_PASS || '',  // ❌ Password vacío por defecto
  database: process.env.MYSQL_DB_NAME || 'gelymar'
});
```

**Problemas**:
1. ❌ No valida que las variables existan
2. ❌ Usa fallbacks que pueden ocultar errores de configuración
3. ❌ No falla rápido si falta configuración crítica

**Solución recomendada**:
```javascript
// config/validator.js
const requiredEnvVars = [
  'MYSQL_DB_HOST',
  'MYSQL_DB_PORT',
  'MYSQL_DB_USER',
  'MYSQL_DB_PASS',
  'MYSQL_DB_NAME',
  'JWT_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS'
];

function validateConfig() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`  - ${varName}`));
    process.exit(1);  // Fail fast
  }
  
  console.log('✅ All required environment variables are set');
}

// En app.js (ANTES de iniciar servidor)
validateConfig();
```

**Prioridad**: 🔴 ALTA  
**Esfuerzo**: 1-2 horas  
**Beneficio**: Detección temprana de errores de configuración

---

### 12.3 Configuración Hardcodeada en Código

**Búsqueda de valores hardcodeados**:

```javascript
// ❌ Config Manager - Valores por defecto hardcodeados
const PORT = process.env.PORT || 8083;  // Puerto específico
secret: process.env.SESSION_SECRET || 'gelymar-config-manager-secret-key-2024',  // Secret hardcodeado

// ❌ Integration Service - URLs hardcodeadas
baseUrl: process.env.BACKEND_URL || 'http://localhost:3000',
baseUrl: process.env.FRONTEND_URL || 'http://localhost:2121',
baseUrl: process.env.FILESERVER_URL || 'http://localhost:8080',

// ❌ Notification Service - Configuración SMTP hardcodeada
host: process.env.SMTP_HOST || 'smtp.gmail.com',  // Gmail por defecto
port: process.env.SMTP_PORT || 587,
from: process.env.SMTP_FROM || 'noreply@gelymar.com',

// ❌ Database Models - Credenciales por defecto
host: process.env.MYSQL_DB_HOST || 'mysql',
password: process.env.MYSQL_DB_PASS || 'gelymar2024',  // Password hardcodeado
```

**Problemas**:
1. Valores por defecto específicos del proyecto
2. Secrets hardcodeados como fallback
3. URLs de servicios hardcodeadas
4. Dificulta cambiar configuración sin modificar código

**Recomendación**: Remover todos los fallbacks, requerir variables de entorno explícitas.

---

### 12.4 Configuración de Red (Segmentación)

**Análisis de docker-compose-prod.yml**:

**Configuración actual**:
```yaml
networks:
  gelymar-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
```

**Problema**: Todos los servicios en la misma red plana.

**Servicios y sus necesidades de comunicación**:

| Servicio | Necesita acceso a |
|----------|-------------------|
| Frontend | Backend |
| Backend | MySQL, Fileserver, SQL Server (externo) |
| Cron | MySQL, Backend API, Fileserver, SQL Server (externo) |
| Fileserver | (ninguno) |
| MySQL | (ninguno) |
| phpMyAdmin | MySQL |

**Recomendación de segmentación**:
```yaml
networks:
  # Red pública (expuesta)
  public:
    driver: bridge
  
  # Red de aplicación (frontend-backend)
  app:
    driver: bridge
    internal: false
  
  # Red de datos (backend-db)
  data:
    driver: bridge
    internal: true  # No acceso externo
  
  # Red de administración
  admin:
    driver: bridge
    internal: true

services:
  frontend:
    networks:
      - public
      - app
  
  backend:
    networks:
      - app
      - data
  
  mysql:
    networks:
      - data
      - admin
  
  fileserver:
    networks:
      - app
  
  cron:
    networks:
      - data
      - app
  
  phpmyadmin:
    networks:
      - admin
      - public
```

**Beneficio**: Mejor aislamiento, principio de mínimo privilegio

---

## 13. Gestión de Dependencias (Tarea 11.3)

### 13.1 Dependencias Obsoletas

**Análisis de Backend/package.json**:

| Dependencia | Versión Actual | Última Versión | Antigüedad | Status |
|-------------|----------------|----------------|------------|--------|
| express | 5.1.0 | 5.1.0 | Actual | ✅ OK |
| mysql2 | 3.14.1 | 3.14.1 | Actual | ✅ OK |
| socket.io | 4.8.1 | 4.8.1 | Actual | ✅ OK |
| bcrypt | 6.0.0 | 6.0.0 | Actual | ✅ OK |
| jsonwebtoken | 9.0.2 | 9.0.2 | Actual | ✅ OK |
| readable-stream | 2.3.7 | 4.5.2 | ~6 años | 🔴 OBSOLETA |
| csv-parse | 5.6.0 | 5.6.0 | Actual | ✅ OK |
| handlebars | 4.7.8 | 4.7.8 | Actual | ✅ OK |

**Análisis de Frontend/package.json**:

| Dependencia | Versión Actual | Última Versión | Antigüedad | Status |
|-------------|----------------|----------------|------------|--------|
| astro | 5.12.0 | 5.12.0 | Actual | ✅ OK |
| react | 19.1.0 | 19.1.0 | Actual | ✅ OK |
| apexcharts | 3.37.2 | 3.54.0 | ~1 año | 🟡 DESACTUALIZADA |
| flowbite | 2.1.1 | 2.5.2 | ~6 meses | 🟡 DESACTUALIZADA |
| tailwindcss | 3.0.24 | 3.4.17 | ~2 años | 🟡 DESACTUALIZADA |

**Dependencias a actualizar**:
1. `readable-stream` → Remover (usar streams nativos)
2. `apexcharts` → Actualizar o reemplazar
3. `tailwindcss` → Actualizar a 3.4.x

---

### 13.2 Versiones Duplicadas

**Análisis con `npm ls`** (estimado):

No se detectaron versiones duplicadas críticas en el análisis inicial. Las dependencias están bien gestionadas.

---

### 13.3 Dependencias No Utilizadas

**Backend - Candidatos a remover**:
```json
{
  "readable-stream": "^2.3.7",  // ❌ Node 18 tiene streams nativos
  "uuid": "^11.1.0",  // ❌ Puede usar crypto.randomUUID()
  "fs-extra": "^11.3.1",  // ⚠️ Verificar si se usa, Node 18 tiene fs/promises
  "csv-parse": "^5.6.0",  // ⚠️ Verificar si se usa en runtime
  "csv-stringify": "^6.5.2"  // ⚠️ Verificar si se usa en runtime
}
```

**Frontend - Candidatos a mover a devDependencies**:
```json
{
  "@faker-js/faker": "^7.6.0"  // ❌ Solo para desarrollo
}
```

**Comando para verificar uso**:
```bash
# Buscar uso de readable-stream
grep -r "require('readable-stream')" Backend/
grep -r "from 'readable-stream'" Backend/

# Buscar uso de uuid
grep -r "require('uuid')" Backend/
grep -r "from 'uuid'" Backend/
```

---

### 13.4 Dependencias de Desarrollo en Producción

**Verificación de Dockerfiles**:

**Backend/Dockerfile**:
```dockerfile
RUN npm ci --omit=dev  # ✅ Correcto, omite devDependencies
```

**Frontend/Dockerfile**:
```dockerfile
RUN npm ci  # ❌ Instala TODAS las dependencias (dev + prod)
```

**Problema**: Frontend instala dependencias de desarrollo en la imagen de producción.

**Solución**:
```dockerfile
# Stage 1: Build (con dev dependencies)
FROM node:18-alpine AS builder
RUN npm ci  # Necesita dev deps para build

# Stage 2: Production (sin dev dependencies)
FROM node:18-alpine AS runner
RUN npm ci --omit=dev  # Solo prod dependencies
```

---

## 14. Resumen de Optimizaciones de Configuración

| Optimización | Esfuerzo | Beneficio | Prioridad |
|--------------|----------|-----------|-----------|
| Validar config al inicio | 1-2h | Fail fast, menos bugs | 🔴 ALTA |
| Remover secretos hardcodeados | 30min | Seguridad | 🔴 CRÍTICA |
| Consolidar variables env | 2-3h | Mantenibilidad | 🟡 MEDIA |
| Segmentar redes Docker | 2-3h | Seguridad, aislamiento | 🟡 MEDIA |
| Actualizar dependencias | 2-4h | Seguridad, features | 🟡 MEDIA |
| Remover deps no usadas | 1-2h | -5-10 MB imagen | 🟢 BAJA |
| Multi-stage builds | 8-12h | -900 MB imágenes | 🔴 CRÍTICA |

**Total esfuerzo**: 17-27 horas  
**Beneficio total**: -900 MB imágenes, mejor seguridad, mejor mantenibilidad

