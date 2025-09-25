#!/bin/bash

# Función para mostrar título atractivo
show_title() {
    clear
    echo ""
    echo "Terminal Manager - Container Access"
    echo ""
}

# Función para mostrar menú de contenedores interactivo
show_container_menu() {
    show_title
    
    # Obtener contenedores dinámicamente
    echo "📋 Contenedores disponibles:"
    echo "═══════════════════════════"
    echo ""
    
    # Obtener lista de contenedores
    CONTAINERS=()
    CONTAINER_NAMES=()
    
    # Agregar contenedores desde docker ps
    while IFS= read -r line; do
        if [ ! -z "$line" ]; then
            name=$(echo "$line" | awk '{print $1}')
            status=$(echo "$line" | awk '{print $2}')
            image=$(echo "$line" | awk '{print $3}')
            
            # Formatear nombre para mostrar
            display_name=$(echo "$name" | sed 's/gelymar-platform-//' | sed 's/-dev//' | sed 's/-prod//')
            display_name=$(echo "$display_name" | sed 's/^./\U&/')
            
            CONTAINERS+=(" $display_name ($name)")
            CONTAINER_NAMES+=("$name")
        fi
    done < <(docker ps --format "{{.Names}} {{.Status}} {{.Image}}" | head -10)
    
    # Agregar opción de salir
    CONTAINERS+=(" Salir")
    CONTAINER_NAMES+=("exit")
    
    # Mostrar opciones
    for i in "${!CONTAINERS[@]}"; do
        if [ $i -eq 0 ]; then
            echo -e "  \033[7m▶     ${CONTAINERS[$i]}\033[0m"
        else
            echo "     ${CONTAINERS[$i]}"
        fi
    done
    
    echo ""
    echo "💡 Usa las flechas ↑↓ para navegar y Enter para seleccionar"
    echo "   Presiona 'q' para salir"
    echo ""
    
    # Variables para navegación
    selected=0
    total=${#CONTAINERS[@]}
    
    # Bucle de navegación
    while true; do
        # Leer una tecla
        read -rsn1 key
        
        case "$key" in
            $'\x1b')  # ESC sequence
                read -rsn2 key
                case "$key" in
                    "[A") # Flecha arriba
                        if [ $selected -gt 0 ]; then
                            selected=$((selected - 1))
                        fi
                        ;;
                    "[B") # Flecha abajo
                        if [ $selected -lt $((total - 1)) ]; then
                            selected=$((selected + 1))
                        fi
                        ;;
                esac
                ;;
            "") # Enter
                break
                ;;
            "q"|"Q") # Salir
                echo "Saliendo..."
                exit 0
                ;;
        esac
        
        # Redibujar menú
        show_title
        echo "📋 Contenedores disponibles:"
        echo "═══════════════════════════"
        echo ""
        
        for i in "${!CONTAINERS[@]}"; do
            if [ $i -eq $selected ]; then
                echo -e "  \033[7m▶     ${CONTAINERS[$i]}\033[0m"
            else
                echo "     ${CONTAINERS[$i]}"
            fi
        done
        
        echo ""
        echo "💡 Usa las flechas ↑↓ para navegar y Enter para seleccionar"
        echo "   Presiona 'q' para salir"
        echo ""
    done
    
    # Procesar selección
    selected_container="${CONTAINER_NAMES[$selected]}"
    
    if [ "$selected_container" = "exit" ]; then
        echo "Saliendo..."
        exit 0
    fi
    
    connect_to_container "$selected_container"
}

# Función para conectar a un contenedor
connect_to_container() {
    local container_name="$1"
    
    show_title
    echo "🔗 Conectando a: $container_name"
    echo "═══════════════════════════════════"
    echo ""
    echo "💡 Para volver al menú principal:"
    echo "   • Escribe 'exit' o presiona Ctrl+D"
    echo "   • O presiona Ctrl+C"
    echo ""
    
    # Verificar si el contenedor existe y está corriendo
    if docker ps | grep -q "$container_name"; then
        # Conectar al contenedor (intentar bash primero, luego sh)
        if docker exec "$container_name" test -f /bin/bash; then
            docker exec -it "$container_name" /bin/bash
        else
            docker exec -it "$container_name" /bin/sh
        fi
        
        # Cuando regrese del contenedor, mostrar mensaje
        echo ""
        echo "🔄 Regresando al menú principal..."
        sleep 2
    else
        echo "❌ Error: El contenedor $container_name no está corriendo"
        echo ""
        echo "📋 Contenedores activos:"
        docker ps --format "table {{.Names}}\t{{.Status}}"
        echo ""
        read -p "Presiona Enter para continuar..."
    fi
}

# Función principal
main() {
    echo "✅ Config Manager Terminal - Bienvenido"
    echo ""
    sleep 1
    
    # Bucle principal del menú
    while true; do
        show_container_menu
    done
}

# Ejecutar función principal
main
