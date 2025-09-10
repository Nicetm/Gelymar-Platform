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
RUN mkdir -p uploads /mnt/red

EXPOSE 3000
CMD ["npm", "start"]
