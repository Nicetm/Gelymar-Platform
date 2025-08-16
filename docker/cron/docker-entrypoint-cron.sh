#!/bin/bash
set -e

echo "Iniciando contenedor de cron jobs..."

# Esperar MySQL
echo "Esperando MySQL..."
while ! nc -z mysql 3306; do sleep 1; done

# Esperar Backend
echo "Esperando Backend..."
while ! nc -z backend 3000; do sleep 1; done

# Esperar File Server
echo "Esperando File Server..."
while ! nc -z fileserver 80; do sleep 1; done

# Crear directorio PM2
mkdir -p /app/.pm2

# Verificar que el directorio de uploads existe
echo "Verificando directorio de uploads..."
mkdir -p /var/www/html/uploads

# Mantener contenedor corriendo
echo "Contenedor de cron iniciado..."
echo "Para ejecutar PM2 manualmente, ejecuta: pm2 start ecosystem.config.js"
echo "Para ver logs: pm2 logs"
echo "Para ver estado: pm2 status"

# Mantener el contenedor corriendo
tail -f /dev/null 