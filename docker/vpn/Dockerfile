FROM debian:bullseye-slim

# Instalar dependencias del sistema
RUN apt-get update && \
    apt-get install -y \
    openfortivpn \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio para configuración
RUN mkdir -p /etc/openfortivpn

# Script de inicio
COPY docker-entrypoint-vpn.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint-vpn.sh

# Exponer puerto (si es necesario)
EXPOSE 443

# Comando por defecto
ENTRYPOINT ["/usr/local/bin/docker-entrypoint-vpn.sh"]
