#!/bin/bash

# Función para mostrar título atractivo
show_title() {
    clear
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                      ║"
    echo "║                    🐚 Softkey Shell                                  ║"
    echo "║                     Gelymar v2.19                                    ║"
    echo "║                                                                      ║"
    echo "║              Terminal Manager - Container Access                     ║"
    echo "║                                                                      ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo ""
}

# Función para validar credenciales contra la tabla monitoring
authenticate_user() {
    show_title
    echo "🔐 Autenticación requerida"
    echo "═══════════════════════════"
    echo ""
    
    read -p "👤 Usuario: " username
    read -s -p "🔑 Contraseña: " password
    echo ""
    
    # Verificar si el usuario existe y tiene acceso a shell
    if [ -z "$username" ] || [ -z "$password" ]; then
        echo "❌ Usuario y contraseña son requeridos"
        sleep 2
        return 1
    fi
    
    # Conectar a MySQL y verificar credenciales
    DB_USER=${DB_USER:-root}
    DB_PASS=${DB_PASS:-root123456}
    DB_NAME=${DB_NAME:-gelymar}
    
    result=$(docker exec gelymar-platform-mysql mysql -u "$DB_USER" -p"$DB_PASS" -D "$DB_NAME" -e "
        SELECT id, username, password, app_types, is_enabled 
        FROM monitoring 
        WHERE username = '$username' AND is_enabled = 1;
    " 2>/dev/null | tail -n +2)
    
    if [ -z "$result" ]; then
        echo "❌ Usuario no encontrado o deshabilitado"
        sleep 2
        return 1
    fi
    
    # Extraer datos del resultado
    user_id=$(echo "$result" | cut -f1)
    db_username=$(echo "$result" | cut -f2)
    db_password=$(echo "$result" | cut -f3)
    app_types=$(echo "$result" | cut -f4)
    
    # Verificar contraseña (SHA256)
    hashed_password=$(echo -n "$password" | sha256sum | cut -d' ' -f1)
    
    if [ "$hashed_password" != "$db_password" ]; then
        echo "❌ Contraseña incorrecta"
        sleep 2
        return 1
    fi
    
    # Verificar si tiene acceso a shell
    if [[ "$app_types" != *"shell"* ]]; then
        echo "❌ No tienes permisos para acceder a la terminal"
        sleep 2
        return 1
    fi
    
    echo "✅ Autenticación exitosa - Bienvenido $username"
    echo ""
    sleep 1
    return 0
}

# Función para mostrar menú de contenedores interactivo
show_container_menu() {
    show_title
    
    # Lista de contenedores disponibles
    CONTAINERS=(
        " MySQL Database (gelymar-platform-mysql)"
        " Backend API (gelymar-platform-backend)"
        " Frontend (gelymar-platform-frontend)"
        " File Server (gelymar-platform-fileserver)"
        " Cron Jobs (gelymar-platform-cron)"
        " phpMyAdmin (gelymar-platform-phpmyadmin)"
        " Monitoring (gelymar-platform-monitoring)"
        " Salir"
    )
    
    CONTAINER_NAMES=(
        "gelymar-platform-mysql"
        "gelymar-platform-backend"
        "gelymar-platform-frontend"
        "gelymar-platform-fileserver"
        "gelymar-platform-cron"
        "gelymar-platform-phpmyadmin"
        "gelymar-platform-monitoring"
        "exit"
    )
    
    echo "📋 Contenedores disponibles:"
    echo "═══════════════════════════"
    echo ""
    
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
    # Autenticar usuario
    if ! authenticate_user; then
        echo "❌ Autenticación fallida"
        exit 1
    fi
    
    # Bucle principal del menú
    while true; do
        show_container_menu
    done
}

# Ejecutar función principal
main 