#!/bin/bash

# Lista de contenedores disponibles
CONTAINERS=(
    "gelymar-platform-mysql"
    "gelymar-platform-backend"
    "gelymar-platform-frontend"
    "gelymar-platform-fileserver"
    "gelymar-platform-cron"
    "gelymar-platform-phpmyadmin"
    "gelymar-platform-monitoring"
)

echo "🐚 Gelymar Platform - Terminal Manager"
echo "======================================"
echo ""
echo "Contenedores disponibles:"
echo ""

for i in "${!CONTAINERS[@]}"; do
    echo "  $((i+1)). ${CONTAINERS[$i]}"
done

echo ""
echo "0. Salir"
echo ""
echo "Selecciona un contenedor (0-${#CONTAINERS[@]}): "
read -r choice

if [[ "$choice" == "0" ]]; then
    echo "Saliendo..."
    exit 0
fi

if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#CONTAINERS[@]}" ]; then
    selected_container="${CONTAINERS[$((choice-1))]}"
    
    echo ""
    echo "Conectando a: $selected_container"
    echo "Presiona Ctrl+C para salir"
    echo ""
    
    # Verificar si el contenedor existe y está corriendo
    if docker ps | grep -q "$selected_container"; then
        # Conectar al contenedor (intentar bash primero, luego sh)
        if docker exec "$selected_container" test -f /bin/bash; then
            docker exec -it "$selected_container" /bin/bash
        else
            docker exec -it "$selected_container" /bin/sh
        fi
    else
        echo "Error: El contenedor $selected_container no está corriendo"
        echo "Contenedores activos:"
        docker ps --format "table {{.Names}}\t{{.Status}}"
        echo ""
        echo "Presiona Enter para continuar..."
        read -r
    fi
else
    echo "Opción inválida"
    echo "Presiona Enter para continuar..."
    read -r
fi 