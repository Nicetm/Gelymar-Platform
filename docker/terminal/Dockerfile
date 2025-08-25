FROM alpine:latest

# Instalar dependencias
RUN apk add --no-cache bash curl docker-cli ttyd

# Crear directorio de trabajo
WORKDIR /app

# Script para manejar conexiones a contenedores
COPY terminal/terminal-manager.sh /app/
RUN chmod +x /app/terminal-manager.sh

# Exponer puerto
EXPOSE 7681

# Iniciar ttyd sin autenticación (la autenticación será en el script)
CMD ["ttyd", "-p", "7681", "-W", "/app/terminal-manager.sh"] 