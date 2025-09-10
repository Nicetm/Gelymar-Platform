# Script para construir todas las imágenes Docker en PowerShell
# Ejecutar desde el directorio docker

Write-Host "🚀 Iniciando construcción de todas las imágenes Docker..." -ForegroundColor Green

# Limpiar imágenes anteriores para forzar reconstrucción limpia
Write-Host "🧹 Limpiando imágenes anteriores..." -ForegroundColor Yellow
docker rmi nicetm/gelymar-platform:backend nicetm/gelymar-platform:frontend nicetm/gelymar-platform:cron nicetm/gelymar-platform:monitoring nicetm/gelymar-platform:fileserver nicetm/gelymar-platform:terminal nicetm/gelymar-platform:vpn 2>$null

# 1. Backend
Write-Host "📦 Construyendo Backend..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:backend -f ../Backend/Dockerfile ../Backend
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Backend" -ForegroundColor Red
    exit 1
}

# 2. Frontend
Write-Host "📦 Construyendo Frontend..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:frontend -f ../Frontend/Dockerfile ../Frontend
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Frontend" -ForegroundColor Red
    exit 1
}

# 3. Cron
Write-Host "📦 Construyendo Cron..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:cron -f cron/Dockerfile ..
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cron construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Cron" -ForegroundColor Red
    exit 1
}

# 4. Monitoring
Write-Host "📦 Construyendo Monitoring..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:monitoring -f Dockerfile.monitoring .
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Monitoring construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Monitoring" -ForegroundColor Red
    exit 1
}

# 5. Fileserver
Write-Host "📦 Construyendo Fileserver..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:fileserver -f fileserver/Dockerfile fileserver
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fileserver construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Fileserver" -ForegroundColor Red
    exit 1
}

# 6. Terminal
Write-Host "📦 Construyendo Terminal..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:terminal -f Dockerfile.terminal .
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Terminal construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo Terminal" -ForegroundColor Red
    exit 1
}

# 7. VPN
Write-Host "📦 Construyendo VPN..." -ForegroundColor Yellow
docker build --no-cache -t nicetm/gelymar-platform:vpn -f vpn/Dockerfile vpn
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ VPN construido" -ForegroundColor Green
} else {
    Write-Host "❌ Error construyendo VPN" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 ¡Todas las imágenes han sido construidas exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Imágenes disponibles:" -ForegroundColor Cyan
docker images | Select-String "nicetm/gelymar-platform"
Write-Host ""
Write-Host "🚀 Para probar localmente: docker-compose up -d" -ForegroundColor Cyan
Write-Host "📤 Para subir a DockerHub: .\push-all.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Comandos para construir imágenes individuales:" -ForegroundColor Yellow
Write-Host "   Backend:    docker build --no-cache -t nicetm/gelymar-platform:backend -f ../Backend/Dockerfile ../Backend" -ForegroundColor Gray
Write-Host "   Frontend:   docker build --no-cache -t nicetm/gelymar-platform:frontend -f ../Frontend/Dockerfile ../Frontend" -ForegroundColor Gray
Write-Host "   Cron:       docker build --no-cache -t nicetm/gelymar-platform:cron -f cron/Dockerfile .." -ForegroundColor Gray
Write-Host "   Monitoring: docker build --no-cache -t nicetm/gelymar-platform:monitoring -f Dockerfile.monitoring ." -ForegroundColor Gray
Write-Host "   Fileserver: docker build --no-cache -t nicetm/gelymar-platform:fileserver -f fileserver/Dockerfile fileserver" -ForegroundColor Gray
Write-Host "   Terminal:   docker build --no-cache -t nicetm/gelymar-platform:terminal -f Dockerfile.terminal ." -ForegroundColor Gray
Write-Host "   VPN:        docker build --no-cache -t nicetm/gelymar-platform:vpn -f vpn/Dockerfile vpn" -ForegroundColor Gray 