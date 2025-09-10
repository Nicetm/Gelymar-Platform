#!/bin/bash

# Script de entrada para el contenedor VPN
set -e

echo "🔧 Configurando VPN..."

# Configurar variables de entorno
VPN_HOST=${VPN_HOST:-190.121.25.82}
VPN_PORT=${VPN_PORT:-11444}
VPN_USERNAME=${VPN_USERNAME:-softkey}
VPN_PASSWORD=${VPN_PASSWORD:-Z4lW00p$+h}
VPN_TRUSTED_CERT=${VPN_TRUSTED_CERT:-e137232dbb266375a29ae71401de95587812652b722c2f81b5e19fe5dc358203}

# Crear archivo de configuración
echo "host = $VPN_HOST" > /etc/openfortivpn/config
echo "port = $VPN_PORT" >> /etc/openfortivpn/config
echo "username = $VPN_USERNAME" >> /etc/openfortivpn/config
echo "password = $VPN_PASSWORD" >> /etc/openfortivpn/config
echo "trusted-cert = $VPN_TRUSTED_CERT" >> /etc/openfortivpn/config
echo "pppd-use-peerdns = 1" >> /etc/openfortivpn/config
echo "pppd-log = /var/log/pppd.log" >> /etc/openfortivpn/config

echo "📋 Configuración VPN:"
cat /etc/openfortivpn/config

echo "🚀 Iniciando conexión VPN..."
exec openfortivpn -c /etc/openfortivpn/config -v
