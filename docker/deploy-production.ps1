# Script para desplegar la plataforma en producción desde DockerHub
# Ejecutar en el servidor de producción (172.20.10.151)
# Este script descarga las imágenes más recientes y levanta los servicios

Write-Host "🚀 Iniciando despliegue de producción desde DockerHub..." -ForegroundColor Green

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "docker-compose-hub.yml")) {
    Write-Host "❌ Error: No se encontró docker-compose-hub.yml" -ForegroundColor Red
    Write-Host "   Asegúrate de ejecutar este script desde el directorio docker/" -ForegroundColor Yellow
    exit 1
}

# Verificar que existe el archivo de configuración
if (-not (Test-Path ".env.server")) {
    Write-Host "❌ Error: No se encontró .env.server" -ForegroundColor Red
    Write-Host "   Asegúrate de tener el archivo de configuración de producción" -ForegroundColor Yellow
    exit 1
}

# Descargar las imágenes más recientes desde DockerHub
Write-Host "📥 Descargando imágenes desde DockerHub..." -ForegroundColor Yellow

$images = @(
    "nicetm/gelymar-platform:mysql-prod",
    "nicetm/gelymar-platform:fileserver-prod", 
    "nicetm/gelymar-platform:backend-prod",
    "nicetm/gelymar-platform:frontend-prod",
    "nicetm/gelymar-platform:frontend-client-prod",
    "nicetm/gelymar-platform:cron-prod",
    "nicetm/gelymar-platform:terminal-prod",
    "nicetm/gelymar-platform:phpmyadmin-prod"
)

foreach ($image in $images) {
    Write-Host "   📦 Descargando $image..." -ForegroundColor Gray
    docker pull $image
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error descargando $image" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Todas las imágenes descargadas exitosamente" -ForegroundColor Green

# Levantar los servicios
Write-Host "🚀 Levantando servicios de producción..." -ForegroundColor Yellow
docker compose -f docker-compose-hub.yml --env-file .env.server up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Servicios levantados exitosamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error levantando los servicios" -ForegroundColor Red
    exit 1
}

# Verificar estado de los servicios
Write-Host "🔍 Verificando estado de los servicios..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

docker compose -f docker-compose-hub.yml ps

Write-Host ""
Write-Host "🎉 ¡Despliegue completado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "?? Servicios disponibles:" -ForegroundColor Cyan
Write-Host "   ?? Frontend (admin):   http://172.20.10.151:2121" -ForegroundColor White
Write-Host "   ?? Frontend (cliente): http://172.20.10.151:2122" -ForegroundColor White
Write-Host "   🔧 Backend API:  http://172.20.10.151:3000" -ForegroundColor White
Write-Host "   📁 File Server:  http://172.20.10.151:8080" -ForegroundColor White
Write-Host "   🗄️  phpMyAdmin:   http://172.20.10.151:8081" -ForegroundColor White
Write-Host "   💻 Terminal:     http://172.20.10.151:7682" -ForegroundColor White
Write-Host "   ⚙️  PM2 Monitor:  http://172.20.10.151:9615" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Comandos útiles:" -ForegroundColor Yellow
Write-Host "   Ver logs:        docker compose -f docker-compose-hub.yml logs -f [servicio]" -ForegroundColor Gray
Write-Host "   Reiniciar:       docker compose -f docker-compose-hub.yml restart [servicio]" -ForegroundColor Gray
Write-Host "   Estado:          docker compose -f docker-compose-hub.yml ps" -ForegroundColor Gray
