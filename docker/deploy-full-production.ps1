# Script maestro para despliegue completo en producción
# Ejecutar desde el directorio docker/
# Este script maneja todo el proceso: build → push → cleanup → deploy

param(
    [switch]$SkipBuild,
    [switch]$SkipPush,
    [switch]$SkipCleanup,
    [switch]$SkipDeploy
)

Write-Host "🚀 DESPLIEGUE COMPLETO DE PRODUCCIÓN - GELYMAR PLATFORM" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "docker-compose-prod.yml") -or -not (Test-Path "docker-compose-hub.yml")) {
    Write-Host "❌ Error: No se encontraron los archivos docker-compose" -ForegroundColor Red
    Write-Host "   Asegúrate de ejecutar este script desde el directorio docker/" -ForegroundColor Yellow
    exit 1
}

# PASO 1: Construir imágenes de producción
if (-not $SkipBuild) {
    Write-Host "📦 PASO 1: Construyendo imágenes de producción..." -ForegroundColor Cyan
    Write-Host "===============================================" -ForegroundColor Cyan
    
    .\build-all-prod.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error en la construcción de imágenes" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} else {
    Write-Host "⏭️  PASO 1: Construcción omitida (--SkipBuild)" -ForegroundColor Yellow
    Write-Host ""
}

# PASO 2: Subir imágenes a DockerHub
if (-not $SkipPush) {
    Write-Host "📤 PASO 2: Subiendo imágenes a DockerHub..." -ForegroundColor Cyan
    Write-Host "===========================================" -ForegroundColor Cyan
    
    .\push-all-prod.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error subiendo imágenes a DockerHub" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} else {
    Write-Host "⏭️  PASO 2: Push omitido (--SkipPush)" -ForegroundColor Yellow
    Write-Host ""
}

# PASO 3: Limpiar servidor de producción (excepto MySQL)
if (-not $SkipCleanup) {
    Write-Host "🧹 PASO 3: Limpiando servidor de producción..." -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "⚠️  IMPORTANTE: Este paso debe ejecutarse EN EL SERVIDOR DE PRODUCCIÓN" -ForegroundColor Yellow
    Write-Host "   Servidor: 172.20.10.151" -ForegroundColor Gray
    Write-Host "   Comando:  .\cleanup-production.ps1" -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "¿Has ejecutado cleanup-production.ps1 en el servidor de producción? (s/n)"
    if ($response -ne "s" -and $response -ne "S") {
        Write-Host "❌ Debes ejecutar cleanup-production.ps1 en el servidor primero" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} else {
    Write-Host "⏭️  PASO 3: Limpieza omitida (--SkipCleanup)" -ForegroundColor Yellow
    Write-Host ""
}

# PASO 4: Desplegar en servidor de producción
if (-not $SkipDeploy) {
    Write-Host "🚀 PASO 4: Desplegando en servidor de producción..." -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "⚠️  IMPORTANTE: Este paso debe ejecutarse EN EL SERVIDOR DE PRODUCCIÓN" -ForegroundColor Yellow
    Write-Host "   Servidor: 172.20.10.151" -ForegroundColor Gray
    Write-Host "   Comando:  .\deploy-production.ps1" -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "¿Has ejecutado deploy-production.ps1 en el servidor de producción? (s/n)"
    if ($response -ne "s" -and $response -ne "S") {
        Write-Host "❌ Debes ejecutar deploy-production.ps1 en el servidor" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} else {
    Write-Host "⏭️  PASO 4: Despliegue omitido (--SkipDeploy)" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "🎉 ¡DESPLIEGUE COMPLETO FINALIZADO!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Resumen del proceso:" -ForegroundColor Cyan
Write-Host "   ✅ Imágenes construidas y subidas a DockerHub" -ForegroundColor Green
Write-Host "   ✅ Servidor de producción limpiado (MySQL conservado)" -ForegroundColor Green
Write-Host "   ✅ Servicios desplegados con las últimas versiones" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Plataforma disponible en:" -ForegroundColor Yellow
Write-Host "   http://172.20.10.151:2121" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Comandos útiles para el servidor:" -ForegroundColor Yellow
Write-Host "   Ver estado:     docker compose -f docker-compose-hub.yml ps" -ForegroundColor Gray
Write-Host "   Ver logs:       docker compose -f docker-compose-hub.yml logs -f" -ForegroundColor Gray
Write-Host "   Reiniciar:      docker compose -f docker-compose-hub.yml restart" -ForegroundColor Gray
