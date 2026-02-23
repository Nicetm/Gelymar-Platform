---
inclusion: always
---

# Documentación Gelymar Management Platform

Bienvenido a la documentación completa de la Plataforma de Gestión Gelymar. Esta documentación está organizada por capas y responsabilidades para facilitar su comprensión y mantenimiento.

## 📋 Índice de Documentación

### 🎯 Producto y Negocio
- **[product.md](./product.md)** - Descripción general del producto, funcionalidades principales y roles de usuario
- **[business-rules.md](./business-rules.md)** - Reglas de negocio críticas: órdenes parciales, generación de documentos, permisos

### 🗄️ Base de Datos
- **[database.md](./database.md)** - Arquitectura dual (MySQL + SQL Server), tablas, vistas, mappers y patrones de consulta

### 🔧 Backend
- **[backend-architecture.md](./backend-architecture.md)** - Arquitectura, stack tecnológico, middleware, logging y manejo de errores
- **[backend-services.md](./backend-services.md)** - Servicios principales, funciones clave y patrones de uso
- **[backend-apis.md](./backend-apis.md)** - Endpoints API, autenticación, validación y testing

### 🎨 Frontend
- **[frontend.md](./frontend.md)** - Arquitectura multi-contexto (admin/client/seller), componentes, Socket.io y servicios API

### ⏰ Cron Jobs
- **[cron-jobs.md](./cron-jobs.md)** - Jobs configurados, horarios, configuración dinámica y gestión con PM2

### 🐳 Docker y Deployment
- **[docker.md](./docker.md)** - Arquitectura de contenedores, servicios, scripts de build y troubleshooting

## 🚀 Inicio Rápido

### Para Desarrolladores Backend
1. Lee [backend-architecture.md](./backend-architecture.md) para entender la estructura
2. Revisa [backend-services.md](./backend-services.md) para conocer los servicios disponibles
3. Consulta [backend-apis.md](./backend-apis.md) para los endpoints
4. Revisa [database.md](./database.md) para el esquema de datos

### Para Desarrolladores Frontend
1. Lee [frontend.md](./frontend.md) para entender la arquitectura multi-contexto
2. Revisa [backend-apis.md](./backend-apis.md) para los endpoints disponibles
3. Consulta [business-rules.md](./business-rules.md) para las reglas de negocio

### Para DevOps
1. Lee [docker.md](./docker.md) para deployment
2. Revisa [cron-jobs.md](./cron-jobs.md) para gestión de tareas programadas
3. Consulta [backend-architecture.md](./backend-architecture.md) para configuración de entorno

### Para Product Managers
1. Lee [product.md](./product.md) para funcionalidades
2. Revisa [business-rules.md](./business-rules.md) para reglas críticas
3. Consulta [frontend.md](./frontend.md) para portales de usuario

## 📚 Conceptos Clave

### Órdenes Parciales
Las órdenes pueden dividirse en múltiples órdenes parciales que comparten el mismo PC/OC pero tienen diferentes facturas. Ver [business-rules.md](./business-rules.md#órdenes-y-parcialización).

### Documentos Automáticos
El sistema genera 4 tipos de documentos automáticamente:
- **ORN** (Order Receipt Notice) - Solo para orden padre
- **Shipment Notice** - Por cada orden parcial
- **Delivery Notice** - Por cada orden parcial
- **Availability Notice** - Por cada orden parcial

Ver [business-rules.md](./business-rules.md#generación-de-documentos).

### Permisos de Contactos
Cada contacto tiene 3 flags de permisos:
- `sh_documents`: Recibe documentos manuales
- `reports`: Recibe documentos generados automáticamente
- `cco`: Siempre recibe copia

Ver [business-rules.md](./business-rules.md#permisos-de-contactos).

### Arquitectura Multi-Contexto
El frontend se construye en 3 contextos separados:
- **Admin** (puerto 2121): Gestión completa
- **Client** (puerto 2122): Portal de clientes
- **Seller** (puerto 2123): Portal de vendedores

Ver [frontend.md](./frontend.md#arquitectura-multi-contexto).

## 🔍 Búsqueda Rápida

### ¿Cómo hacer...?

**Crear un nuevo servicio backend:**
1. Crear archivo en `Backend/services/`
2. Registrar en `Backend/config/container.js`
3. Ver [backend-services.md](./backend-services.md) para patrones

**Agregar un nuevo endpoint API:**
1. Crear ruta en `Backend/routes/`
2. Crear controller en `Backend/controllers/`
3. Ver [backend-apis.md](./backend-apis.md) para patrones

**Crear un nuevo cron job:**
1. Crear archivo en `Cronjob/cron/`
2. Registrar en `Cronjob/ecosystem.config.js`
3. Ver [cron-jobs.md](./cron-jobs.md) para configuración

**Agregar una nueva página frontend:**
1. Crear archivo en `Frontend/src/pages/[contexto]/`
2. Usar layout apropiado
3. Ver [frontend.md](./frontend.md) para estructura

**Consultar SQL Server (Softkey):**
```javascript
const { getSqlPool, sql } = require('../config/sqlserver');
const sqlPool = await getSqlPool();
const request = sqlPool.request();
request.input('pc', sql.VarChar, pc);
const result = await request.query('SELECT * FROM jor_imp_HDR_90_softkey WHERE Nro = @pc');
```
Ver [backend-services.md](./backend-services.md#consultas-sql-server).

**Consultar MySQL:**
```javascript
const { poolPromise } = require('../config/db');
const pool = await poolPromise;
const [rows] = await pool.query('SELECT * FROM users WHERE rut = ?', [rut]);
```
Ver [backend-services.md](./backend-services.md#consultas-mysql).

## 🛠️ Comandos Útiles

### Desarrollo
```bash
# Backend
cd Backend
npm run dev

# Frontend (por contexto)
cd Frontend
npm run dev:admin
npm run dev:client
npm run dev:seller

# Docker
cd docker
docker-compose --env-file .env.local up -d
```

### Producción
```bash
# Build y deploy
cd docker
.\build-all-prod.ps1
docker compose --env-file .env.production up -d

# O usar imágenes de DockerHub
docker compose -f docker-compose-hub.yml pull
docker compose -f docker-compose-hub.yml --env-file .env.production up -d
```

### Cron Jobs
```bash
# Ver estado
pm2 list

# Ver logs
pm2 logs gelymar-order-reception

# Ejecutar manualmente
node Cronjob/cron/sendOrderReception.js execute-now
```

## 📞 Soporte

Para preguntas o problemas:
1. Consulta la documentación relevante
2. Revisa los logs: `docker-compose logs -f [servicio]`
3. Verifica el estado: `docker-compose ps`

## 🔄 Actualización de Documentación

Esta documentación debe actualizarse cuando:
- Se agregan nuevas funcionalidades
- Se modifican reglas de negocio
- Se cambia la arquitectura
- Se agregan nuevos servicios o endpoints
- Se modifican configuraciones importantes

Mantén la documentación sincronizada con el código para facilitar el trabajo del equipo.
