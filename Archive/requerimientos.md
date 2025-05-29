
# Documento de Requerimientos - Plataforma Web Gelymar

Este documento detalla los requerimientos funcionales y no funcionales extraídos de la reunión del 19 de mayo de 2025 para el desarrollo de una nueva plataforma web de gestión documental y logística para Gelymar.

## Requerimientos Funcionales

Gestión de Usuarios y Accesos
• Autenticación para usuarios internos (administradores) y clientes.
• Módulo de creación y mantención de usuarios, con asignación de permisos (consulta o administrador).
• Creación de passwords por el sistema o ingreso manual.
• Asociar múltiples correos electrónicos a un cliente.

Gestión de Clientes
• Módulo de mantención de clientes.
• Permitir agregar y quitar correos de contacto asociados a un cliente.
• Registrar consignatarios y 'notify' por cliente.
• Permitir múltiples plantas/destinos para un cliente (Max consignee).

Documentos y Operaciones
• Ingreso y visualización de operaciones por distintos criterios (orden de venta, cliente, fecha, etc.).
• Visualización de productos, cantidades, precios, embalajes.
• Subida manual de documentos a cada operación.
• Visualización y envío de documentos por correo desde el sistema.
• Filtrado y selección de documentos antes de enviar por email.

Envío Automático de Avisos 1
• Aviso 1: Recepción de orden (automático). -> Cuando se genera la orden en SAP y ahi se ven sistema para generar el envio de la orden
• Aviso 2: Aviso de embarque (se envía al generar ETD). -> Fecha del embarque
• Aviso 3: Aviso de llegada (automático al cumplirse ETA). -> Fecha de llegada 
• Soporte para reenvío o modificación manual por cambios de fecha.
• Texto de cartas predefinido con datos desde SAP.
• Generación automática de PDF para cada aviso.

Envío Automático de Avisos opción 2
• Aviso 1: Recepción de orden (automático). -> Cuando se genera la orden en SAP y ahi se ven sistema para generar el envio de la orden
• Aviso 2: Status del total de ordenes por cliente (se envía 2 veces por semana, manual / automático). -> Va a ser el status del total de ordenes de cliente, todas las ordenes + todos los items
• Soporte para reenvío o modificación manual por cambios de fecha.
• Texto de cartas predefinido con datos desde SAP.
• Generación automática de PDF para cada aviso.

Soporte para Embarques Parciales
• Asociar múltiples documentos a una misma orden de compra. -> Creación de Carpetas (Cliente), Sub carpetas (PC), Documentos varios
• Etiquetado de embarques parciales (A, B, C, etc.).
• Evitar duplicidad en cartas repetidas.
• Separar cantidades reales embarcadas del total.

Repositorio Documental
• Estructura de carpetas por cliente → PC → documentos.
• Creación automatizada de carpetas desde plataforma.
• Carga de documentos antiguos (CD, ZIP, etc.).
• Visualización de documentos históricos.

Generación de Documentos Internos -> Mejorar integracion con plantillas y actualizacion de documentos ya creados o tener algun control de versiones por docuemento para verificar sus modificaciones... 
• Packing List y Mandato Aduanero generados desde web.
• Plantillas con campos rellenables (peso, nave, pallets, etc.).
• Exportación como PDF y envío por email.

Estadísticas y KPI
• Dashboard gráfico con KPIs definidos por Gelymar.
• Carga de reportes de agencia aduanera para análisis.

Comunicación Cliente-Plataforma
• Mensajería tipo chat o WhatsApp corporativo -> (Primera opcion un agente, evaluar infraestructura para Python)
    v1 : https://github.com/mem0ai/chat-bot-template-py
    v2 : https://getstream.io/chat/docs/python/
    v3 : https://python.langchain.com/docs/tutorials/agents/#end-to-end-agent
    v4 : https://github.com/nomic-ai/gpt4all
    - Lista de opciones
        1.- Consulta estado embarque -> 12245 -> consulta a SAP y se etrae el estado de la orden 12345 -> se entrega por mensaje
        2.- Consultar Documento
        3.- Contactar con ejecutivo -> por wp, por mail, etc
    - Las respuestas se obtienen de la información de SAP
• Notificaciones visuales ante mensajes o pendientes.
• Chatbot para automatización básica (opcional). 


## Requerimientos No Funcionales

Seguridad
• Acceso restringido por perfiles.
• Manejo seguro de contraseñas y correos.
• Validación de datos antes de enviar correos/documentos.

Compatibilidad e Infraestructura
• Integración con SAP para lectura de datos.
• Operación on-premise o cloud (a definir).
• Compatibilidad con distintos navegadores.

Rendimiento y Automatización
• Procesos automáticos disparados por fechas.
• Botón de actualización manual para evitar sobrecarga.
• Generación rápida de documentos desde datos cargados.