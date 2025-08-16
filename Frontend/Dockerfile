FROM node:18-alpine

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Configurar variables de entorno para el build
ARG PUBLIC_API_URL
ARG PUBLIC_FILE_SERVER_URL
ARG SERVER_API_URL
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
ENV PUBLIC_FILE_SERVER_URL=${PUBLIC_FILE_SERVER_URL}
ENV SERVER_API_URL=${SERVER_API_URL}

# Hacer build de Astro
RUN npm run build

# Exponer puerto
EXPOSE 2121

# Comando para iniciar la aplicación
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"] 