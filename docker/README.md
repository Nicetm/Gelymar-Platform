# 🐳 Docker Setup - Gelymar Platform

Esta carpeta contiene toda la configuración de Docker para la plataforma Gelymar.

## 📁 Estructura

```
docker/
├── docker-compose.yml          # Configuración principal
├── apache/                     # Configuración Apache
│   ├── conf/
│   │   ├── httpd.conf         # Configuración Apache
│   │   └── extra/
│   │       └── ssl.conf       # Configuración SSL
│   ├── htdocs/                # Documentos web
│   └── logs/                  # Logs de Apache
├── mysql/
│   └── init/
│       └── 01-init.sql        # Script de inicialización
├── php/
│   └── php.ini                # Configuración PHP
├── phpmyadmin/
│   ├── config.user.inc.php    # Configuración phpMyAdmin
│   └── php.ini                # Configuración PHP para phpMyAdmin
├── README-Docker.md           # Documentación completa
└── .dockerignore              # Archivos a ignorar
```

## 🚀 Uso

### Desde la carpeta docker:
```bash
cd docker

# Levantar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

### Desde la raíz del proyecto:
```bash
# Levantar servicios
docker-compose -f docker/docker-compose.yml up -d

# Ver logs
docker-compose -f docker/docker-compose.yml logs -f

# Detener servicios
docker-compose -f docker/docker-compose.yml down
```

## 🌐 Servicios Disponibles

- **Apache:** http://localhost:80
- **phpMyAdmin:** http://localhost:8080
- **MySQL:** localhost:3306

## 📋 Credenciales

- **MySQL Root:** root / root123456
- **MySQL App:** gelymar_user / gelymar123456
- **phpMyAdmin:** root / root123456

## 📖 Documentación Completa

Ver `README-Docker.md` para documentación detallada.

## ⏰ Cron Jobs - Ejecución Manual

Para ejecutar los cron jobs en orden específico, usar los siguientes comandos:

### Orden de ejecución:
1. **gelymar-clean-db** - Limpia base de datos y directorios
2. **gelymar-client-fetcher** - Procesa archivos de clientes
3. **gelymar-item-fetcher** - Procesa archivos de productos
4. **gelymar-order-fetcher** - Procesa archivos de órdenes
5. **gelymar-orderline-fetcher** - Procesa líneas de órdenes
6. **gelymar-defaultfiles-generator** - Genera archivos por defecto
7. **gelymar-etd-checker** - Verifica ETD

### Comandos de ejecución manual:

```bash
# 1. Limpiar base de datos
pm2 start ecosystem.config.js --only gelymar-clean-db

# 2. Procesar clientes
pm2 start ecosystem.config.js --only gelymar-client-fetcher

# 3. Procesar productos
pm2 start ecosystem.config.js --only gelymar-item-fetcher

# 4. Procesar órdenes
pm2 start ecosystem.config.js --only gelymar-order-fetcher

# 5. Procesar líneas de órdenes
pm2 start ecosystem.config.js --only gelymar-orderline-fetcher

# 6. Generar archivos por defecto
pm2 start ecosystem.config.js --only gelymar-defaultfiles-generator

# 7. Verificar ETD
pm2 start ecosystem.config.js --only gelymar-etd-checker
```

### Ver logs de un proceso específico:
```bash
pm2 logs gelymar-clean-db
pm2 logs gelymar-client-fetcher
pm2 logs gelymar-item-fetcher
pm2 logs gelymar-order-fetcher
pm2 logs gelymar-orderline-fetcher
pm2 logs gelymar-defaultfiles-generator
pm2 logs gelymar-etd-checker
```

### Comandos útiles:
```bash
# Ver todos los procesos
pm2 list

# Detener todos los procesos
pm2 delete all

# Reiniciar un proceso específico
pm2 restart gelymar-item-fetcher
``` 