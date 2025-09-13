FROM node:18-alpine

# Instalar PM2 y dependencias del sistema (+ tzdata para zona horaria)
RUN npm install -g pm2 && \
    apk add --no-cache tzdata cifs-utils bash netcat-openbsd mount

# Zona horaria Chile
ENV TZ=America/Santiago

WORKDIR /app

# Copiar package.json del Cronjob e instalar dependencias
COPY package*.json ./
RUN npm ci --only=production

# Copiar todo el código del Cronjob
COPY . ./

# Crear directorios necesarios
RUN mkdir -p logs

# Script de inicio
COPY docker-entrypoint-cron.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint-cron.sh

# Variables de entorno por defecto (se pueden sobrescribir en runtime)
ENV NODE_ENV=production
ENV PM2_HOME=/app/.pm2
ENV DB_HOST=mysql
ENV DB_PORT=3306
ENV DB_USER=root
ENV DB_PASS=root123456
ENV DB_NAME=gelymar
ENV JWT_SECRET=gelymar_jwt_secret_key_2024
ENV FRONTEND_BASE_URL=http://localhost:2121
ENV FILE_SERVER_URL=http://fileserver:80
ENV FILE_SERVER_ROOT=/var/www/html
ENV BACKEND_API_URL=http://backend:3000
ENV SMTP_HOST=smtp.office365.com
ENV SMTP_PORT=587
ENV SMTP_USER=logistics@gelymar.com
ENV NETWORK_USER=softkey
ENV NETWORK_PASSWORD=sK06.2025#
ENV NETWORK_SERVER=172.20.10.167
ENV NETWORK_SHARE_PATH=Users/above/Documents/BotArchivoWeb/archivos

EXPOSE 9615
ENTRYPOINT ["docker-entrypoint-cron.sh"]
