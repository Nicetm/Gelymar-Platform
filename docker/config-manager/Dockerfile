FROM node:18-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache \
    bash \
    curl \
    docker-cli \
    docker-compose \
    jq \
    sed \
    grep \
    openssh-client \
    sshpass \
    expect \
    ttyd

# Crear directorio de trabajo
WORKDIR /app

# Configurar SSH para aceptar host keys automáticamente
RUN mkdir -p /root/.ssh && \
    echo "Host *" > /root/.ssh/config && \
    echo "    StrictHostKeyChecking no" >> /root/.ssh/config && \
    echo "    UserKnownHostsFile /dev/null" >> /root/.ssh/config && \
    echo "    LogLevel QUIET" >> /root/.ssh/config && \
    echo "    PasswordAuthentication yes" >> /root/.ssh/config && \
    echo "    PreferredAuthentications password" >> /root/.ssh/config

# Crear script expect para automatizar SSH con contraseña
RUN echo '#!/usr/bin/expect -f' > /usr/local/bin/ssh-with-password && \
    echo 'set timeout 30' >> /usr/local/bin/ssh-with-password && \
    echo 'spawn ssh {*}$argv' >> /usr/local/bin/ssh-with-password && \
    echo 'expect "password:"' >> /usr/local/bin/ssh-with-password && \
    echo 'send "Lug4R0j4.2025.\r"' >> /usr/local/bin/ssh-with-password && \
    echo 'interact' >> /usr/local/bin/ssh-with-password && \
    chmod +x /usr/local/bin/ssh-with-password

# Reemplazar el comando ssh del sistema con nuestro wrapper usando sshpass
RUN mv /usr/bin/ssh /usr/bin/ssh.original && \
    echo '#!/bin/bash' > /usr/bin/ssh && \
    echo 'sshpass -p '"'"'Lug4R0j4.2025.'"'"' /usr/bin/ssh.original "$@"' >> /usr/bin/ssh && \
    chmod +x /usr/bin/ssh

# Crear script de prueba SSH
RUN echo '#!/bin/bash' > /usr/local/bin/test-ssh && \
    echo 'export SSHPASS="Lug4R0j4.2025."' >> /usr/local/bin/test-ssh && \
    echo 'sshpass -e ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$@"' >> /usr/local/bin/test-ssh && \
    chmod +x /usr/local/bin/test-ssh

# Copiar package.json
COPY package.json package-lock.json* ./

# Instalar dependencias de Node.js
RUN npm install

# Copiar código fuente
COPY src/ ./src/

# Copiar scripts del terminal
COPY terminal-manager.sh ./
COPY terminal-wrapper.sh ./
RUN chmod +x ./terminal-manager.sh ./terminal-wrapper.sh

# Crear directorio para logs
RUN mkdir -p /app/logs

# Exponer puertos
EXPOSE 8083 7682

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=8083
ENV PROJECT_PATH=/app/project
ENV DOCKER_COMPOSE_FILE=/app/docker/docker-compose-prod.yml

# Script de inicio
RUN echo '#!/bin/bash' > /app/start.sh && \
    echo 'ttyd -p 7682 --writable bash /app/terminal-wrapper.sh &' >> /app/start.sh && \
    echo 'node src/app.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Comando de inicio
CMD ["/app/start.sh"]
