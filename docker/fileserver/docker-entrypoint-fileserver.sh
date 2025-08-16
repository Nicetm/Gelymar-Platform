#!/bin/bash
set -e

echo "Iniciando File Server..."

# Crear usuario FTP (si no existe)
if ! id "ftpuser" &>/dev/null; then
    adduser -D -s /bin/bash ftpuser
    echo "ftpuser:gelymar123" | chpasswd
    echo "Usuario ftpuser creado"
else
    echo "Usuario ftpuser ya existe"
fi
echo "ftpuser" > /etc/vsftpd.userlist

# Crear directorios necesarios
mkdir -p /var/www/html/uploads
chown -R ftpuser:ftpuser /var/www/html/uploads
chmod -R 755 /var/www/html/uploads
echo "Directorios configurados"

# Iniciar vsftpd en background
echo "Iniciando vsftpd..."
vsftpd /etc/vsftpd/vsftpd.conf &

# Iniciar Apache
echo "Iniciando Apache..."
httpd-foreground 