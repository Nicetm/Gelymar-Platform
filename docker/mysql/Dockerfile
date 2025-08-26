FROM mysql:8.0

# Copiar scripts de inicialización
COPY init/ /docker-entrypoint-initdb.d/

# Configuración adicional si es necesaria
ENV MYSQL_ROOT_PASSWORD=root123456
ENV MYSQL_DATABASE=gelymar

# Exponer puerto
EXPOSE 3306 