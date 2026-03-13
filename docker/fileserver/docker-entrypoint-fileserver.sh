#!/bin/bash
set -e

# Crear usuario FTP (si no existe)
if ! id "ftpuser" &>/dev/null; then
    useradd -m -s /bin/bash ftpuser
    echo "ftpuser:gelymar123" | chpasswd
fi
echo "ftpuser" > /etc/vsftpd.userlist

# No configurar autenticación HTTP básica - usar login web
# Eliminar archivos de autenticación HTTP básica si existen
rm -f /var/www/html/.htpasswd

# Crear .htaccess correcto (sin autenticación HTTP básica)
cat > /var/www/html/.htaccess << 'EOF'
# Configuración CORS
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization"

# Configuración de directorio
Options -Indexes FollowSymLinks
Require all granted

# Bloquear acceso directo a uploads
RewriteEngine On
RewriteRule ^uploads/ - [F,L]

# Habilitar autoindex como respaldo
DirectoryIndex index.php index.html
EOF

# Crear directorios necesarios
mkdir -p /var/www/html/uploads
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html
chmod -R 777 /var/www/html/uploads

# ===== COPIAR ARCHIVOS CORRECTOS AL INICIAR =====
# Esto asegura que los archivos correctos estén siempre presentes,
# incluso si hay un volumen persistente que sobrescribe los archivos

# Copiar index.html correcto (que redirige a login.html)
cat > /var/www/html/index.html << 'EOF'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0; url=login.html">
    <title>Gelymar File Server - Redirigiendo...</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>🚀 Gelymar File Server</h2>
        <div class="spinner"></div>
        <p>Redirigiendo al login...</p>
        <p><a href="login.html">Si no eres redirigido automáticamente, haz clic aquí</a></p>
    </div>
</body>
</html>
EOF

# Eliminar index.php si existe (para evitar conflictos)
rm -f /var/www/html/index.php

# Copiar archivos web (siempre actualizar)
echo "Copiando login.html..."
cp /tmp/login.html /var/www/html/login.html 2>/dev/null || echo "login.html no encontrado en /tmp"

echo "Copiando file-manager.php..."
cp /tmp/file-manager.php /var/www/html/file-manager.php 2>/dev/null || echo "file-manager.php no encontrado en /tmp"

if [ ! -f /var/www/html/style.css ]; then
    echo "Copiando style.css..."
    cp /tmp/style.css /var/www/html/style.css 2>/dev/null || echo "style.css no encontrado en /tmp"
fi

# Bloquear acceso directo a uploads con .htaccess
cat > /var/www/html/uploads/.htaccess << 'EOF'
Options -Indexes
DirectoryIndex disabled
Require all denied
EOF

# Crear archivo de configuración con variables de entorno
cat > /var/www/html/config.js << EOF
window.APP_CONFIG = {
    BACKEND_BASE_URL: '${BACKEND_BASE_URL}'
};
EOF

# Asegurar permisos correctos después de copiar archivos
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html
chmod -R 777 /var/www/html/uploads

# Iniciar vsftpd en background
vsftpd /etc/vsftpd/vsftpd.conf &

# Iniciar Apache
apache2-foreground
