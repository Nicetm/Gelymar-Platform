# Cron Jobs - Gelymar Platform

Este directorio contiene todos los cron jobs del sistema Gelymar Platform. Los cron jobs están diseñados para ejecutarse en secuencia y sincronizar datos desde archivos externos hacia la base de datos.

## 📋 Cron Jobs Disponibles

### 1. **checkClients.js** - 5:00 AM
**Propósito:** Procesa archivos de clientes desde la red compartida
- **Archivo fuente:** `CLIENTES.txt` desde `//172.20.10.167/Users/above/Documents/BotArchivoWeb/archivos/`
- **Acción:** Lee clientes y los inserta en la tabla `customers`
- **Dependencias:** Ninguna (primer cron en la secuencia)

### 2. **checkItems.js** - 5:30 AM
**Propósito:** Procesa archivos de productos/items desde la red compartida
- **Archivo fuente:** `PRODUCTOS.txt` desde la red compartida
- **Acción:** Lee productos y los inserta en la tabla `items`
- **Dependencias:** `checkClients` (espera que los clientes estén procesados)

### 3. **checkOrders.js** - 6:00 AM
**Propósito:** Procesa archivos de órdenes desde la red compartida
- **Archivo fuente:** `FAC_HDR_SOFTKEY.txt` desde la red compartida
- **Acción:** Lee órdenes y las inserta en la tabla `orders`
- **Dependencias:** `checkItems` (necesita productos para asociar)

### 4. **checkOrderLines.js** - 6:30 AM
**Propósito:** Procesa archivos de líneas de orden desde la red compartida
- **Archivo fuente:** `FAC_LIN_SOFTKEY.txt` desde la red compartida
- **Acción:** Lee líneas de orden y las inserta en la tabla `order_details`
- **Dependencias:** `checkOrders` (necesita órdenes para asociar)

### 5. **checkDefaultFiles.js** - 6:45 AM
**Propósito:** Genera documentos por defecto para órdenes
- **Acción:** Crea archivos PDF de documentos estándar (AVE, AVRO, RO)
- **Dependencias:** `checkOrderLines` (necesita líneas de orden completas)

### 6. **checkETD.js** - 7:00 AM
**Propósito:** Verifica y actualiza fechas ETD de órdenes
- **Acción:** Actualiza fechas ETD en órdenes basado en archivos externos
- **Dependencias:** `checkDefaultFiles` (espera que los documentos estén generados)

### 7. **checkClientAccess.js** - 7:30 AM
**Propósito:** Sincroniza clientes con usuarios del sistema
- **Acción:** Crea usuarios en tabla `users` para clientes que no tienen acceso
- **Dependencias:** `checkETD` (último cron en la secuencia)

## ⏰ Horarios de Ejecución

```
5:00 AM  → checkClients
5:30 AM  → checkItems
6:00 AM  → checkOrders
6:30 AM  → checkOrderLines
6:45 AM  → checkDefaultFiles
7:00 AM  → checkETD
7:30 AM  → checkClientAccess
```

## 🚀 Modos de Ejecución

### Modo Normal (Solo Levantar)
```bash
pm2 start ecosystem.config.js
```
- **Comportamiento:** Solo levanta los procesos
- **NO ejecuta** tareas iniciales
- **Espera** hasta la hora programada
- **Ejecuta** cuando llegue la hora

### Modo con Ejecución Inmediata
```bash
pm2 start ecosystem.config.js -- --execute-now
```
- **Comportamiento:** Levanta los procesos + ejecuta inmediatamente
- **Ejecuta** la tarea al levantar
- **Mantiene** la programación normal
- **Ejecuta** de nuevo cuando llegue la hora

## 🐳 Ejecución en Docker

### Levantar Contenedor
```bash
docker-compose up -d cron
```

### Ver Logs
```bash
docker logs gelymar-platform-cron
```

### Conectar al Contenedor
```bash
docker exec -it gelymar-platform-cron bash
```

### Comandos PM2 dentro del Contenedor
```bash
# Ver estado de todos los cron
pm2 status

# Ver logs de todos los cron
pm2 logs

# Ver logs de un cron específico
pm2 logs gelymar-client-fetcher

# Reiniciar todos los cron
pm2 restart all

# Reiniciar un cron específico
pm2 restart gelymar-client-fetcher

# Ejecutar con parámetros
pm2 start ecosystem.config.js -- --execute-now
```

## 📊 Monitoreo

### Estado de los Procesos
```bash
pm2 status
```

### Logs en Tiempo Real
```bash
pm2 logs
```

### Información Detallada
```bash
pm2 show gelymar-client-fetcher
```

### Métricas
```bash
pm2 monit
```

## 🔧 Configuración

### Variables de Entorno Requeridas
```bash
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASS=root123456
DB_NAME=gelymar
FILE_SERVER_ROOT=/var/www/html
FILE_SERVER_URL=http://fileserver:80
BACKEND_API_URL=http://backend:3000
SERVER=172.20.10.167
SHARE_PATH=Users/above/Documents/BotArchivoWeb/archivos
USER=softkey
PASSWORD=sK06.2025#
```

### Configuración de Red Compartida
- **Servidor:** 172.20.10.167
- **Ruta:** Users/above/Documents/BotArchivoWeb/archivos
- **Usuario:** softkey
- **Archivos:** CLIENTES.txt, PRODUCTOS.txt, FAC_HDR_SOFTKEY.txt, FAC_LIN_SOFTKEY.txt

## 🛠️ Troubleshooting

### Problemas Comunes

#### 1. Error de Conexión a Red Compartida
```bash
# Verificar conectividad
ping 172.20.10.167

# Verificar montaje
ls -la /mnt/red/
```

#### 2. Error de Base de Datos
```bash
# Verificar conexión MySQL
mysql -h mysql -u root -p

# Verificar tablas
USE gelymar;
SHOW TABLES;
```

#### 3. Error de Archivos
```bash
# Verificar permisos
ls -la /var/www/html/uploads/

# Verificar espacio en disco
df -h
```

### Logs de Error
```bash
# Ver logs de error específicos
pm2 logs --err

# Ver logs de un proceso específico
pm2 logs gelymar-client-fetcher --err
```

## 📝 Estructura de Archivos

```
cron/
├── README.md                    # Este archivo
├── checkClients.js             # Procesamiento de clientes
├── checkItems.js               # Procesamiento de productos
├── checkOrders.js              # Procesamiento de órdenes
├── checkOrderLines.js          # Procesamiento de líneas de orden
├── checkDefaultFiles.js        # Generación de documentos
├── checkETD.js                 # Verificación de ETD
└── checkClientAccess.js        # Sincronización de acceso de clientes
```

## 🔄 Dependencias

### Secuencia de Ejecución
```
checkClients → checkItems → checkOrders → checkOrderLines → checkDefaultFiles → checkETD → checkClientAccess
```

### Dependencias en PM2
- `checkItems` depende de `checkClients`
- `checkOrders` depende de `checkItems`
- `checkOrderLines` depende de `checkOrders`
- `checkDefaultFiles` depende de `checkOrderLines`
- `checkETD` depende de `checkDefaultFiles`
- `checkClientAccess` depende de `checkETD`

## 📞 Soporte

Para problemas o consultas sobre los cron jobs:
1. Revisar logs con `pm2 logs`
2. Verificar estado con `pm2 status`
3. Consultar documentación de servicios en `../services/`
4. Verificar configuración de red compartida

---

**Última actualización:** Enero 2025
**Versión:** 2.0.0 