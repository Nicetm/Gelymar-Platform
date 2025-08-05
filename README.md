
# 📄 Variables de Entorno

Debes crear un archivo `.env` en la raíz del proyecto `frontend/` con el siguiente contenido:
```
PUBLIC_LANG=en
PUBLIC_API_URL=http://localhost:3000
PUBLIC_FILE_SERVER_URL=http://localhost:3000 --> lo cambiare a un :80
REMOTE_ASSETS_BASE_URL=/assets
SITE=http://localhost:2121
BASE_URL=/
```
# 🛠️ Backend

Debes crear un archivo `.env` en la carpeta `backend/` con el siguiente contenido:
```
#DB
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_SERVER=localhost
DB_NAME=gelymar

#API
PORT=3000
JWT_SECRET=claveSuperSecreta123
RESEND_KEY=re_fA1mA4H1_GJrLoZvz3Up3L8W7TwpcreAg

#FILE SERVER
FILE_SERVER_ROOT=C:/xampp/htdocs/gelymar/uploads
```
# 🗄️ Base de Datos MySQL

El sistema utiliza una base de datos MySQL. Puedes importar la estructura y datos desde el siguiente archivo:

🔗 [Descargar script SQL de la base de datos] --> https://drive.google.com/file/d/1CixfoDYXNUUTgxe2jKWis2ZNpTI5Veqp/view?usp=sharing


# Cron PM2

## Instalación de dependencias

```bash
npm install node-cron
npm install -g pm2
```

## Configuración

El sistema utiliza PM2 para gestionar los procesos de cron que procesan automáticamente archivos desde la red compartida.

### Procesos configurados:

- **gelymar-client-fetcher**: Procesa archivo `CLIENTES.txt` → tabla `customers`
- **gelymar-order-fetcher**: Procesa archivo `FAC_HDR_SOFTKEY.txt` → tabla `orders`
- **gelymar-item-fetcher**: Procesa archivo `PRODUCTOS_SOFTKEY.txt` → tabla `items`
- **gelymar-orderline-fetcher**: Procesa archivo `FAC_LIN_SOFTKEY.txt` → tabla `order_items`
- **gelymar-defaultfiles-generator**: Genera documentos por defecto → tabla `files` + directorios físicos
- **gelymar-etd-checker**: Verificación de ETD

### Horarios de ejecución:
- **6:00 AM**: Procesamiento de archivos de red (clientes, órdenes, items, líneas de orden)
- **6:05 AM**: Generación de documentos por defecto
Todos los procesos evitan duplicados automáticamente.

## Comandos principales

```bash
# Navegar al directorio backend
cd backend

# Iniciar todos los procesos
pm2 start ecosystem.config.js

# Ver estado de todos los procesos
pm2 status

# Ver logs de procesos específicos
pm2 logs gelymar-client-fetcher
pm2 logs gelymar-order-fetcher
pm2 logs gelymar-item-fetcher
pm2 logs gelymar-orderline-fetcher
pm2 logs gelymar-defaultfiles-generator
pm2 logs gelymar-etd-checker

# Ver logs de todos los procesos
pm2 logs

# Reiniciar todos los procesos
pm2 restart all

# Detener todos los procesos
pm2 stop all

# Eliminar todos los procesos
pm2 delete all

# Reiniciar proceso específico
pm2 restart gelymar-client-fetcher
```

## Monitoreo

Los procesos generan logs detallados que incluyen:
- Número de registros procesados
- Registros insertados vs omitidos (duplicados)
- Errores encontrados
- Archivos CSV de verificación en `documentos/`

## Configuración de red

Los procesos se conectan a:
- **Servidor**: 172.20.10.167
- **Ruta**: Users/above/Documents/BotArchivoWeb/archivos
- **Usuario**: softkey
- **Contraseña**: sK06.2025#

## Generación de documentos por defecto

El proceso `gelymar-defaultfiles-generator` crea automáticamente tres documentos por defecto para cada orden:

1. **Recepcion de orden**
2. **Aviso de Embarque**
3. **Aviso de Recepcion de orden**

### Funcionamiento:
- Lee todas las órdenes de la tabla `orders`
- Agrupa por RUT del cliente
- Para cada orden, verifica si ya existen los 3 documentos
- Si no existen, crea los registros en la tabla `files`
- Crea directorios físicos en `FILE_SERVER_ROOT` con estructura: `/CLIENTE_NOMBRE/Numero PC`
- Asigna `folder_id` incremental para agrupar los 3 documentos

### Configuración requerida:
Asegúrate de que `FILE_SERVER_ROOT` esté configurado en el archivo `.env`:
```
FILE_SERVER_ROOT=C:/xampp/htdocs/gelymar/uploads
```

