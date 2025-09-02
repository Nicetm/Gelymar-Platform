FROM php:8.1-apache

# Instalar vsftpd y dependencias
RUN apt-get update && apt-get install -y \
    vsftpd \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio para archivos
RUN mkdir -p /var/www/html/uploads

# Configurar vsftpd
COPY vsftpd.conf /etc/vsftpd/vsftpd.conf

# Configurar Apache (habilitar módulos necesarios)
RUN a2enmod rewrite
RUN a2enmod headers

# Configurar PHP
COPY php.ini /usr/local/etc/php/conf.d/custom.ini

# Copiar archivos web
COPY index.html /var/www/html/
COPY file-manager.php /var/www/html/
COPY style.css /var/www/html/
COPY .htaccess /var/www/html/
COPY uploads-htaccess /var/www/html/uploads/.htaccess

# Verificar que los archivos se copiaron correctamente
RUN ls -la /var/www/html/

# Configurar permisos
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html
RUN chmod -R 777 /var/www/html/uploads

# Script de inicio
COPY docker-entrypoint-fileserver.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 21 30000-30009

ENTRYPOINT ["/entrypoint.sh"]