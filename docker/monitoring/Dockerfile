FROM httpd:2.4-alpine

# Instalar dependencias + tzdata para zona horaria
RUN apk add --no-cache curl jq bash tzdata

# Fijar la zona horaria de Chile
ENV TZ=America/Santiago

# Variables de entorno por defecto
ENV MONITORING_PORT=80
ENV MONITORING_HOST=0.0.0.0

# Crear directorio para el dashboard
RUN mkdir -p /var/www/html

# Copiar archivos del dashboard
COPY index.html /var/www/html/
COPY dashboard.js /var/www/html/
COPY dashboard.css /var/www/html/
COPY login.html /var/www/html/
COPY shell.html /var/www/html/

# Configurar Apache
COPY httpd.conf /usr/local/apache2/conf/httpd.conf

EXPOSE 80

CMD ["httpd-foreground"] 