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

# Crear directorio para montar red compartida
echo "Creando directorio para red compartida..."
mkdir -p /mnt/red

# Configurar variable de entorno para Docker
export BACKEND_API_URL=http://backend:3000

# Crear ecosystem.config.js temporal con la URL correcta para Docker
echo "Configurando ecosystem.config.js para Docker..."
sed 's|http://localhost:3000|http://backend:3000|g' ecosystem.config.js > ecosystem.config.js.tmp
mv ecosystem.config.js.tmp ecosystem.config.js

# Forzar el uso de IPv4 para evitar problemas de IPv6
export NODE_OPTIONS="--dns-result-order=ipv4first"

# Iniciar PM2 con ecosystem.config.js
echo "Iniciando PM2 con ecosystem.config.js..."
pm2 start ecosystem.config.js

# Mostrar estado inicial
echo "Estado inicial de PM2:"
pm2 status

echo "Contenedor de cron iniciado con PM2..."
echo "Para ver logs: pm2 logs"
echo "Para ver estado: pm2 status"
echo "Para reiniciar: pm2 restart all"

# Mantener el contenedor corriendo y mostrar logs de PM2
pm2 logs 