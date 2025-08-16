FROM golang:alpine AS builder

# Instalar gotty
RUN go install github.com/sorenisanerd/gotty@latest

FROM alpine:latest

# Instalar dependencias
RUN apk add --no-cache bash curl docker-cli

# Copiar gotty desde el builder
COPY --from=builder /go/bin/gotty /usr/local/bin/gotty

# Crear directorio de trabajo
WORKDIR /app

# Script para manejar conexiones a contenedores
COPY terminal/terminal-manager.sh /app/
RUN chmod +x /app/terminal-manager.sh

# Exponer puerto
EXPOSE 7681

# Iniciar gotty con el script
CMD ["gotty", "--port", "7681", "--permit-write", "--credential", "admin:gelymar2024", "/app/terminal-manager.sh"] 