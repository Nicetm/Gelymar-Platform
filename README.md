# 🚀 Gelymar Management Platform

Plataforma de gestión integral para Gelymar con arquitectura de microservicios containerizada y configuración centralizada.

## 🏗️ Arquitectura

La plataforma está dividida en 6 capas principales:

1. **Frontend** (Astro) - Puerto 2121
2. **Backend** (Node.js API) - Puerto 3000
3. **File Server** (Apache + FTP) - Puerto 8080
4. **Database** (MySQL + phpMyAdmin) - Puerto 3306/8081
5. **Cron Jobs** (PM2) - Puerto 9615
6. **Monitoring** (Dashboard + Terminal) - Puerto 8082/7681

## ✨ Características Principales

- **🔧 Configuración centralizada**: Variables de entorno unificadas por ambiente
- **🐳 Docker optimizado**: Contenedores con configuración flexible
- **📊 Monitoreo integrado**: Dashboard y terminal web para administración
- **⏰ Cron jobs automatizados**: Sincronización de datos programada
- **🔄 Gestión simplificada**: Scripts automatizados para build, push y deploy

## 📁 Estructura del Proyecto

```
gelymar-management-platform/
├── Frontend/                 # Aplicación Astro
├── Backend/                  # API Node.js
├── Cronjob/                  # Cron jobs con PM2
├── docker/                   # Configuración Docker centralizada
│   ├── .env.local           # Variables desarrollo
│   ├── .env.production      # Variables producción
│   ├── docker-compose.yml   # Desarrollo local (build)
│   ├── docker-compose-hub.yml # Producción (download)
│   ├── build-all-dev.ps1    # Construir desarrollo
│   ├── build-all-prod.ps1   # Construir producción
│   ├── push-all-dev.ps1     # Subir desarrollo
│   ├── push-all-prod.ps1    # Subir producción
│   ├── terminal/            # Terminal web
│   ├── monitoring/          # Dashboard monitoreo
│   ├── fileserver/          # Servidor archivos
│   └── cron/                # Cron jobs
└── Archive/                 # Scripts SQL y documentación
```

## 🚀 Instalación y Uso

### Requisitos
- Docker Desktop
- Docker Compose v2.0+
- 4GB+ RAM disponible
- PowerShell (Windows) o Bash (Linux/macOS)

### 0. Comandos GIT
```bash
git status
git add .
git commit -m "De todo"
git push -u origin dev
```

### 1. Clonar Repositorio
```bash
git clone https://github.com/Ssebv/gelymar-management-platform.git
cd gelymar-management-platform
```

## 🔧 Desarrollo Local

### Construir y Ejecutar
```bash
cd docker

# Construir todas las imágenes
.\build-all-dev.ps1

# Ejecutar contenedores (usar docker-compose en local)
docker-compose --env-file .env.local up -d
```

### URLs de Acceso (Desarrollo)
- **Frontend**: http://localhost:2121
- **Backend API**: http://localhost:3000
- **File Server**: http://localhost:8080
- **phpMyAdmin**: http://localhost:8081
- **Monitoring**: http://localhost:8082
- **Terminal Web**: http://localhost:7681

## 🏭 Producción

### Opción 1: Construir Localmente
```bash
cd docker

# Construir imágenes de producción
.\build-all-prod.ps1

# Ejecutar en servidor (usar docker compose en producción)
docker compose --env-file .env.production up -d
```

### Opción 2: Descargar desde DockerHub
```bash
cd docker

# Ejecutar con imágenes de DockerHub (usar docker compose en producción)
docker compose -f docker-compose-hub.yml --env-file .env.production up -d
```

### URLs de Acceso (Producción)
- **Frontend**: http://172.20.10.151:2121
- **Backend API**: http://172.20.10.151:3000
- **File Server**: http://172.20.10.151:8080
- **phpMyAdmin**: http://172.20.10.151:8081
- **Monitoring**: http://172.20.10.151:8082
- **Terminal Web**: http://172.20.10.151:7681

## 📤 Subir Imágenes a DockerHub

### Desarrollo
```bash
cd docker
.\push-all-dev.ps1
```

### Producción
```bash
cd docker
.\push-all-prod.ps1
```

**Repositorio**: https://hub.docker.com/r/nicetm/gelymar-platform

## 🔄 Gestión de Contenedores

### Ver Estado de Servicios
```bash
# Ver todos los contenedores
docker ps

# Ver solo los de gelymar
docker ps | grep gelymar-platform
```

### Ver Logs
```bash
# Logs de un servicio específico
docker logs gelymar-platform-backend
docker logs gelymar-platform-frontend
docker logs gelymar-platform-cron

# Logs en tiempo real
docker logs -f gelymar-platform-backend

# Logs de todos los servicios
docker-compose logs
```

### Reiniciar Servicios
```bash
# Reiniciar un servicio específico
docker-compose restart backend
docker-compose restart frontend

# Reiniciar todos los servicios
docker-compose restart
```

### Acceder a Contenedores
```bash
# Backend
docker exec -it gelymar-platform-backend bash

# Frontend
docker exec -it gelymar-platform-frontend sh

# Cron
docker exec -it gelymar-platform-cron bash

# MySQL
docker exec -it gelymar-platform-mysql mysql -u root -p

# Fileserver
docker exec -it gelymar-platform-fileserver bash
```

## 🗑️ Limpiar y Actualizar

### Detener y Eliminar Contenedores
```bash
# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v

# Eliminar solo contenedores de gelymar
docker ps -a | grep gelymar-platform | awk '{print $1}' | xargs docker rm -f
```

### Limpiar Imágenes
```bash
# Ver imágenes de gelymar
docker images | grep gelymar-platform

# Eliminar imágenes específicas
docker rmi nicetm/gelymar-platform:backend
docker rmi nicetm/gelymar-platform:frontend

# Eliminar todas las imágenes de gelymar
docker images | grep gelymar-platform | awk '{print $3}' | xargs docker rmi -f

# Limpiar todo lo no usado
docker system prune -a --force
```

### Actualizar Imágenes
```bash
# Actualizar desde DockerHub
docker compose -f docker-compose-hub.yml pull

# Recrear contenedores con nuevas imágenes
docker compose -f docker-compose-hub.yml up -d --force-recreate
```

## ⏰ Cron Jobs

### Ver Estado de Cron Jobs
```bash
# Ver estado de PM2
docker exec gelymar-platform-cron pm2 status

# Ver logs de cron jobs
docker exec gelymar-platform-cron pm2 logs

# Ver logs de un proceso específico
docker exec gelymar-platform-cron pm2 logs gelymar-client-fetcher
```

### Reiniciar Cron Jobs
```bash
# Reiniciar todos los procesos
docker exec gelymar-platform-cron pm2 restart all

# Reiniciar un proceso específico
docker exec gelymar-platform-cron pm2 restart gelymar-client-fetcher
```

### Secuencia de Ejecución

#### Master Cron (7:00 AM diario)
1. **Limpieza de BD** - Limpia base de datos y directorios
2. **Check Clients** - Procesa clientes desde red compartida
3. **Check Client Access** - Crea usuarios de acceso para clientes
4. **Check Items** - Procesa productos
5. **Check Orders** - Procesa órdenes
6. **Check Order Lines** - Procesa líneas de orden
7. **Check Default Files** - Genera documentos PDF por defecto

#### Tareas Independientes
- **Check ETD** - Verifica fechas ETD (8 AM, 12 PM, 4 PM, 8 PM, 1 AM)
- **Send Order Reception** - Envía documentos de recepción (8 AM diario)

## 🛠️ Troubleshooting

### Problemas Comunes

#### 1. Error de Conexión a Base de Datos
```bash
# Verificar que MySQL esté corriendo
docker ps | grep mysql

# Verificar logs de MySQL
docker logs gelymar-platform-mysql

# Reiniciar MySQL
docker-compose restart mysql
```

#### 2. Error de Variables de Entorno
```bash
# Verificar archivo .env
ls -la docker/.env.local
ls -la docker/.env.production

# Verificar variables en contenedor
docker exec gelymar-platform-backend env | grep DB_
```

#### 3. Problemas de Permisos de Archivos
```bash
# Verificar permisos del fileserver
docker exec gelymar-platform-fileserver ls -la /var/www/html/uploads

# Corregir permisos
docker exec gelymar-platform-fileserver chown -R www-data:www-data /var/www/html/uploads
```

#### 4. Cron Jobs No Funcionan
```bash
# Ver estado de PM2
docker exec gelymar-platform-cron pm2 status

# Ver logs de errores
docker exec gelymar-platform-cron pm2 logs --err

# Reiniciar PM2
docker exec gelymar-platform-cron pm2 restart all
```

#### 5. Frontend No Carga
```bash
# Verificar logs del frontend
docker logs gelymar-platform-frontend

# Verificar variables de entorno
docker exec gelymar-platform-frontend env | grep PUBLIC_

# Reconstruir frontend
docker-compose build frontend
docker-compose up -d frontend
```

## 🔧 Comandos Útiles

### Gestión de Volúmenes
```bash
# Ver volúmenes
docker volume ls

# Eliminar volúmenes específicos
docker volume rm gelymar-platform_mysql_data
docker volume rm gelymar-platform_fileserver_data

# Backup de base de datos
docker exec gelymar-platform-mysql mysqldump -u root -proot123456 gelymar > backup.sql
```

### Monitoreo de Recursos
```bash
# Ver uso de recursos
docker stats

# Ver uso de disco
docker system df

# Ver información de red
docker network ls
docker network inspect gelymar-platform_gelymar-network
```

### Logs y Debugging
```bash
# Ver logs de todos los servicios
docker-compose logs --tail=100

# Ver logs de errores
docker-compose logs --tail=100 | grep -i error

# Ver logs de un servicio específico con timestamps
docker-compose logs -f -t backend
```

## 🛠️ Guía de Comandos Docker

### Cuándo Usar Cada Comando

#### **🔄 Reiniciar Servicios**
```bash
# Reiniciar un servicio específico (cambios en código sin rebuild)
docker-compose --env-file .env.local restart backend
docker-compose --env-file .env.local restart frontend
docker-compose --env-file .env.local restart fileserver

# Reiniciar todos los servicios
docker-compose --env-file .env.local restart
```
**Usar cuando:** Cambios en variables de entorno, configuración, o código que no requiere rebuild

#### **🏗️ Build y Rebuild**
```bash
# Build de un servicio específico (cambios en Dockerfile o código)
docker-compose --env-file .env.local build backend
docker-compose --env-file .env.local build frontend

# Build sin cache (forzar reconstrucción completa)
docker-compose --env-file .env.local build --no-cache backend

# Build y up en un comando
docker-compose --env-file .env.local up -d --build backend

# Reconstruir frontend después de cambios en Dockerfile
docker-compose --env-file .env.local build frontend
docker-compose --env-file .env.local up -d frontend

# Reconstruir frontend sin cache (forzar reconstrucción completa)
docker-compose --env-file .env.local build --no-cache frontend
docker-compose --env-file .env.local up -d frontend
```
**Usar cuando:**
- Cambios en `Dockerfile`
- Cambios en código fuente
- Cambios en dependencias (`package.json`)
- Problemas de cache
- **Cambios en variables de entorno del Dockerfile (como SERVER_API_URL)**

#### **🚀 Levantar y Bajar Servicios**
```bash
# Levanta todo y construye
docker-compose -f docker-compose-dev.yml --env-file .env.local up -d --build

# Levantar todos los servicios
docker-compose --env-file .env.local up -d

# Levantar un servicio específico
docker-compose --env-file .env.local up -d backend

# Parar todos los servicios
docker-compose --env-file .env.local down

# Parar y eliminar volúmenes (¡CUIDADO! Elimina datos)
docker-compose --env-file .env.local down -v

# Limpiar contenedores huérfanos (solo cuando aparezca mensaje de "orphan containers")
docker-compose --env-file .env.local up -d backend frontend --remove-orphans

# Parar y limpiar contenedores huérfanos (¡CUIDADO! Elimina TODOS los contenedores)
docker-compose --env-file .env.local down --remove-orphans
```

#### **🧹 Limpieza de Imágenes**
```bash
# Ver imágenes del proyecto
docker images | grep gelymar-platform

# Eliminar imágenes no utilizadas
docker image prune

# Eliminar todas las imágenes no utilizadas (incluyendo las referenciadas)
docker image prune -a

# Eliminar imagen específica
docker rmi nicetm/gelymar-platform:backend-dev
```

#### **📊 Monitoreo y Estado**
```bash
# Ver estado de contenedores
docker-compose --env-file .env.local ps

# Ver uso de recursos
docker stats

# Ver logs en tiempo real
docker-compose --env-file .env.local logs -f backend
```

### 🔧 Comandos por Escenario

#### **Desarrollo Diario**
```bash
# Cambios en código backend/frontend
docker-compose --env-file .env.local restart backend

# Cambios en configuración de servicios
docker-compose --env-file .env.local restart

# Cambios en Dockerfile
docker-compose --env-file .env.local build --no-cache backend
docker-compose --env-file .env.local up -d backend
```

#### **Problemas de Cache**
```bash
# Si hay problemas de cache o builds fallidos
docker-compose --env-file .env.local build --no-cache backend
docker-compose --env-file .env.local up -d backend
```

#### **Limpieza Completa**
```bash
# Parar todo
docker-compose --env-file .env.local down

# Limpiar imágenes
docker image prune -a

# Reconstruir todo
docker-compose --env-file .env.local build --no-cache
docker-compose --env-file .env.local up -d
```

#### **🔄 Actualización Completa en Producción**
```bash
# 1. Detener y eliminar contenedores existentes
docker compose -f docker-compose-hub.yml down

# 2. Eliminar todas las imágenes de gelymar-platform
docker rmi $(docker images "nicetm/gelymar-platform*" -q)

# 3. Limpiar imágenes huérfanas
docker image prune -f

# 4. Descargar las nuevas imágenes desde DockerHub
docker compose -f docker-compose-hub.yml pull

# 5. Levantar con las nuevas imágenes
docker compose -f docker-compose-hub.yml --env-file .env.production up -d

# 6. Verificar que todo esté funcionando
docker compose -f docker-compose-hub.yml ps
docker compose -f docker-compose-hub.yml logs
```

#### **🚀 Comando Todo-en-Uno para Producción**
```bash
# Ejecutar todo el proceso de actualización en una sola línea
docker compose -f docker-compose-hub.yml down && \
docker rmi $(docker images "nicetm/gelymar-platform*" -q) && \
docker image prune -f && \
docker compose -f docker-compose-hub.yml pull && \
docker compose -f docker-compose-hub.yml --env-file .env.production up -d
```

#### **Debugging**
```bash
# Ver logs de error
docker-compose --env-file .env.local logs backend | grep -i error

# Acceder al contenedor
docker-compose --env-file .env.local exec backend bash

# Ver variables de entorno
docker-compose --env-file .env.local exec backend env
```

## 🆘 Soporte

### Información del Sistema
- **Versión**: 2.20
- **Arquitectura**: Microservicios con Docker
- **Base de datos**: MySQL 8.0
- **Frontend**: Astro + Tailwind CSS
- **Backend**: Node.js + Express

### Contacto
Para problemas técnicos, revisar:
1. Logs del servicio afectado
2. Variables de entorno configuradas
3. Conectividad de red entre servicios
4. Estado de contenedores y volúmenes

---

**Gelymar Management Platform** - Sistema de gestión integral containerizado

**Desarrollado por Softkey** - Plataforma de gestión Gelymar v2.20
