FROM node:18-alpine

# Zona horaria (Alpine)
RUN apk add --no-cache tzdata
ENV TZ=America/Santiago

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Los archivos CSS ya están en public/styles/

# Configurar variables de entorno para el build con valores por defecto
ARG PUBLIC_API_URL=http://localhost:3000
ARG PUBLIC_FILE_SERVER_URL=http://localhost:8080
ARG PUBLIC_API_BASE_URL=http://localhost:3000/api
ARG PUBLIC_FRONTEND_BASE_URL=http://localhost:2121
ARG PUBLIC_LANG=en
ARG SITE=http://localhost:2121
ARG BASE_URL=/
ARG REMOTE_ASSETS_BASE_URL=/assets
ARG SERVER_API_URL=http://backend:3000
ARG NODE_ENV=production
ARG CI=false
ARG APP_CONTEXT=both
ARG PUBLIC_APP_CONTEXT=both
ARG PUBLIC_ADMIN_APP_URL=
ARG PUBLIC_CLIENT_APP_URL=
ARG PUBLIC_RECAPTCHA_SITE_KEY=
ARG DEV_PORT=2121
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
ENV PUBLIC_FILE_SERVER_URL=${PUBLIC_FILE_SERVER_URL}
ENV PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL}
ENV PUBLIC_FRONTEND_BASE_URL=${PUBLIC_FRONTEND_BASE_URL}
ENV PUBLIC_LANG=${PUBLIC_LANG}
ENV SITE=${SITE}
ENV BASE_URL=${BASE_URL}
ENV REMOTE_ASSETS_BASE_URL=${REMOTE_ASSETS_BASE_URL}
ENV SERVER_API_URL=${SERVER_API_URL}
ENV NODE_ENV=${NODE_ENV}
ENV CI=${CI}
ENV APP_CONTEXT=${APP_CONTEXT}
ENV PUBLIC_APP_CONTEXT=${PUBLIC_APP_CONTEXT}
ENV PUBLIC_ADMIN_APP_URL=${PUBLIC_ADMIN_APP_URL}
ENV PUBLIC_CLIENT_APP_URL=${PUBLIC_CLIENT_APP_URL}
ENV PUBLIC_RECAPTCHA_SITE_KEY=${PUBLIC_RECAPTCHA_SITE_KEY}
ENV DEV_PORT=${DEV_PORT}

# Hacer build de Astro
RUN if [ "${APP_CONTEXT}" = "client" ]; then npm run build:client; elif [ "${APP_CONTEXT}" = "admin" ]; then npm run build:admin; else npm run build; fi

# Exponer puerto
EXPOSE 2121

# Comando para iniciar la aplicación
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"] 
