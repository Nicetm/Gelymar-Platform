# Script para subir todas las imágenes a DockerHub para producción con tags específicos en PowerShell
# Ejecutar desde el directorio docker

Write-Host "📤 Iniciando subida de todas las imágenes a DockerHub para producción..." -ForegroundColor Green

# Nota: Si no estás logueado en DockerHub, ejecuta: docker login
Write-Host "🔐 Asegúrate de estar logueado en DockerHub (docker login)" -ForegroundColor Yellow

# 1. MySQL
Write-Host "📦 Subiendo MySQL..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:mysql-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ MySQL subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo MySQL" -ForegroundColor Red
    exit 1
}

# 2. Fileserver
Write-Host "📦 Subiendo Fileserver..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:fileserver-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fileserver subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Fileserver" -ForegroundColor Red
    exit 1
}

# 3. Backend
Write-Host "📦 Subiendo Backend..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:backend-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Backend" -ForegroundColor Red
    exit 1
}

# 4. Frontend (admin)
Write-Host "📦 Subiendo Frontend (admin)..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:frontend-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend (admin) subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Frontend (admin)" -ForegroundColor Red
    exit 1
}

# 5. Frontend (cliente)
Write-Host "📦 Subiendo Frontend (cliente)..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:frontend-client-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend (cliente) subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Frontend (cliente)" -ForegroundColor Red
    exit 1
}

# 6. Frontend (vendedor)
Write-Host "📦 Subiendo Frontend (vendedor)..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:frontend-seller-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend (vendedor) subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Frontend (vendedor)" -ForegroundColor Red
    exit 1
}

# 7. Cron
Write-Host "📦 Subiendo Cron..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:cron-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cron subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo Cron" -ForegroundColor Red
    exit 1
}


# 8. Config Manager (Comentado - No se sube)
# Write-Host "📦 Subiendo Config Manager..." -ForegroundColor Yellow
# docker push nicetm/gelymar-platform:config-manager-prod
# if ($LASTEXITCODE -eq 0) {
#     Write-Host "✅ Config Manager subido" -ForegroundColor Green
# } else {
#     Write-Host "❌ Error subiendo Config Manager" -ForegroundColor Red
#     exit 1
# }

# 9. phpMyAdmin
Write-Host "📦 Subiendo phpMyAdmin..." -ForegroundColor Yellow
docker push nicetm/gelymar-platform:phpmyadmin-prod
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ phpMyAdmin subido" -ForegroundColor Green
} else {
    Write-Host "❌ Error subiendo phpMyAdmin" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 ¡Todas las imágenes han sido subidas exitosamente a DockerHub!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Repositorio: https://hub.docker.com/r/nicetm/gelymar-platform" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Para desplegar en producción (172.20.10.151):" -ForegroundColor Yellow
Write-Host "   docker compose -f docker-compose-hub.yml --env-file .env.production up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 Comandos para subir imágenes individuales:" -ForegroundColor Yellow
Write-Host "   MySQL:      docker push nicetm/gelymar-platform:mysql-prod" -ForegroundColor Gray
Write-Host "   Fileserver: docker push nicetm/gelymar-platform:fileserver-prod" -ForegroundColor Gray
Write-Host "   Backend:    docker push nicetm/gelymar-platform:backend-prod" -ForegroundColor Gray
Write-Host "   Frontend (admin):   docker push nicetm/gelymar-platform:frontend-prod" -ForegroundColor Gray
Write-Host "   Frontend (cliente): docker push nicetm/gelymar-platform:frontend-client-prod" -ForegroundColor Gray
Write-Host "   Frontend (vendedor): docker push nicetm/gelymar-platform:frontend-seller-prod" -ForegroundColor Gray
Write-Host "   Cron:       docker push nicetm/gelymar-platform:cron-prod" -ForegroundColor Gray
# Write-Host "   Config Manager: docker push nicetm/gelymar-platform:config-manager-prod" -ForegroundColor Gray
Write-Host "   phpMyAdmin: docker push nicetm/gelymar-platform:phpmyadmin-prod" -ForegroundColor Gray
