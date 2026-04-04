FROM php:8.1-apache

# Zona horaria
ENV TZ=America/Santiago

# Variables de entorno para autenticación (con valores por defecto)
ARG FILESERVER_USER=admin
ARG FILESERVER_PASS=lzx7ats.ats
ENV FILESERVER_USER=${FILESERVER_USER}
ENV FILESERVER_PASS=${FILESERVER_PASS}

# Instalar vsftpd y dependencias
RUN apt-get update && apt-get install -y \
    vsftpd \
    openssl \
    tzdata \
    apache2-utils \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio para archivos
RUN mkdir -p /var/www/html/uploads

# Configurar vsftpd
COPY vsftpd.conf /etc/vsftpd/vsftpd.conf

# Configurar Apache (habilitar módulos necesarios)
RUN a2enmod rewrite
RUN a2enmod headers
RUN a2enmod auth_basic
RUN a2enmod authn_file
RUN a2enmod authz_user

# Crear configuración personalizada para habilitar .htaccess
RUN echo '<Directory /var/www/html>' > /etc/apache2/conf-available/htaccess.conf && \
    echo '    AllowOverride All' >> /etc/apache2/conf-available/htaccess.conf && \
    echo '    Require all granted' >> /etc/apache2/conf-available/htaccess.conf && \
    echo '</Directory>' >> /etc/apache2/conf-available/htaccess.conf && \
    a2enconf htaccess

# Configurar ServerName para evitar warnings
RUN echo 'ServerName localhost' >> /etc/apache2/apache2.conf

# Configurar PHP
COPY php.ini /usr/local/etc/php/conf.d/custom.ini

# Copiar archivos web a /tmp primero (para volúmenes persistentes)
COPY .htaccess /tmp/
COPY index.html /tmp/
COPY login.html /tmp/
COPY file-manager.php /tmp/
COPY style.css /tmp/

# Copiar archivos web a /var/www/html (para construcción inicial)
COPY .htaccess /var/www/html/
COPY index.html /var/www/html/
COPY login.html /var/www/html/
COPY file-manager.php /var/www/html/
COPY style.css /var/www/html/

# Verificar que los archivos se copiaron correctamente
RUN ls -la /var/www/html/
RUN ls -la /var/www/html/uploads/

# Configurar permisos
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html
RUN chmod -R 777 /var/www/html/uploads

# Crear usuario daemon para Apache si no existe
RUN (groupadd -g 1 daemon || true) && (useradd -r -u 1 -g daemon daemon || true)

# Copiar entrypoint y asegurar line endings Unix
COPY docker-entrypoint-fileserver.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 80 21 30000-30009

ENTRYPOINT ["/entrypoint.sh"]