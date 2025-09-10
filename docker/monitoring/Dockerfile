FROM httpd:2.4-alpine

# Instalar dependencias + tzdata para zona horaria
RUN apk add --no-cache curl jq bash tzdata

# Configurar zona horaria Chile
ENV TZ=America/Santiago

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