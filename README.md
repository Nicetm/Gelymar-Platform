
# 🚀 Gelymar Management Platform

Plataforma de gestión integral para Gelymar con arquitectura de microservicios containerizada y detección automática de entorno.

## 🏗️ Arquitectura

La plataforma está dividida en 6 capas principales:

1. **Frontend** (Astro) - Puerto 2121 - Detección automática de entorno
2. **Backend** (Node.js API) - Puerto 3000 - Detección automática de entorno
3. **File Server** (Apache + FTP) - Puerto 8080
4. **Database** (MySQL + phpMyAdmin) - Puerto 3306/8081
5. **Cron Jobs** (PM2) - Puerto 9615 - Variables dinámicas
6. **Monitoring** (Dashboard + Terminal) - Puerto 8082/7681

## ✨ Características Principales

- **🔍 Detección automática de entorno**: Backend y Frontend detectan automáticamente si corren en local o servidor
- **🔧 Variables dinámicas**: Configuración automática según la IP del servidor
- **🐳 Docker optimizado**: Contenedores con variables de entorno flexibles
- **📊 Monitoreo integrado**: Dashboard y terminal web para administración
- **⏰ Cron jobs automatizados**: Sincronización de datos programada

## 🔧 Variables de Entorno

### Detección Automática
El sistema detecta automáticamente el entorno según la IP:
- **IP 172.20.10.151** → Carga configuración de servidor
- **Cualquier otra IP** → Carga configuración local

### Archivos de Configuración
```
Backend/env.local       # Configuración local (localhost)
Backend/env.server      # Configuración servidor (172.20.10.151)
Frontend/env.local      # Variables Frontend local
Frontend/env.server     # Variables Frontend servidor
docker/env.local        # Variables Docker local
docker/env.server       # Variables Docker servidor
```

### Logs de Detección
```bash
🔧 [Backend] Entorno detectado: Desarrollo local
🔧 [Frontend] Entorno detectado: Servidor Ubuntu (172.20.10.151)
```

## ⏰ Cron Jobs

### Secuencia de Ejecución (Diaria)
1. **5:00 AM** - `checkClients` - Procesa clientes desde red compartida
2. **5:30 AM** - `checkItems` - Procesa productos 
3. **6:00 AM** - `checkOrders` - Procesa órdenes
4. **6:30 AM** - `checkOrderLines` - Procesa líneas de orden
5. **6:45 AM** - `checkDefaultFiles` - Genera documentos PDF
6. **7:00 AM** - `checkETD` - Actualiza fechas ETD

### Gestión de Cron Jobs
```bash
# Ver estado
docker exec gelymar-platform-cron pm2 status

# Ver logs
docker exec gelymar-platform-cron pm2 logs

# Reiniciar un cron
docker exec gelymar-platform-cron pm2 restart gelymar-client-fetcher
```

## 🐳 Instalación con Docker (Recomendado)

### Requisitos
- Docker Desktop
- Docker Compose v2.0+
- 4GB+ RAM disponible

### Instalación Rápida

```bash
# Clonar repositorio
git clone https://github.com/Ssebv/gelymar-management-platform.git
cd gelymar-management-platform
```

### Desarrollo Local (Docker Desktop)

#### Linux/macOS (Bash):
```bash
cd docker
cp env.local .env
docker-compose -f docker-compose-dev.yml up -d
```

#### Windows (PowerShell):
```powershell
cd docker
Copy-Item env.local .env
docker-compose -f docker-compose-dev.yml up -d
```

### Servidor Ubuntu (172.20.10.151)  
```bash
cd docker
cp env.server .env
docker-compose -f docker-compose-prod.yml up -d
```

### Docker Hub (Producción)
```bash
cd docker
docker-compose -f docker-compose-hub.yml up -d
```

### Solo Backend/Frontend (Desarrollo)

#### Linux/macOS:
```bash
# Contenedores (sin Frontend)
cd docker && cp env.local .env
docker-compose -f docker-compose-dev.yml up mysql fileserver backend cron

# Frontend local (otra terminal)
cd Frontend && npm run dev
```

#### Windows (PowerShell):
```powershell
# Contenedores (sin Frontend)
cd docker
Copy-Item env.local .env
docker-compose -f docker-compose-dev.yml up mysql fileserver backend cron

# Frontend local (otra terminal)
cd Frontend
npm run dev
```

### URLs de Acceso
- **Frontend**: http://localhost:2121
- **Backend API**: http://localhost:3000
- **File Server**: http://localhost:8080
- **phpMyAdmin**: http://localhost:8081
- **Monitoring**: http://localhost:8082 (admin/gelymar2024)
- **Terminal Web**: http://localhost:7681 (admin/gelymar2024)

## 🔧 Configuración Manual (Sin Docker)

### Frontend (Astro)

```bash
cd Frontend
npm install
```

Crear `.env`:
```env
PUBLIC_LANG=en
PUBLIC_API_URL=http://localhost:3000
PUBLIC_FILE_SERVER_URL=http://localhost:8080
PUBLIC_API_BASE_URL=http://localhost:3000/api
PUBLIC_FRONTEND_BASE_URL=http://localhost:2121
SITE=http://localhost:2121
BASE_URL=/
REMOTE_ASSETS_BASE_URL=/assets
```

### Backend (Node.js)

```bash
cd Backend
npm install
```

Crear `.env`:
```env
# Base de datos
DB_PORT=3306
DB_USER=root
DB_PASS=root123456
DB_SERVER=localhost
DB_NAME=gelymar

# API
PORT=3000
JWT_SECRET=gelymar_jwt_secret_key_2024

# Servicios externos
FRONTEND_BASE_URL=http://localhost:2121
FILE_SERVER_URL=http://localhost:8080
FILE_SERVER_ROOT=/var/www/html

# SMTP
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=
RESEND_KEY=re_fA1mA4H1_GJrLoZvz3Up3L8W7TwpcreAg
```

### Base de Datos MySQL

```bash
# Crear base de datos
mysql -u root -p
CREATE DATABASE gelymar;
USE gelymar;

# Importar estructura (ver carpeta Archive/)
source gelymar_v4.sql;
```

## ⏰ Cron Jobs (PM2)

### Instalación
```bash
cd Backend
npm install -g pm2
npm install node-cron
```

### Procesos Configurados

1. **gelymar-clean-db** - Limpia base de datos y directorios
2. **gelymar-client-fetcher** - Procesa archivo `CLIENTES.txt`
3. **gelymar-item-fetcher** - Procesa archivo `PRODUCTOS_SOFTKEY.txt`
4. **gelymar-order-fetcher** - Procesa archivo `FAC_HDR_SOFTKEY.txt`
5. **gelymar-orderline-fetcher** - Procesa archivo `FAC_LIN_SOFTKEY.txt`
6. **gelymar-defaultfiles-generator** - Genera documentos por defecto
7. **gelymar-etd-checker** - Verifica ETD

### Comandos PM2

```bash
# Iniciar todos los procesos
pm2 start ecosystem.config.js

# Ver estado
pm2 status

# Ver logs
pm2 logs

# Reiniciar proceso específico
pm2 restart gelymar-defaultfiles-generator

# Detener todos
pm2 delete all
```

### Horarios de Ejecución
- **6:00 AM**: Procesamiento de archivos de red
- **6:05 AM**: Generación de documentos por defecto

## 📁 Estructura del Proyecto

```
gelymar-management-platform/
├── Frontend/                 # Aplicación Astro
├── Backend/                  # API Node.js
│   ├── controllers/         # Controladores
│   ├── services/           # Servicios
│   ├── models/             # Modelos
│   ├── cron/               # Cron jobs
│   └── ecosystem.config.js # Configuración PM2
├── docker/                  # Configuración Docker
│   ├── docker-compose-dev.yml
│   ├── docker-compose-prod.yml
│   ├── docker-compose-hub.yml
└── Archive/                 # Scripts SQL y documentación
```

## 🛠️ Troubleshooting

### Problemas Comunes

#### 1. Error de Conexión a Base de Datos

##### Linux/macOS:
```bash
# Verificar que MySQL esté corriendo
docker ps | grep mysql

# Verificar logs de MySQL
docker logs gelymar-platform-mysql

# Verificar conectividad desde phpMyAdmin
docker exec gelymar-platform-phpmyadmin ping mysql
```

##### Windows (PowerShell):
```powershell
# Verificar que MySQL esté corriendo
docker ps | Select-String "mysql"

# Verificar logs de MySQL
docker logs gelymar-platform-mysql

# Verificar conectividad desde phpMyAdmin
docker exec gelymar-platform-phpmyadmin ping mysql

# Si MySQL no responde, reiniciar servicios
docker-compose -f docker-compose-dev.yml restart mysql
docker-compose -f docker-compose-dev.yml restart phpmyadmin
```

#### 2. Error de Variables de Entorno
   ```bash
# Verificar que el archivo .env existe
ls -la docker/.env

# Verificar logs de detección
docker logs gelymar-platform-backend | grep "Entorno detectado"
```

#### 3. Problemas de Permisos de Archivos
   ```bash
# Verificar permisos del fileserver
docker exec gelymar-platform-fileserver ls -la /var/www/html/uploads
   ```

#### 4. Cron Jobs No Funcionan
   ```bash
# Ver estado de PM2
docker exec gelymar-platform-cron pm2 status

# Ver logs de errores
docker exec gelymar-platform-cron pm2 logs --err
   ```

## 🔐 Credenciales por Defecto

### Base de Datos
- **MySQL Root**: `root` / `root123456`
- **phpMyAdmin**: `root` / `root123456`

### File Server
- **FTP**: `ftpuser` / `gelymar123`

### Terminal Web
- **Usuario**: `admin` / `admin123` (configurable con `TERMINAL_USER`/`TERMINAL_PASS`)

## 📊 Monitoreo y Logs

### URLs de Monitoreo
- **Dashboard**: `http://localhost:8082`
- **Terminal Web**: `http://localhost:7681`
- **phpMyAdmin**: `http://localhost:8081`
- **PM2 Web**: `http://localhost:9615`

### Logs
   ```bash
# Logs de contenedores
docker-compose logs backend
docker-compose logs frontend
docker-compose logs cron

# Logs específicos
docker logs gelymar-platform-backend
docker exec gelymar-platform-cron pm2 logs
   ```

## 🔄 Actualizar Contenedores

### Después de Cambios en el Código

#### Linux/macOS (Bash):
```bash
cd docker
docker-compose -f docker-compose-dev.yml down
docker system prune -f
cp env.local .env
docker-compose -f docker-compose-dev.yml up --build -d
docker ps
```

#### Windows (PowerShell):
```powershell
cd docker
docker-compose -f docker-compose-dev.yml down
docker system prune -f
Copy-Item env.local .env
docker-compose -f docker-compose-dev.yml up --build -d
docker ps
```

### Ver Imágenes y Limpiar

#### Linux/macOS:
```bash
# Ver imágenes de gelymar
docker images | grep gelymar-platform

# Eliminar imágenes específicas
docker rmi $(docker images -q gelymar-platform*)
```

#### Windows (PowerShell):
```powershell
# Ver imágenes de gelymar
docker images | Select-String "gelymar-platform"

# Eliminar imágenes específicas
docker images --format "table {{.Repository}}:{{.Tag}}" | Select-String "gelymar-platform" | ForEach-Object { docker rmi $_.ToString().Split()[0] }

# Limpiar todo lo no usado
docker system prune -a --force
```

## 🚀 Comandos Útiles

### Gestión de Contenedores

#### Linux/macOS:
```bash
# Ver estado de todos los servicios
docker ps

# Reiniciar un servicio específico
docker-compose restart backend

# Ver logs en tiempo real
docker-compose logs -f backend

# Acceder a un contenedor
docker exec -it gelymar-platform-backend bash
```

#### Windows (PowerShell):
```powershell
# Ver estado de todos los servicios
docker ps

# Reiniciar un servicio específico
docker-compose restart backend

# Ver logs en tiempo real
docker-compose logs -f backend

# Acceder a un contenedor
docker exec -it gelymar-platform-backend bash

# Ver logs de detección de entorno
docker logs gelymar-platform-backend | Select-String "Entorno detectado"
```

### Actualizaciones desde Docker Hub
```bash
# Actualizar imágenes Docker
cd docker
docker-compose pull
docker-compose up -d --force-recreate

# Actualizar solo un servicio
docker-compose up -d --force-recreate backend
```

## 🆘 Soporte

### Información del Sistema
- **Versión**: 2.19
- **Arquitectura**: Microservicios con Docker
- **Base de datos**: MySQL 8.0
- **Frontend**: Astro + Tailwind CSS
- **Backend**: Node.js + Express

### Contacto
Para problemas técnicos, revisar:
1. Logs del servicio afectado
2. Variables de entorno configuradas
3. Conectividad de red entre servicios

---
**Gelymar Management Platform** - Sistema de gestión integral containerizado

**Desarrollado por Softkey** - Plataforma de gestión Gelymar v2.0

## **🔧 Solución para el problema de phpMyAdmin:**

### **📋 Comandos de diagnóstico (PowerShell):**

```powershell
# 1. Verificar estado de contenedores
docker ps

# 2. Verificar logs de MySQL
docker logs gelymar-platform-mysql

# 3. Verificar logs de phpMyAdmin
docker logs gelymar-platform-phpmyadmin

# 4. Verificar conectividad de red
docker exec gelymar-platform-phpmyadmin ping mysql
```

### **🚨 Posibles causas y soluciones:**

#### **Causa 1: MySQL no está completamente iniciado**
```powershell
# Esperar a que MySQL esté listo
docker logs gelymar-platform-mysql | Select-String "ready for connections"

# Si no está listo, esperar y reiniciar phpMyAdmin
docker-compose -f docker-compose-dev.yml restart phpmyadmin
```

#### **Causa 2: Variables de entorno incorrectas**
```powershell
# Verificar variables de phpMyAdmin
docker exec gelymar-platform-phpmyadmin env | Select-String "PMA_"
```

#### **Causa 3: Red Docker no configurada**
```powershell
# Verificar red
docker network ls | Select-String "gelymar"

# Verificar que ambos estén en la misma red
docker inspect gelymar-platform-mysql | Select-String "gelymar-network"
docker inspect gelymar-platform-phpmyadmin | Select-String "gelymar-network"
```

### **🔧 Solución rápida:**

```powershell
# Reiniciar servicios en orden
cd docker
docker-compose -f docker-compose-dev.yml restart mysql
# Esperar 30 segundos
Start-Sleep 30
docker-compose -f docker-compose-dev.yml restart phpmyadmin
```

### **🔄 Solución completa (rebuild):**

```powershell
cd docker
docker-compose -f docker-compose-dev.yml down
docker system prune -f
Copy-Item env.local .env
docker-compose -f docker-compose-dev.yml up --build -d
```

## **🎯 ¿Qué comandos quieres ejecutar primero?**

1. **Diagnóstico rápido** - Ver logs y estado
2. **Reinicio de servicios** - Reiniciar MySQL y phpMyAdmin  
3. **Rebuild completo** - Reconstruir todo desde cero

¿Cuál prefieres probar primero? 🔍

