#!/bin/bash

# Script para configurar Docker context remoto
# Uso: ./setup-remote-docker.sh <usuario> <ip_servidor> <puerto_ssh>

USER=$1
SERVER_IP=$2
SSH_PORT=${3:-22}

if [ -z "$USER" ] || [ -z "$SERVER_IP" ]; then
    echo "Uso: $0 <usuario> <ip_servidor> [puerto_ssh]"
    echo "Ejemplo: $0 root 172.20.10.151 22"
    exit 1
fi

echo "Configurando Docker context remoto..."
echo "Usuario: $USER"
echo "Servidor: $SERVER_IP"
echo "Puerto SSH: $SSH_PORT"

# Crear contexto Docker remoto
docker context create remote-server --docker "host=ssh://${USER}@${SERVER_IP}:${SSH_PORT}"

# Verificar que el contexto se creó correctamente
if [ $? -eq 0 ]; then
    echo "✅ Contexto Docker remoto creado exitosamente"
    echo "Para usar el contexto remoto: docker context use remote-server"
    echo "Para volver al contexto local: docker context use default"
else
    echo "❌ Error creando el contexto Docker remoto"
    exit 1
fi
