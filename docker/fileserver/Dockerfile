FROM httpd:2.4-alpine

# Instalar vsftpd y dependencias
RUN apk add --no-cache vsftpd openssl bash

# Crear directorio para archivos
RUN mkdir -p /var/www/html/uploads

# Configurar vsftpd
COPY vsftpd.conf /etc/vsftpd/vsftpd.conf

# Configurar Apache
COPY httpd.conf /usr/local/apache2/conf/httpd.conf

# Copiar archivos web
COPY index.html /var/www/html/
COPY style.css /var/www/html/
COPY .htaccess /var/www/html/uploads/

# Script de inicio
COPY docker-entrypoint-fileserver.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 21 30000-30009

ENTRYPOINT ["/entrypoint.sh"] 