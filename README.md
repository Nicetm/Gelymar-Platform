
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
- **gelymar-etd-checker**: Verificación de ETD

### Horarios de ejecución:
Todos los procesos se ejecutan diariamente a las **6:00 AM** y evitan duplicados automáticamente.

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

