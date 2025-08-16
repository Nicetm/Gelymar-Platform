FROM node:18-alpine

# Instalar PM2 y dependencias del sistema
RUN npm install -g pm2 && \
    apk add --no-cache cifs-utils mount bash netcat-openbsd

WORKDIR /app

# Copiar package.json e instalar dependencias
COPY Backend/package*.json ./
RUN npm ci --only=production

# Copiar todo el código del backend
COPY Backend/ ./

# Crear directorios necesarios
RUN mkdir -p logs

# Script de inicio
COPY docker/cron/docker-entrypoint-cron.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint-cron.sh

ENV NODE_ENV=production
ENV PM2_HOME=/app/.pm2

EXPOSE 9615

ENTRYPOINT ["docker-entrypoint-cron.sh"] 