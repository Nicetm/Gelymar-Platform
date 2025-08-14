# Docker Compose Setup - Gelymar Platform

Este Docker Compose incluye Apache 2.4, MySQL 8.0 y PHP 8.2-FPM configurados para desarrollo y producción.

## 🚀 Servicios Incluidos

- **MySQL 8.0**: Base de datos con configuración optimizada
- **Apache 2.4**: Servidor web con SSL y configuraciones de seguridad
- **PHP 8.2-FPM**: Procesador PHP con opcache habilitado

## 📋 Requisitos Previos

- Docker Desktop instalado
- Docker Compose v2.0+
- Al menos 4GB de RAM disponible

## 🛠️ Instalación y Uso

### 1. Levantar los servicios

```bash
# Desde la carpeta Backend
docker-compose up -d
```

### 2. Verificar el estado

```bash
# Ver logs en tiempo real
docker-compose logs -f

# Ver estado de los servicios
docker-compose ps
```

### 3. Acceder a los servicios

- **Apache HTTP**: http://localhost:80
- **Apache HTTPS**: https://localhost:443 (requiere certificados SSL)
- **MySQL**: localhost:3306

### 4. Credenciales de Base de Datos

```bash
# Root
Host: localhost:3306
User: root
Password: root123456

# Usuario de aplicación
Host: localhost:3306
Database: gelymar_db
User: gelymar_user
Password: gelymar123456

# Usuario adicional (opcional)
User: gelymar_app
Password: app123456
```

## 🔧 Configuración

### Variables de Entorno

Puedes modificar las credenciales editando el archivo `docker-compose.yml`:

```yaml
environment:
  MYSQL_ROOT_PASSWORD: tu_password_root
  MYSQL_DATABASE: tu_base_de_datos
  MYSQL_USER: tu_usuario
  MYSQL_PASSWORD: tu_password
```

### Puertos

Los puertos están mapeados de la siguiente manera:

- **80**: Apache HTTP
- **443**: Apache HTTPS
- **3306**: MySQL

Para cambiar los puertos, modifica la sección `ports` en `docker-compose.yml`.

## 📁 Estructura de Archivos

```
Backend/
├── docker-compose.yml          # Configuración principal
├── apache/
│   ├── conf/
│   │   ├── httpd.conf         # Configuración Apache
│   │   └── extra/
│   │       └── ssl.conf       # Configuración SSL
│   ├── htdocs/                # Documentos web
│   └── logs/                  # Logs de Apache
├── mysql/
│   └── init/
│       └── 01-init.sql        # Script de inicialización
└── php/
    └── php.ini                # Configuración PHP
```

## 🔒 Seguridad

### Headers de Seguridad

Apache incluye headers de seguridad modernos:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

### SSL/TLS

Configuración SSL moderna con:

- TLS 1.2 y 1.3 habilitados
- Cipher suites seguros
- HSTS habilitado
- Redirección automática HTTP → HTTPS

## 🐛 Troubleshooting

### Problemas Comunes

1. **Puerto 3306 ocupado**:
   ```bash
   # Cambiar puerto en docker-compose.yml
   ports:
     - "3307:3306"  # Usar puerto 3307 en lugar de 3306
   ```

2. **Permisos de archivos**:
   ```bash
   # Dar permisos a las carpetas
   chmod -R 755 apache/
   chmod -R 755 mysql/
   ```

3. **MySQL no inicia**:
   ```bash
   # Ver logs específicos
   docker-compose logs mysql
   
   # Reiniciar solo MySQL
   docker-compose restart mysql
   ```

### Comandos Útiles

```bash
# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (¡CUIDADO! Elimina datos)
docker-compose down -v

# Reconstruir imágenes
docker-compose build --no-cache

# Ver logs de un servicio específico
docker-compose logs apache
docker-compose logs mysql
docker-compose logs php

# Acceder al contenedor MySQL
docker-compose exec mysql mysql -u root -p

# Acceder al contenedor Apache
docker-compose exec apache bash
```

## 📊 Monitoreo

### Health Checks

MySQL incluye health check automático que verifica que el servicio esté funcionando correctamente.

### Logs

Los logs se almacenan en:
- **Apache**: `apache/logs/`
- **MySQL**: `docker-compose logs mysql`

## 🔄 Actualizaciones

Para actualizar las imágenes:

```bash
# Actualizar imágenes
docker-compose pull

# Recrear contenedores
docker-compose up -d --force-recreate
```

## 📝 Notas Adicionales

- Los datos de MySQL se persisten en un volumen Docker
- Apache está configurado para servir archivos estáticos y PHP
- PHP-FPM está optimizado para rendimiento con opcache
- SSL está configurado pero requiere certificados para funcionar

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs: `docker-compose logs`
2. Verifica la conectividad de red
3. Asegúrate de que los puertos no estén ocupados
4. Revisa los permisos de archivos 