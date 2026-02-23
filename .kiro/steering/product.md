---
inclusion: always
---

# Plataforma de Gestión Gelymar

Una plataforma integral de logística y gestión de pedidos para Gelymar, construida como una arquitectura de microservicios en contenedores.

## Funcionalidad Principal

La plataforma gestiona el ciclo de vida completo de pedidos para una empresa de distribución de productos del mar:

- Gestión de clientes y vendedores con acceso basado en roles (admin, cliente, vendedor)
- Procesamiento de pedidos con soporte para órdenes parciales (parciales) - los pedidos pueden dividirse con el mismo PC/OC pero diferentes facturas
- Generación y gestión de documentos (ORN, avisos de embarque, avisos de entrega, avisos de disponibilidad)
- Sistema de chat en tiempo real con Socket.io para soporte al cliente
- Integración con servidor de archivos para almacenamiento y recuperación de documentos
- Trabajos cron automatizados para sincronización de datos y entrega de notificaciones
- Frontend multi-contexto (portales admin, cliente, vendedor)

## Reglas de Negocio Clave

- Los pedidos pueden ser parcializados (divididos en múltiples órdenes con el mismo PC/OC)
- El ORN (Aviso de Recepción de Orden) solo se genera para el pedido padre, nunca para órdenes parciales
- Cada pedido debe mostrar la información correcta de items y totales en los PDFs generados
- Las notificaciones automáticas se envían en horarios específicos para cambios de estado de pedidos
- Integración con SQL Server (Softkey) para sincronización de datos legacy

## Roles de Usuario

- Admin: Acceso completo al sistema, gestión de usuarios, configuración
- Cliente: Ver pedidos, documentos, chat con soporte
- Vendedor: Gestionar clientes, crear pedidos, ver reportes
