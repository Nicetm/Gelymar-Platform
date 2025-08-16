
# 🚀 Gelymar Management Platform

Plataforma de gestión integral para Gelymar con arquitectura de microservicios containerizada.

## 🏗️ Arquitectura

La plataforma está dividida en 6 capas principales:

1. **Frontend** (Astro) - Puerto 2121
2. **Backend** (Node.js API) - Puerto 3000  
3. **File Server** (Apache + FTP) - Puerto 8080
4. **Database** (MySQL + phpMyAdmin) - Puerto 3306/8081
5. **Cron Jobs** (PM2) - Puerto 9615
6. **Monitoring** (Dashboard + Terminal) - Puerto 8082/7681

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

# Desarrollo local (build)
cd docker
docker-compose up -d

# O producción (Docker Hub)
cd docker
docker pull nicetm/gelymar-platform:mysql
docker pull nicetm/gelymar-platform:fileserver
docker pull nicetm/gelymar-platform:backend
docker pull nicetm/gelymar-platform:frontend
docker pull nicetm/gelymar-platform:cron
docker pull nicetm/gelymar-platform:monitoring
docker pull nicetm/gelymar-platform:terminal
docker-compose -f docker-compose-hub.yml up -d
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
│   ├── docker-compose.yml
│   ├── docker-compose-hub.yml
│   └── README.md
└── Archive/                 # Scripts SQL y documentación
```

## 🔐 Credenciales

### Base de Datos
- **MySQL Root**: root / root123456
- **phpMyAdmin**: root / root123456

### File Server
- **FTP**: ftpuser / gelymar123

### Monitoring
- **Dashboard**: admin / gelymar2024
- **Terminal**: admin / gelymar2024

## 📊 Monitoreo

### Dashboard de Monitoreo
- Estado de servicios
- Logs en tiempo real
- Métricas de rendimiento
- Terminal web integrado

### Logs
- **Backend**: `Backend/logs/`
- **Cron**: `Backend/logs/`
- **Docker**: `docker-compose logs [servicio]`

## 🚨 Troubleshooting

### Problemas Comunes

1. **Puertos ocupados**:
   ```bash
   # Verificar puertos en uso
   netstat -tulpn | grep :3000
   ```

2. **Base de datos no conecta**:
   ```bash
   # Verificar MySQL
   mysql -u root -p -h localhost
   ```

3. **Cron no ejecuta**:
   ```bash
   # Verificar PM2
   pm2 status
   pm2 logs
   ```

4. **Docker no inicia**:
   ```bash
   # Verificar Docker
   docker ps
   docker-compose logs
   ```

## 🔄 Actualizaciones

### Docker
```bash
cd docker
docker-compose pull
docker-compose up -d --force-recreate
```

### Manual
```bash
# Frontend
cd Frontend
git pull
npm install
npm run build

# Backend
cd Backend
git pull
npm install
pm2 restart all
```

## 📦 Exportar/Importar

### Exportar stack completo
```bash
docker save gelymar-platform-backend:latest gelymar-platform-frontend:latest gelymar-platform-fileserver:latest gelymar-platform-cron:latest gelymar-platform-terminal:latest gelymar-platform-monitoring:latest mysql:8.0 > gelymar-platform-complete.tar
```

### Importar stack
```bash
docker load < gelymar-platform-complete.tar
```

## 📚 Documentación Adicional

- **Docker**: Ver `docker/README.md`
- **API**: Ver `Backend/docs/`
- **Frontend**: Ver `Frontend/docs/`

## 🆘 Soporte

Para problemas técnicos:
1. Revisar logs del servicio afectado
2. Verificar configuración de variables de entorno
3. Comprobar conectividad de red
4. Revisar documentación específica del servicio

---

**Desarrollado por Softkey** - Plataforma de gestión Gelymar v2.0

