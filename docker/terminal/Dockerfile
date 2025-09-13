FROM alpine:latest

# Dependencias + tzdata para zona horaria
RUN apk add --no-cache bash curl docker-cli ttyd tzdata
ENV TZ=America/Santiago

# Variables de entorno por defecto
ENV TERMINAL_PORT=7681
ENV TERMINAL_HOST=0.0.0.0
ENV TERMINAL_USER=admin
ENV TERMINAL_PASS=admin123

WORKDIR /app

# Script para manejar conexiones a contenedores
COPY terminal-manager.sh /app/
RUN chmod +x /app/terminal-manager.sh

# Copiar archivos del terminal web
COPY index.html /app/

# Script de entrada sin autenticación de ttyd
RUN echo '#!/bin/bash' > /app/entrypoint.sh && \
    echo 'ttyd -p ${TERMINAL_PORT:-7681} --writable bash /app/terminal-manager.sh' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 7681

CMD ["/app/entrypoint.sh"] 