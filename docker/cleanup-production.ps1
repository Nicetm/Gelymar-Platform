# Script para limpiar contenedores y volúmenes de producción (EXCEPTO MySQL)
# Ejecutar en el servidor de producción (172.20.10.151)
# ⚠️  IMPORTANTE: Este script NO toca MySQL ni sus datos

Write-Host "🧹 Iniciando limpieza de contenedores y volúmenes de producción..." -ForegroundColor Yellow
Write-Host "⚠️  MySQL y sus datos NO serán afectados" -ForegroundColor Green

# Detener todos los contenedores excepto MySQL
Write-Host "🛑 Deteniendo contenedores (excepto MySQL)..." -ForegroundColor Yellow
docker stop gelymar-platform-fileserver-prod gelymar-platform-backend-prod gelymar-platform-frontend-prod gelymar-platform-frontend-client-prod gelymar-platform-cron-prod gelymar-platform-phpmyadmin-prod gelymar-platform-terminal-prod 2>$null

# Eliminar contenedores excepto MySQL
Write-Host "🗑️  Eliminando contenedores (excepto MySQL)..." -ForegroundColor Yellow
docker rm gelymar-platform-fileserver-prod gelymar-platform-backend-prod gelymar-platform-frontend-prod gelymar-platform-frontend-client-prod gelymar-platform-cron-prod gelymar-platform-phpmyadmin-prod gelymar-platform-terminal-prod 2>$null

# Eliminar volúmenes excepto mysql_data
Write-Host "🗑️  Eliminando volúmenes (excepto mysql_data)..." -ForegroundColor Yellow
docker volume rm gelymar-platform_fileserver_data 2>$null
docker volume rm gelymar-platform_backend_logs 2>$null
docker volume rm gelymar-platform_cron_logs 2>$null
docker volume rm gelymar-platform_cron_pm2 2>$null

# Limpiar imágenes de producción (excepto MySQL)
Write-Host "🗑️  Eliminando imágenes de producción (excepto MySQL)..." -ForegroundColor Yellow
docker rmi nicetm/gelymar-platform:fileserver-prod 2>$null
docker rmi nicetm/gelymar-platform:backend-prod 2>$null
docker rmi nicetm/gelymar-platform:frontend-prod 2>$null
docker rmi nicetm/gelymar-platform:frontend-client-prod 2>$null
docker rmi nicetm/gelymar-platform:cron-prod 2>$null
docker rmi nicetm/gelymar-platform:terminal-prod 2>$null
docker rmi nicetm/gelymar-platform:phpmyadmin-prod 2>$null

# Limpiar imágenes huérfanas
Write-Host "🧹 Limpiando imágenes huérfanas..." -ForegroundColor Yellow
docker image prune -f

Write-Host "✅ Limpieza completada exitosamente" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Estado actual:" -ForegroundColor Cyan
Write-Host "   ✅ MySQL: Conservado con todos sus datos" -ForegroundColor Green
Write-Host "   🗑️  Otros servicios: Eliminados" -ForegroundColor Yellow
Write-Host ""
Write-Host "🚀 Próximo paso: Ejecutar deploy-production.ps1" -ForegroundColor Cyan
