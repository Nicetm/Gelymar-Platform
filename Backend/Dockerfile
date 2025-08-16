FROM node:18-alpine

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Instalar PM2 globalmente
RUN npm install -g pm2

# Copiar código fuente
COPY . .

# Crear directorio para uploads si no existe
RUN mkdir -p uploads

# Exponer puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "start"] 