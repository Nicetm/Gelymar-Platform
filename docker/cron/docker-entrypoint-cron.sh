#!/bin/bash
set -e

# Esperar MySQL
while ! nc -z mysql 3306; do sleep 1; done

# Esperar Backend
while ! nc -z backend 3000; do sleep 1; done

# Esperar File Server
while ! nc -z fileserver 80; do sleep 1; done

# Crear directorio PM2
mkdir -p /app/.pm2

# Verificar que el directorio de uploads existe
mkdir -p /var/www/html/uploads

# Crear directorio para montar red compartida
mkdir -p /mnt/red

# Configurar variable de entorno para Docker
export BACKEND_API_URL=http://backend:3000

# Crear ecosystem.config.js temporal con la URL correcta para Docker
sed 's|http://localhost:3000|http://backend:3000|g' ecosystem.config.js > ecosystem.config.js.tmp
mv ecosystem.config.js.tmp ecosystem.config.js

# Forzar el uso de IPv4 para evitar problemas de IPv6
export NODE_OPTIONS="--dns-result-order=ipv4first"

# Iniciar PM2 con ecosystem.config.js
pm2 start ecosystem.config.js --silent
pm2 status

# Mantener el contenedor corriendo
tail -f /dev/null 