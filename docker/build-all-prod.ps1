# Script para construir todas las imágenes Docker para producción con tags específicos en PowerShell
# Ejecutar desde el directorio docker

Write-Host "🚀 Iniciando construcción de todas las imágenes Docker para producción..." -ForegroundColor Green

# Limpiar imágenes anteriores para forzar reconstrucción limpia
Write-Host "🧹 Limpiando imágenes anteriores..." -ForegroundColor Yellow
docker rmi nicetm/gelymar-platform:backend-prod nicetm/gelymar-platform:frontend-prod nicetm/gelymar-platform:cron-prod nicetm/gelymar-platform:monitoring-prod nicetm/gelymar-platform:fileserver-prod nicetm/gelymar-platform:terminal-prod nicetm/gelymar-platform:mysql-prod nicetm/gelymar-platform:phpmyadmin-prod nicetm/gelymar-platform:vpn-prod 2>$null

# 1. Backend
Write-Host "📦 Construyendo Backend..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:backend-prod -f ../Backend/Dockerfile ../Backend
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Backend" -ForegroundColor Red
    exit 1
}

# 2. Frontend
Write-Host "📦 Construyendo Frontend..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:frontend-prod -f ../Frontend/Dockerfile ../Frontend
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Frontend" -ForegroundColor Red
    exit 1
}

# 3. Cron
Write-Host "📦 Construyendo Cron..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:cron-prod -f cron/Dockerfile ..
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cron construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Cron" -ForegroundColor Red
    exit 1
}

# 4. Monitoring
Write-Host "📦 Construyendo Monitoring..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:monitoring-prod -f Dockerfile.monitoring .
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Monitoring construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Monitoring" -ForegroundColor Red
    exit 1
}

# 5. Fileserver
Write-Host "📦 Construyendo Fileserver..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:fileserver-prod -f fileserver/Dockerfile fileserver
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fileserver construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Fileserver" -ForegroundColor Red
    exit 1
}

# 6. Terminal
Write-Host "📦 Construyendo Terminal..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:terminal-prod -f Dockerfile.terminal .
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Terminal construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Terminal" -ForegroundColor Red
    exit 1
}

# 7. MySQL (etiquetar imagen existente)
Write-Host "📦 Etiquetando MySQL..." -ForegroundColor Yellow
docker tag mysql:8.0 nicetm/gelymar-platform:mysql-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ MySQL etiquetado" -ForegroundColor Green
} else {
    Write-Host "❌ Error etiquetando MySQL" -ForegroundColor Red
    exit 1
}

# 8. phpMyAdmin (etiquetar imagen existente)
Write-Host "📦 Etiquetando phpMyAdmin..." -ForegroundColor Yellow
docker tag phpmyadmin/phpmyadmin:latest nicetm/gelymar-platform:phpmyadmin-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ phpMyAdmin etiquetado" -ForegroundColor Green
} else {
    Write-Host "❌ Error etiquetando phpMyAdmin" -ForegroundColor Red
    exit 1
}

# 9. VPN
Write-Host "📦 Construyendo VPN..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:vpn-prod -f vpn/Dockerfile vpn
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ VPN construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo VPN" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 ¡Todas las imágenes han sido construidas exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Imágenes disponibles:" -ForegroundColor Cyan
docker images | Select-String "nicetm/gelymar-platform.*prod"
Write-Host ""
Write-Host "🚀 Para probar en producción: docker-compose -f docker-compose-hub.yml up -d" -ForegroundColor Cyan
Write-Host "📤 Para subir a DockerHub: .\push-all-prod.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Comandos para construir imágenes individuales:" -ForegroundColor Yellow
Write-Host "   Backend:    docker build --no-cache -t nicetm/gelymar-platform:backend-prod -f ../Backend/Dockerfile ../Backend" -ForegroundColor Gray
Write-Host "   Frontend:   docker build --no-cache -t nicetm/gelymar-platform:frontend-prod -f ../Frontend/Dockerfile ../Frontend" -ForegroundColor Gray
Write-Host "   Cron:       docker build --no-cache -t nicetm/gelymar-platform:cron-prod -f cron/Dockerfile .." -ForegroundColor Gray
Write-Host "   Monitoring: docker build --no-cache -t nicetm/gelymar-platform:monitoring-prod -f Dockerfile.monitoring ." -ForegroundColor Gray
Write-Host "   Fileserver: docker build --no-cache -t nicetm/gelymar-platform:fileserver-prod -f fileserver/Dockerfile fileserver" -ForegroundColor Gray
Write-Host "   Terminal:   docker build --no-cache -t nicetm/gelymar-platform:terminal-prod -f Dockerfile.terminal ." -ForegroundColor Gray
Write-Host "   VPN:        docker build --no-cache -t nicetm/gelymar-platform:vpn-prod -f vpn/Dockerfile vpn" -ForegroundColor Gray
Write-Host "   MySQL:      docker tag mysql:8.0 nicetm/gelymar-platform:mysql-prod" -ForegroundColor Gray
Write-Host "   phpMyAdmin: docker tag phpmyadmin/phpmyadmin:latest nicetm/gelymar-platform:phpmyadmin-prod" -ForegroundColor Gray
