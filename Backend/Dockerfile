FROM node:18-alpine

# Dependencias del sistema (incluye tzdata para zona horaria y cifs-utils para SMB)
RUN apk add --no-cache tzdata cifs-utils

# Zona horaria Chile
ENV TZ=America/Santiago

WORKDIR /app

# Instalar dependencias en modo producción + PM2
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g pm2

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p uploads /mnt/red /mnt/archivos

# Variables de entorno por defecto (se pueden sobrescribir en runtime)
ENV NODE_ENV=production
ENV PORT=3000
ENV MYSQL_DB_HOST=mysql
ENV MYSQL_DB_PORT=3306
ENV MYSQL_DB_USER=root
ENV MYSQL_DB_PASS=root123456
ENV MYSQL_DB_NAME=gelymar
ENV JWT_SECRET=gelymar_jwt_secret_key_2024
ENV FRONTEND_BASE_URL=http://localhost:2121
ENV BACKEND_BASE_URL=http://localhost:3000
ENV FILE_SERVER_URL=http://fileserver:80
ENV FILE_SERVER_ROOT=/var/www/html
ENV SMTP_HOST=smtp.office365.com
ENV SMTP_PORT=587
ENV SMTP_USER=logistics@gelymar.com
ENV NETWORK_USER=softkey
ENV NETWORK_PASSWORD=sK06.2025$#
ENV NETWORK_SERVER=172.20.10.167
ENV NETWORK_SHARE_PATH=Users/above/Documents/BotArchivoWeb/archivos

EXPOSE 3000
CMD ["npm", "start"]
