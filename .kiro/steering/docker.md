---
inclusion: always
---

# Docker y Deployment

## Arquitectura de Contenedores

La plataforma usa Docker Compose con 6 servicios principales:

```
┌─────────────┐
│  Frontend   │ :2121 (admin), :2122 (client), :2123 (seller)
└──────┬──────┘
       │
┌──────▼──────┐
│   Backend   │ :3000
└──────┬──────┘
       │
┌──────▼──────┬──────────────┬──────────────┐
│    MySQL    │  FileServer  │  Cron Jobs   │
│    :3306    │    :8080     │    :9615     │
└─────────────┴──────────────┴──────────────┘
```

## Servicios Docker

### 1. MySQL (mysql:8.0)
```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: gelymar-platform-mysql
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_DB_PASS}
      - MYSQL_DATABASE=${MYSQL_DB_NAME}
      - MYSQL_USER=${MYSQL_DB_USER}
      - MYSQL_PASSWORD=${MYSQL_DB_PASS}
      - TZ=America/Santiago
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - gelymar-network
```

### 2. Backend (Node.js)
```yaml
services:
  backend:
    build:
      context: ../Backend
      dockerfile: Dockerfile
    image: nicetm/gelymar-platform:backend-prod
    container_name: gelymar-platform-backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DOCKER_ENV=true
      # ... todas las variables de entorno
    depends_on:
      - mysql
    networks:
      - gelymar-network
```

### 3. Frontend (Astro/Node.js)
```yaml
services:
  frontend-admin:
    build:
      context: ../Frontend
      dockerfile: Dockerfile
      args:
        - APP_CONTEXT=admin
    image: nicetm/gelymar-platform:frontend-admin-prod
    ports:
      - "2121:2121"
    environment:
      - APP_CONTEXT=admin
      - PUBLIC_API_URL=http://172.20.10.151:3000
    depends_on:
      - backend
    networks:
      - gelymar-network
```

### 4. FileServer (Apache + FTP)
```yaml
services:
  fileserver:
    build:
      context: ./fileserver
      dockerfile: Dockerfile
    image: nicetm/gelymar-platform:fileserver-prod
    ports:
      - "8080:80"           # HTTP
      - "21:21"             # FTP
      - "30000-30009:30000-30009"  # FTP pasivo
    volumes:
      - fileserver_data:/var/www/html
    networks:
      - gelymar-network
```

### 5. Cron Jobs (PM2)
```yaml
services:
  cron:
    build:
      context: ../Cronjob
      dockerfile: Dockerfile
    image: nicetm/gelymar-platform:cron-prod
    ports:
      - "9615:9615"  # PM2 web interface
    environment:
      - BACKEND_API_URL=http://backend:3000
      - DOCKER_ENV=true
    depends_on:
      - backend
    networks:
      - gelymar-network
```

### 6. Monitoring (Dashboard + Terminal)
```yaml
services:
  monitoring:
    build:
      context: ./monitoring
      dockerfile: Dockerfile
    ports:
      - "8082:80"  # Dashboard
    networks:
      - gelymar-network
  
  terminal:
    image: tsl0922/ttyd
    ports:
      - "7681:7681"
    command: -W bash
    networks:
      - gelymar-network
```

## Archivos de Configuración

### docker-compose.yml (Desarrollo - Build Local)
```yaml
name: gelymar-platform-dev

services:
  mysql: ...
  backend:
    build:
      context: ../Backend
      dockerfile: Dockerfile
    # Sin image, se construye localmente
  # ... otros servicios
```

### docker-compose-hub.yml (Producción - Pull desde DockerHub)
```yaml
name: gelymar-platform-prod

services:
  mysql: ...
  backend:
    image: nicetm/gelymar-platform:backend-prod
    # No build, pull desde DockerHub
  # ... otros servicios
```

## Variables de Entorno

### .env.local (Desarrollo)
```bash
# Base de datos
MYSQL_DB_HOST=mysql
MYSQL_DB_USER=gelymar
MYSQL_DB_PASS=root123456
MYSQL_DB_NAME=gelymar

# URLs
FRONTEND_BASE_URL=http://localhost:2121
PUBLIC_API_URL=http://localhost:3000
FILE_SERVER_URL=http://fileserver:80

# Entorno
NODE_ENV=development
DOCKER_ENV=true
```

### .env.production (Producción)
```bash
# Base de datos
MYSQL_DB_HOST=mysql
MYSQL_DB_USER=gelymar
MYSQL_DB_PASS=root123456
MYSQL_DB_NAME=gelymar

# URLs
FRONTEND_BASE_URL=http://172.20.10.151:2121
PUBLIC_API_URL=http://172.20.10.151:3000
PUBLIC_CLIENT_FRONTEND_BASE_URL=https://logistic.gelymar.cl
FILE_SERVER_URL=http://fileserver:80

# Entorno
NODE_ENV=production
DOCKER_ENV=true
HOST_IP=172.20.10.151
```

## Scripts de Build

### build-all-dev.ps1
```powershell
# Construir todas las imágenes de desarrollo
docker build -t nicetm/gelymar-platform:backend-dev ../Backend
docker build -t nicetm/gelymar-platform:frontend-admin-dev --build-arg APP_CONTEXT=admin ../Frontend
docker build -t nicetm/gelymar-platform:frontend-client-dev --build-arg APP_CONTEXT=client ../Frontend
docker build -t nicetm/gelymar-platform:frontend-seller-dev --build-arg APP_CONTEXT=seller ../Frontend
docker build -t nicetm/gelymar-platform:cron-dev ../Cronjob
docker build -t nicetm/gelymar-platform:fileserver-dev ./fileserver
```

### build-all-prod.ps1
```powershell
# Construir todas las imágenes de producción
docker build -t nicetm/gelymar-platform:backend-prod ../Backend
docker build -t nicetm/gelymar-platform:frontend-admin-prod --build-arg APP_CONTEXT=admin ../Frontend
docker build -t nicetm/gelymar-platform:frontend-client-prod --build-arg APP_CONTEXT=client ../Frontend
docker build -t nicetm/gelymar-platform:frontend-seller-prod --build-arg APP_CONTEXT=seller ../Frontend
docker build -t nicetm/gelymar-platform:cron-prod ../Cronjob
docker build -t nicetm/gelymar-platform:fileserver-prod ./fileserver
```

### push-all-prod.ps1
```powershell
# Subir todas las imágenes a DockerHub
docker push nicetm/gelymar-platform:backend-prod
docker push nicetm/gelymar-platform:frontend-admin-prod
docker push nicetm/gelymar-platform:frontend-client-prod
docker push nicetm/gelymar-platform:frontend-seller-prod
docker push nicetm/gelymar-platform:cron-prod
docker push nicetm/gelymar-platform:fileserver-prod
```

## Comandos Docker

### Desarrollo
```bash
cd docker

# Construir imágenes
.\build-all-dev.ps1

# Iniciar servicios
docker-compose --env-file .env.local up -d

# Ver logs
docker-compose logs -f backend

# Detener servicios
docker-compose down
```

### Producción (Build Local)
```bash
cd docker

# Construir imágenes
.\build-all-prod.ps1

# Iniciar servicios
docker compose --env-file .env.production up -d

# Ver logs
docker compose logs -f backend
```

### Producción (DockerHub)
```bash
cd docker

# Descargar imágenes
docker compose -f docker-compose-hub.yml pull

# Iniciar servicios
docker compose -f docker-compose-hub.yml --env-file .env.production up -d
```

### Mantenimiento
```bash
# Reiniciar servicio específico
docker-compose restart backend

# Ver logs en tiempo real
docker-compose logs -f backend

# Acceder a contenedor
docker exec -it gelymar-platform-backend bash

# Ver estado de servicios
docker-compose ps

# Limpiar volúmenes (CUIDADO: borra datos)
docker-compose down -v
```

## Volúmenes

### Persistentes
```yaml
volumes:
  mysql_data:           # Datos de MySQL
  fileserver_data:      # Archivos de documentos
```

### Compartidos
- Backend y FileServer comparten volumen para uploads
- Logs se persisten en volúmenes Docker

## Redes

```yaml
networks:
  gelymar-network:
    driver: bridge
```

Todos los servicios están en la misma red para comunicación interna.

## Healthchecks

### MySQL
```yaml
healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
  interval: 10s
  retries: 5
```

### Backend
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Dockerfile Patterns

### Multi-stage Build (Backend)
```dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Stage 3: Production
FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app .
EXPOSE 3000
CMD ["node", "app.js"]
```

## Troubleshooting

### Backend no conecta a MySQL
```bash
# Verificar que MySQL esté corriendo
docker-compose ps mysql

# Ver logs de MySQL
docker-compose logs mysql

# Verificar variables de entorno
docker exec gelymar-platform-backend env | grep MYSQL
```

### Frontend no conecta a Backend
```bash
# Verificar que Backend esté corriendo
docker-compose ps backend

# Verificar URL en frontend
docker exec gelymar-platform-frontend-admin env | grep API_URL

# Probar conexión desde frontend
docker exec gelymar-platform-frontend-admin curl http://backend:3000/health
```

### Cron jobs no ejecutan
```bash
# Ver logs de cron
docker-compose logs cron

# Verificar PM2
docker exec gelymar-platform-cron pm2 list

# Ver logs de PM2
docker exec gelymar-platform-cron pm2 logs
```

## Backup y Restore

### Backup de MySQL
```bash
# Backup manual
docker exec gelymar-platform-mysql mysqldump -u gelymar -proot123456 gelymar > backup.sql

# Backup automático (cron job)
# Se ejecuta automáticamente según configuración
```

### Restore de MySQL
```bash
# Restore desde archivo
docker exec -i gelymar-platform-mysql mysql -u gelymar -proot123456 gelymar < backup.sql
```

## Monitoreo

### Dashboard
Acceso: http://localhost:8082
- Estado de servicios
- Métricas de uso
- Logs en tiempo real

### Terminal Web
Acceso: http://localhost:7681
- Acceso bash al servidor
- Ejecución de comandos
- Debugging en tiempo real

### PM2 Web Interface
Acceso: http://localhost:9615
- Estado de cron jobs
- Logs de PM2
- Métricas de procesos
