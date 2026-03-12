FROM mysql:8.0

# Copiar scripts de inicialización
COPY init/ /docker-entrypoint-initdb.d/

# Copiar configuración personalizada
COPY my.cnf /etc/mysql/conf.d/custom.cnf

# Configuración adicional si es necesaria
ENV MYSQL_ROOT_PASSWORD=root123456
ENV MYSQL_DATABASE=gelymar

# Configurar MySQL para reducir logs
ENV MYSQL_LOG_QUERIES=0
ENV MYSQL_LOG_SLOW_QUERIES=0

# Exponer puerto
EXPOSE 3306 