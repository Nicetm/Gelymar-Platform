FROM httpd:2.4-alpine

# Instalar dependencias
RUN apk add --no-cache curl jq bash

# Crear directorio para el dashboard
RUN mkdir -p /var/www/html

# Copiar archivos del dashboard
COPY monitoring/index.html /var/www/html/
COPY monitoring/dashboard.js /var/www/html/
COPY monitoring/dashboard.css /var/www/html/
COPY monitoring/login.html /var/www/html/
COPY monitoring/shell.html /var/www/html/

# Configurar Apache
COPY monitoring/httpd.conf /usr/local/apache2/conf/httpd.conf

EXPOSE 80

CMD ["httpd-foreground"] 