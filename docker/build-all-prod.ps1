# Script para construir todas las imágenes Docker para producción usando docker-compose
# Ejecutar desde el directorio docker

Write-Host "🚀 Iniciando construcción de todas las imágenes Docker para producción..." -ForegroundColor Green

# Limpiar imágenes anteriores para forzar reconstrucción limpia
Write-Host "🧹 Limpiando imágenes anteriores..." -ForegroundColor Yellow
docker rmi nicetm/gelymar-platform:mysql-prod nicetm/gelymar-platform:fileserver-prod nicetm/gelymar-platform:backend-prod nicetm/gelymar-platform:frontend-prod nicetm/gelymar-platform:frontend-client-prod nicetm/gelymar-platform:cron-prod nicetm/gelymar-platform:config-manager-prod nicetm/gelymar-platform:phpmyadmin-prod 2>$null

# 1. MySQL (etiquetar imagen existente)
Write-Host "📦 Etiquetando MySQL..." -ForegroundColor Yellow
docker tag mysql:8.0 nicetm/gelymar-platform:mysql-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ MySQL etiquetado" -ForegroundColor Green
} else {
    Write-Host "❌ Error etiquetando MySQL" -ForegroundColor Red
    exit 1
}

# 2. phpMyAdmin (etiquetar imagen existente)
Write-Host "📦 Etiquetando phpMyAdmin..." -ForegroundColor Yellow
docker tag phpmyadmin:5.2.1 nicetm/gelymar-platform:phpmyadmin-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ phpMyAdmin etiquetado" -ForegroundColor Green
} else {
    Write-Host "❌ Error etiquetando phpMyAdmin" -ForegroundColor Red
    exit 1
}

# Construir todas las imágenes usando docker-compose con archivo .env.production
Write-Host "📦 Construyendo todas las imágenes con docker-compose..." -ForegroundColor Yellow
docker-compose -f docker-compose-prod.yml --env-file .env.production build --no-cache
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Todas las imágenes construidas exitosamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo las imágenes" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 ¡Todas las imágenes han sido construidas exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Imágenes disponibles:" -ForegroundColor Cyan
docker images | Select-String "nicetm/gelymar-platform.*prod"
Write-Host ""
Write-Host "🚀 Para probar en producción: docker compose -f docker-compose-prod.yml --env-file .env.production up -d" -ForegroundColor Cyan
Write-Host "📤 Para subir a DockerHub: .\push-all-prod.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Comandos para construir imágenes individuales:" -ForegroundColor Yellow
Write-Host "   MySQL:      docker tag mysql:8.0 nicetm/gelymar-platform:mysql-prod" -ForegroundColor Gray
Write-Host "   Fileserver: docker-compose -f docker-compose-prod.yml --env-file .env.production build --no-cache fileserver" -ForegroundColor Gray
Write-Host "   Backend:    docker-compose -f docker-compose-prod.yml --env-file .env.production build --no-cache backend" -ForegroundColor Gray
Write-Host "   Frontend (admin): docker-compose -f docker-compose-prod.yml --env-file .env.production build --no-cache frontend" -ForegroundColor Gray
Write-Host "   Frontend (cliente): docker-compose -f docker-compose-prod.yml --env-file .env.production build --no-cache frontend-client" -ForegroundColor Gray
Write-Host "   Cron:       docker-compose -f docker-compose-prod.yml --env-file .env.production build --no-cache cron" -ForegroundColor Gray
Write-Host "   Config Manager: docker-compose -f docker-compose-prod.yml --env-file .env.production build --no-cache config-manager" -ForegroundColor Gray
Write-Host "   phpMyAdmin: docker tag phpmyadmin/phpmyadmin:latest nicetm/gelymar-platform:phpmyadmin-prod" -ForegroundColor Gray
