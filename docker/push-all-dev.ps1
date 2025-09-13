# Script para subir todas las imágenes a DockerHub en PowerShell
# Ejecutar desde el directorio docker

Write-Host "📤 Iniciando subida de todas las imágenes a DockerHub..." -ForegroundColor Green

# Nota: Si no estás logueado en DockerHub, ejecuta: docker login
Write-Host "🔐 Asegúrate de estar logueado en DockerHub (docker login)" -ForegroundColor Yellow

# 1. Backend
Write-Host "📦 Subiendo Backend..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:backend
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Backend" -ForegroundColor Red
    exit 1
}

# 2. Frontend
Write-Host "📦 Subiendo Frontend..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:frontend
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Frontend" -ForegroundColor Red
    exit 1
}

# 3. Cron
Write-Host "📦 Subiendo Cron..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:cron
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cron subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Cron" -ForegroundColor Red
    exit 1
}

# 4. Monitoring
Write-Host "📦 Subiendo Monitoring..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:monitoring
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Monitoring subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Monitoring" -ForegroundColor Red
    exit 1
}

# 5. Fileserver
Write-Host "📦 Subiendo Fileserver..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:fileserver
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fileserver subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Fileserver" -ForegroundColor Red
    exit 1
}

# 6. Terminal
Write-Host "📦 Subiendo Terminal..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:terminal
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Terminal subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Terminal" -ForegroundColor Red
    exit 1
}


Write-Host "🎉 ¡Todas las imágenes han sido subidas exitosamente a DockerHub!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Repositorio: https://hub.docker.com/r/nicetm/gelymar-platform" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Para desplegar en desarrollo:" -ForegroundColor Yellow
Write-Host "   docker-compose --env-file .env.local up -d" -ForegroundColor Gray 