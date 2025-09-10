# Script para subir todas las imágenes a DockerHub para producción con tags específicos en PowerShell
# Ejecutar desde el directorio docker

Write-Host "📤 Iniciando subida de todas las imágenes a DockerHub para producción..." -ForegroundColor Green

# Nota: Si no estás logueado en DockerHub, ejecuta: docker login
Write-Host "🔐 Asegúrate de estar logueado en DockerHub (docker login)" -ForegroundColor Yellow

# 1. Backend
Write-Host "📦 Subiendo Backend..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:backend-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Backend" -ForegroundColor Red
    exit 1
}

# 2. Frontend
Write-Host "📦 Subiendo Frontend..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:frontend-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Frontend" -ForegroundColor Red
    exit 1
}

# 3. Cron
Write-Host "📦 Subiendo Cron..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:cron-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cron subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Cron" -ForegroundColor Red
    exit 1
}

# 4. Monitoring
Write-Host "📦 Subiendo Monitoring..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:monitoring-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Monitoring subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Monitoring" -ForegroundColor Red
    exit 1
}

# 5. Fileserver
Write-Host "📦 Subiendo Fileserver..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:fileserver-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fileserver subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Fileserver" -ForegroundColor Red
    exit 1
}

# 6. Terminal
Write-Host "📦 Subiendo Terminal..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:terminal-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Terminal subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Terminal" -ForegroundColor Red
    exit 1
}

# 7. MySQL
Write-Host "📦 Subiendo MySQL..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:mysql-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ MySQL subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo MySQL" -ForegroundColor Red
    exit 1
}

# 8. phpMyAdmin
Write-Host "📦 Subiendo phpMyAdmin..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:phpmyadmin-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ phpMyAdmin subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo phpMyAdmin" -ForegroundColor Red
    exit 1
}

# 9. VPN
Write-Host "📦 Subiendo VPN..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:vpn-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ VPN subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo VPN" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 ¡Todas las imágenes han sido subidas exitosamente a DockerHub!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Repositorio: https://hub.docker.com/r/nicetm/gelymar-platform" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Para desplegar en producción (172.20.10.151):" -ForegroundColor Yellow
Write-Host "   docker-compose -f docker-compose-hub.yml up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 Comandos para subir imágenes individuales:" -ForegroundColor Yellow
Write-Host "   Backend:    docker push nicetm/gelymar-platform:backend-prod" -ForegroundColor Gray
Write-Host "   Frontend:   docker push nicetm/gelymar-platform:frontend-prod" -ForegroundColor Gray
Write-Host "   Cron:       docker push nicetm/gelymar-platform:cron-prod" -ForegroundColor Gray
Write-Host "   Monitoring: docker push nicetm/gelymar-platform:monitoring-prod" -ForegroundColor Gray
Write-Host "   Fileserver: docker push nicetm/gelymar-platform:fileserver-prod" -ForegroundColor Gray
Write-Host "   Terminal:   docker push nicetm/gelymar-platform:terminal-prod" -ForegroundColor Gray
Write-Host "   VPN:        docker push nicetm/gelymar-platform:vpn-prod" -ForegroundColor Gray
Write-Host "   MySQL:      docker push nicetm/gelymar-platform:mysql-prod" -ForegroundColor Gray
Write-Host "   phpMyAdmin: docker push nicetm/gelymar-platform:phpmyadmin-prod" -ForegroundColor Gray
