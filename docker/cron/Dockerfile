FROM node:18-alpine

# Instalar PM2 y dependencias del sistema (+ tzdata para zona horaria)
RUN npm install -g pm2 && \
    apk add --no-cache tzdata cifs-utils bash netcat-openbsd mount

# Zona horaria Chile
ENV TZ=America/Santiago

WORKDIR /app

# Copiar package.json del Cronjob e instalar dependencias
COPY Cronjob/package*.json ./
RUN npm install --omit=dev

# Copiar todo el código del Cronjob
COPY Cronjob/ ./

# Crear directorios necesarios
RUN mkdir -p logs

# Crear script de inicio directamente (evita problemas de CRLF)
RUN printf '#!/bin/bash\nset -e\necho "Starting PM2..."\npm2-runtime start ecosystem.config.js\n' > /usr/local/bin/docker-entrypoint-cron.sh && chmod +x /usr/local/bin/docker-entrypoint-cron.sh

# Variables de entorno por defecto (se pueden sobrescribir en runtime)
ENV NODE_ENV=production
ENV PM2_HOME=/app/.pm2
ENV MYSQL_DB_HOST=mysql
ENV MYSQL_DB_PORT=3306
ENV MYSQL_DB_USER=root
ENV MYSQL_DB_PASS=root123456
ENV MYSQL_DB_NAME=gelymar
ENV JWT_SECRET=gelymar_jwt_secret_key_2024
ENV FRONTEND_BASE_URL=http://localhost:2121
ENV FILE_SERVER_URL=http://fileserver:80
ENV FILE_SERVER_ROOT=/var/www/html
ENV BACKEND_API_URL=http://backend:3000
ENV SMTP_HOST=smtp.office365.com
ENV SMTP_PORT=587
ENV SMTP_USER=logistics@gelymar.com
ENV NETWORK_USER=softkey
ENV NETWORK_PASSWORD=sK06.2025$#
ENV NETWORK_SERVER=172.20.10.167
ENV NETWORK_SHARE_PATH=Users/above/Documents/BotArchivoWeb/archivos

EXPOSE 9615
ENTRYPOINT ["docker-entrypoint-cron.sh"]
