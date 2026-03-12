# Script para construir todas las imágenes Docker para desarrollo usando docker-compose
# Ejecutar desde el directorio docker

Write-Host "🚀 Iniciando construcción de todas las imágenes Docker para desarrollo..." -ForegroundColor Green

# Limpiar imágenes anteriores para forzar reconstrucción limpia
Write-Host "🧹 Limpiando imágenes anteriores..." -ForegroundColor Yellow
docker rmi nicetm/gelymar-platform:backend nicetm/gelymar-platform:frontend nicetm/gelymar-platform:cron nicetm/gelymar-platform:fileserver nicetm/gelymar-platform:config-manager 2>$null

# Construir todas las imágenes usando docker-compose con archivo .env.local
Write-Host "📦 Construyendo todas las imágenes con docker-compose..." -ForegroundColor Yellow
docker-compose -f docker-compose-dev.yml --env-file .env.local build --no-cache
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Todas las imágenes construidas exitosamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo las imágenes" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 ¡Todas las imágenes han sido construidas exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Imágenes disponibles:" -ForegroundColor Cyan
docker images | Select-String "nicetm/gelymar-platform"
Write-Host ""
Write-Host "🚀 Para probar localmente: docker-compose -f docker-compose-dev.yml --env-file .env.local up -d" -ForegroundColor Cyan
Write-Host "📤 Para subir a DockerHub: .\push-all-dev.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Comandos para construir imágenes individuales:" -ForegroundColor Yellow
Write-Host "   Backend:    docker-compose -f docker-compose-dev.yml --env-file .env.local build --no-cache backend" -ForegroundColor Gray
Write-Host "   Frontend:   docker-compose -f docker-compose-dev.yml --env-file .env.local build --no-cache frontend" -ForegroundColor Gray
Write-Host "   Cron:       docker-compose -f docker-compose-dev.yml --env-file .env.local build --no-cache cron" -ForegroundColor Gray
Write-Host "   Fileserver: docker-compose -f docker-compose-dev.yml --env-file .env.local build --no-cache fileserver" -ForegroundColor Gray
Write-Host "   Config Manager: docker-compose -f docker-compose-dev.yml --env-file .env.local build --no-cache config-manager" -ForegroundColor Gray