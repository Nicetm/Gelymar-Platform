# 🐳 Docker Setup - Gelymar Platform

Esta carpeta contiene toda la configuración de Docker para la plataforma Gelymar con arquitectura de microservicios.

## 🏗️ Arquitectura de Contenedores

### 6 Capas Principales:

1. **Capa Base de Datos** (MySQL + phpMyAdmin)
   - Puerto: 3306 (MySQL), 8081 (phpMyAdmin)
   - Contenedor: `gelymar-platform-mysql`, `gelymar-platform-phpmyadmin`

2. **Capa File Server** (Apache + FTP)
   - Puerto: 8080 (HTTP), 21 (FTP), 30000-30009 (FTP pasivo)
   - Contenedor: `gelymar-platform-fileserver`
   - Usuario FTP: `ftpuser` / `gelymar123`

3. **Capa Backend** (Node.js API)
   - Puerto: 3000
   - Contenedor: `gelymar-platform-backend`

4. **Capa Frontend** (Astro)
   - Puerto: 2121
   - Contenedor: `gelymar-platform-frontend`

5. **Capa Cron** (PM2 + Cron Jobs)
   - Puerto: 9615 (PM2 web interface)
   - Contenedor: `gelymar-platform-cron`

6. **Capa Monitoring** (Dashboard + Terminal)
   - Puerto: 8082 (Dashboard), 7681 (Terminal)
   - Contenedor: `gelymar-platform-monitoring`, `gelymar-platform-terminal`

## 📁 Estructura de Archivos

```
docker/
├── docker-compose.yml          # Configuración principal (build local)
├── docker-compose-hub.yml      # Configuración para Docker Hub
├── fileserver/                 # Configuración File Server
│   ├── Dockerfile
│   ├── httpd.conf
│   ├── vsftpd.conf
│   └── docker-entrypoint-fileserver.sh
├── cron/                       # Configuración Cron
│   ├── Dockerfile
│   └── docker-entrypoint-cron.sh
├── monitoring/                 # Dashboard de monitoreo
│   ├── Dockerfile
│   ├── index.html
│   └── dashboard.js
├── terminal/                   # Terminal web
│   ├── Dockerfile
│   └── terminal-manager.sh
├── mysql/
│   └── init/
│       └── 01-init.sql        # Script de inicialización
└── README.md                   # Esta documentación
```

## 🚀 Uso

### Desarrollo Local (Build):
```bash
cd docker
docker-compose up -d
```

### Producción (Docker Hub):
```bash
cd docker

# Descargar imágenes de Docker Hub
docker pull nicetm/gelymar-platform:mysql
docker pull nicetm/gelymar-platform:fileserver
docker pull nicetm/gelymar-platform:backend
docker pull nicetm/gelymar-platform:frontend
docker pull nicetm/gelymar-platform:cron
docker pull nicetm/gelymar-platform:monitoring
docker pull nicetm/gelymar-platform:terminal

# Levantar servicios
docker-compose -f docker-compose-hub.yml up -d
```

### Ver logs de un servicio específico:
```bash
docker-compose logs -f backend
docker-compose logs -f cron
docker-compose logs -f fileserver
```

### Acceder a contenedores:
```bash
# Backend
docker exec -it gelymar-platform-backend bash

# Cron
docker exec -it gelymar-platform-cron bash

# File Server
docker exec -it gelymar-platform-fileserver bash
```

## 🌐 URLs de Acceso

- **Frontend**: http://localhost:2121
- **Backend API**: http://localhost:3000
- **File Server HTTP**: http://localhost:8080
- **File Server FTP**: ftp://localhost:21 (usuario: ftpuser, pass: gelymar123)
- **phpMyAdmin**: http://localhost:8081
- **PM2 Web Interface**: http://localhost:9615
- **Monitoring Dashboard**: http://localhost:8082 (admin/gelymar2024)
- **Web Terminal**: http://localhost:7681 (admin/gelymar2024)
- **MySQL**: localhost:3306

## 📋 Credenciales

- **MySQL Root:** root / root123456
- **MySQL App:** gelymar_user / gelymar123456
- **phpMyAdmin:** root / root123456
- **FTP File Server:** ftpuser / gelymar123
- **Monitoring Dashboard:** admin / gelymar2024
- **Web Terminal:** admin / gelymar2024

## 💾 Volúmenes

- `mysql_data`: Base de datos MySQL
- `fileserver_data`: Archivos del file server (compartido entre fileserver y cron)
- `backend_logs`: Logs del backend
- `cron_logs`: Logs de los cron jobs
- `cron_pm2`: Configuración de PM2

## 🔧 Variables de Entorno

### Backend (.env):
```env
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASS=root123456
DB_NAME=gelymar
PORT=3000
JWT_SECRET=gelymar_jwt_secret_key_2024
FRONTEND_BASE_URL=http://localhost:2121
FILE_SERVER_URL=http://fileserver:80
FILE_SERVER_ROOT=/var/www/html
```

### Frontend (.env):
```env
PUBLIC_API_URL=http://localhost:3000
PUBLIC_FILE_SERVER_URL=http://localhost:8080
PUBLIC_LANG=en
SITE=http://localhost:2121
```

## ⏰ Cron Jobs

Los cron jobs se ejecutan en el contenedor separado y mantienen la misma configuración de PM2:

### Orden de ejecución:
1. **gelymar-clean-db** - Limpia base de datos y directorios
2. **gelymar-client-fetcher** - Procesa archivos de clientes
3. **gelymar-item-fetcher** - Procesa archivos de productos
4. **gelymar-order-fetcher** - Procesa archivos de órdenes
5. **gelymar-orderline-fetcher** - Procesa líneas de órdenes
6. **gelymar-defaultfiles-generator** - Genera archivos por defecto
7. **gelymar-etd-checker** - Verifica ETD

### Gestionar cron jobs:
```bash
# Ver estado de PM2
docker exec -it gelymar-platform-cron pm2 status

# Ver logs de un cron específico
docker exec -it gelymar-platform-cron pm2 logs gelymar-defaultfiles-generator

# Reiniciar un cron
docker exec -it gelymar-platform-cron pm2 restart gelymar-defaultfiles-generator

# Ejecutar manualmente
docker exec -it gelymar-platform-cron pm2 start ecosystem.config.js --only gelymar-defaultfiles-generator
```

## 🔒 Seguridad

### Headers de Seguridad

Apache incluye headers de seguridad modernos:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

### SSL/TLS

Configuración SSL moderna con:

- TLS 1.2 y 1.3 habilitados
- Cipher suites seguros
- HSTS habilitado
- Redirección automática HTTP → HTTPS

## 🐛 Troubleshooting

### Problemas Comunes

1. **Puerto 3306 ocupado**:
   ```bash
   # Cambiar puerto en docker-compose.yml
   ports:
     - "3307:3306"  # Usar puerto 3307 en lugar de 3306
   ```

2. **File server no funciona**:
   ```bash
   docker exec -it gelymar-platform-fileserver ls -la /var/www/html/uploads
   ```

3. **Cron no se ejecutan**:
   ```bash
   docker exec -it gelymar-platform-cron pm2 status
   docker exec -it gelymar-platform-cron pm2 logs
   ```

4. **Problemas de red**:
   ```bash
   docker network ls
   docker network inspect docker_gelymar-network
   ```

5. **MySQL no inicia**:
   ```bash
   docker-compose logs mysql
   docker-compose restart mysql
   ```

### Comandos Útiles

```bash
# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (¡CUIDADO! Elimina datos)
docker-compose down -v

# Reconstruir imágenes
docker-compose build --no-cache

# Ver logs de un servicio específico
docker-compose logs apache
docker-compose logs mysql
docker-compose logs backend

# Acceder al contenedor MySQL
docker-compose exec mysql mysql -u root -p

# Acceder al contenedor Apache
docker-compose exec apache bash
```

## 📊 Monitoreo

### Health Checks

MySQL incluye health check automático que verifica que el servicio esté funcionando correctamente.

### Logs

Los logs se almacenan en:
- **Apache**: `apache/logs/`
- **MySQL**: `docker-compose logs mysql`
- **Backend**: `backend_logs` volumen
- **Cron**: `cron_logs` volumen

## 🔄 Actualizaciones

Para actualizar las imágenes:

```bash
# Actualizar imágenes
docker-compose pull

# Recrear contenedores
docker-compose up -d --force-recreate
```

## 🚀 Guía de Despliegue y Actualización

### Instalación Inicial

Para instalar la plataforma completa en un nuevo servidor:

```bash
# 1. Crear directorio del proyecto
mkdir gelymar-platform
cd gelymar-platform

# 2. Descargar el archivo docker-compose-hub.yml
# (Copiar el archivo docker-compose-hub.yml de este repositorio)

# 3. Descargar todas las imágenes de Docker Hub
docker-compose -f docker-compose-hub.yml pull

# 4. Iniciar todo el stack
docker-compose -f docker-compose-hub.yml up -d

# 5. Verificar que todo esté corriendo
docker-compose -f docker-compose-hub.yml ps
```

### URLs de Acceso

- **Frontend:** http://localhost:2121
- **Backend API:** http://localhost:3000
- **phpMyAdmin:** http://localhost:8081
- **File Server:** http://localhost:8080
- **Monitoring:** http://localhost:8082
- **Terminal:** http://localhost:7681

### Actualización de Contenedores

Cuando el desarrollador principal hace cambios y los sube a Docker Hub:

#### Para el desarrollador principal (subir cambios):

```bash
# 1. Hacer cambios en el código
# 2. Recrear el contenedor con los cambios
cd docker
docker-compose up -d --build NOMBRE_DEL_SERVICIO

# Ejemplos:
docker-compose up -d --build backend
docker-compose up -d --build frontend
docker-compose up -d --build cron

# 3. Crear la nueva imagen
docker commit gelymar-platform-backend nicetm/gelymar-platform:backend
docker commit gelymar-platform-frontend nicetm/gelymar-platform:frontend
docker commit gelymar-platform-cron nicetm/gelymar-platform:cron

# 4. Subir a Docker Hub
docker push nicetm/gelymar-platform:backend
docker push nicetm/gelymar-platform:frontend
docker push nicetm/gelymar-platform:cron
```

#### Para otros desarrolladores (descargar cambios):

```bash
# 1. Ir al directorio del proyecto
cd gelymar-platform

# 2. Descargar todas las imágenes actualizadas
docker-compose -f docker-compose-hub.yml pull

# 3. Reiniciar todo con las nuevas versiones
docker-compose -f docker-compose-hub.yml up -d

# 4. Verificar que todo esté corriendo
docker-compose -f docker-compose-hub.yml ps
```

#### Actualizar solo un servicio específico:

```bash
# Solo actualizar el backend
docker pull nicetm/gelymar-platform:backend
docker-compose -f docker-compose-hub.yml up -d backend

# Solo actualizar el frontend
docker pull nicetm/gelymar-platform:frontend
docker-compose -f docker-compose-hub.yml up -d frontend
```

### Flujo de Desarrollo

1. **Desarrollador principal hace cambios**
2. **Recrea contenedores:** `docker-compose up -d --build servicio`
3. **Crea nuevas imágenes:** `docker commit contenedor nicetm/gelymar-platform:tag`
4. **Sube a Docker Hub:** `docker push nicetm/gelymar-platform:tag`
5. **Otros desarrolladores descargan:** `docker-compose pull`
6. **Reinician servicios:** `docker-compose up -d`

### Repositorio Docker Hub

Todas las imágenes están disponibles en: `nicetm/gelymar-platform`

**Tags disponibles:**
- `nicetm/gelymar-platform:terminal`
- `nicetm/gelymar-platform:monitoring`
- `nicetm/gelymar-platform:cron`
- `nicetm/gelymar-platform:frontend`
- `nicetm/gelymar-platform:backend`
- `nicetm/gelymar-platform:fileserver`
- `nicetm/gelymar-platform:phpmyadmin`
- `nicetm/gelymar-platform:mysql`

## 📦 Exportar/Importar

### Exportar stack completo:
```bash
docker save gelymar-platform-backend:latest gelymar-platform-frontend:latest gelymar-platform-fileserver:latest gelymar-platform-cron:latest gelymar-platform-terminal:latest gelymar-platform-monitoring:latest mysql:8.0 > gelymar-platform-complete.tar
```

### Importar stack:
```bash
docker load < gelymar-platform-complete.tar
```

## 📝 Notas Adicionales

- Los datos de MySQL se persisten en un volumen Docker
- El file server comparte volumen con el cron para acceso a archivos
- PM2 está configurado para gestión de procesos en el contenedor cron
- El monitoring dashboard permite acceso a logs y terminal web
- SSL está configurado pero requiere certificados para funcionar

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs: `docker-compose logs`
2. Verifica la conectividad de red
3. Asegúrate de que los puertos no estén ocupados
4. Revisa los permisos de archivos
5. Verifica las variables de entorno 