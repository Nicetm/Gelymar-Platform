# Requirements Document - Code Optimization & Refactoring

## Introduction

Este documento define los requisitos para un proyecto integral de optimización, refactorización y limpieza del código de la Plataforma de Gestión Gelymar. El objetivo es mejorar la mantenibilidad, rendimiento, organización y calidad general del código sin alterar la funcionalidad existente del sistema.

La plataforma actual es una aplicación de gestión logística construida con arquitectura de microservicios que incluye Backend (Node.js/Express), Frontend multi-contexto (Astro/React), bases de datos duales (MySQL + SQL Server), cron jobs (PM2) y despliegue en Docker. El proyecto ha crecido orgánicamente y requiere una revisión sistemática para eliminar deuda técnica, mejorar patrones de diseño y optimizar el rendimiento.

### Infraestructura de Producción

La plataforma se ejecuta en una **máquina virtual Linux** con la siguiente configuración de red:

- **IP Servidor**: 172.20.10.151 (red interna)
- **Admin Portal**: http://172.20.10.151:2121 (solo acceso interno)
- **Seller Portal**: http://172.20.10.151:2123 (solo acceso interno)
- **Client Portal**: https://logistic.gelymar.cl (acceso público vía Cloudflare)
- **Backend API**: http://172.20.10.151:3000 (red interna)

**Cloudflare** actúa como proxy/puente para el portal de clientes, permitiendo acceso desde internet mientras los portales de admin y seller permanecen en la red interna. Esta configuración de segmentación de red debe considerarse en todas las optimizaciones de seguridad, configuración y deployment.

## Glossary

- **Backend**: Servidor Node.js con Express que maneja la lógica de negocio, APIs REST y WebSocket
- **Frontend**: Aplicación Astro con React que se construye en 3 contextos (admin, client, seller)
- **Service**: Módulo de lógica de negocio en el backend que encapsula operaciones específicas
- **Controller**: Capa que maneja HTTP requests/responses y delega a servicios
- **Mapper**: Función que transforma datos entre diferentes formatos (SQL Server ↔ Aplicación)
- **Cron_Job**: Tarea programada ejecutada por PM2 para operaciones automáticas
- **Dead_Code**: Código que nunca se ejecuta o no tiene referencias activas
- **Code_Duplication**: Lógica repetida en múltiples lugares que debería consolidarse
- **Technical_Debt**: Decisiones de diseño subóptimas que dificultan el mantenimiento
- **Query_Optimization**: Mejora de consultas SQL para reducir tiempo de ejecución
- **Connection_Pool**: Conjunto reutilizable de conexiones a base de datos
- **Rate_Limiting**: Control de frecuencia de requests para prevenir abuso
- **Middleware**: Función que intercepta requests antes de llegar a controllers
- **Dependency_Injection**: Patrón donde dependencias se proveen externamente (Awilix)
- **Multi_Context**: Arquitectura frontend que construye 3 aplicaciones separadas
- **Socket_Room**: Canal de comunicación WebSocket para grupos específicos
- **File_Identifier**: Secuencia única para documentos (ORN-1, ORN-2, etc.)
- **Partial_Order**: Orden dividida con mismo PC/OC pero diferente factura
- **Softkey**: Sistema ERP legacy en SQL Server (solo lectura)
- **Docker_Service**: Contenedor individual en la arquitectura Docker Compose
- **PM2**: Process Manager para gestión de cron jobs y procesos Node.js
- **Refactoring**: Reestructuración de código sin cambiar comportamiento externo
- **Code_Smell**: Indicador de problemas potenciales en el diseño del código
- **VM_Linux**: Máquina virtual Linux donde se ejecuta la plataforma en producción (172.20.10.151)
- **Internal_Network**: Red interna (172.20.10.x) donde operan admin y seller portals
- **Cloudflare**: Servicio CDN/proxy que actúa como puente entre internet y el portal cliente
- **Network_Segmentation**: Separación de portales internos (admin/seller) y público (client)

## Requirements

### Requirement 1: Backend Code Analysis and Cleanup

**User Story:** Como desarrollador, quiero analizar y limpiar el código del backend, para eliminar código muerto, duplicación y mejorar la organización de servicios.

#### Acceptance Criteria

1. THE Backend_Analyzer SHALL identificar todos los servicios, controllers y middleware no utilizados
2. THE Backend_Analyzer SHALL detectar funciones duplicadas entre servicios con similitud mayor al 70%
3. THE Backend_Analyzer SHALL identificar imports no utilizados en todos los archivos JavaScript
4. THE Backend_Analyzer SHALL detectar variables y funciones declaradas pero nunca referenciadas
5. WHEN se detecta código duplicado, THE Backend_Analyzer SHALL sugerir consolidación en utilidades compartidas
6. THE Backend_Analyzer SHALL verificar que todos los servicios registrados en container.js tienen referencias activas
7. THE Backend_Analyzer SHALL identificar endpoints en routes/ sin implementación en controllers
8. THE Backend_Analyzer SHALL detectar middleware aplicado pero no utilizado en rutas
9. THE Backend_Analyzer SHALL generar reporte con ubicación exacta de cada issue detectado
10. THE Backend_Analyzer SHALL priorizar issues por impacto (crítico, alto, medio, bajo)

---

### Requirement 2: Service Layer Refactoring

**User Story:** Como desarrollador, quiero refactorizar la capa de servicios, para mejorar cohesión, reducir acoplamiento y estandarizar patrones.

#### Acceptance Criteria

1. THE Service_Refactorer SHALL identificar servicios con más de 500 líneas que requieren división
2. THE Service_Refactorer SHALL detectar servicios con múltiples responsabilidades (violación SRP)
3. WHEN un servicio tiene más de 10 funciones públicas, THE Service_Refactorer SHALL sugerir división por dominio
4. THE Service_Refactorer SHALL estandarizar manejo de errores en todos los servicios (try-catch consistente)
5. THE Service_Refactorer SHALL verificar que todos los servicios usan logger para errores
6. THE Service_Refactorer SHALL identificar dependencias circulares entre servicios
7. THE Service_Refactorer SHALL estandarizar nombres de funciones según convención (getX, createX, updateX, deleteX)
8. THE Service_Refactorer SHALL consolidar lógica de normalización (RUT, OC, fechas) en utilidades compartidas
9. THE Service_Refactorer SHALL verificar que servicios no accedan directamente a base de datos sin usar pool
10. THE Service_Refactorer SHALL documentar cada servicio con JSDoc incluyendo parámetros y retornos

---

### Requirement 3: Database Query Optimization

**User Story:** Como desarrollador, quiero optimizar las consultas a base de datos, para reducir tiempos de respuesta y carga del servidor.

#### Acceptance Criteria

1. THE Query_Optimizer SHALL identificar consultas SQL sin índices en columnas de filtrado
2. THE Query_Optimizer SHALL detectar consultas con SELECT * que deberían especificar columnas
3. WHEN una consulta tarda más de 2 segundos, THE Query_Optimizer SHALL sugerir optimización
4. THE Query_Optimizer SHALL identificar N+1 queries en loops que requieren JOIN o batch loading
5. THE Query_Optimizer SHALL verificar uso correcto de parámetros preparados en todas las consultas
6. THE Query_Optimizer SHALL sugerir índices compuestos para filtros multi-columna frecuentes
7. THE Query_Optimizer SHALL identificar consultas duplicadas que pueden cachearse
8. THE Query_Optimizer SHALL verificar que connection pools tienen configuración óptima (min, max, idle)
9. THE Query_Optimizer SHALL detectar transacciones sin commit/rollback explícito
10. THE Query_Optimizer SHALL recomendar vistas materializadas para queries complejas frecuentes

---

### Requirement 4: Frontend Component Optimization

**User Story:** Como desarrollador, quiero optimizar componentes del frontend, para mejorar rendimiento, reutilización y mantenibilidad.

#### Acceptance Criteria

1. THE Frontend_Optimizer SHALL identificar componentes React con más de 300 líneas que requieren división
2. THE Frontend_Optimizer SHALL detectar componentes duplicados entre contextos (admin/client/seller)
3. WHEN un componente se usa en múltiples páginas, THE Frontend_Optimizer SHALL sugerir extracción a shared
4. THE Frontend_Optimizer SHALL identificar re-renders innecesarios por falta de memoización
5. THE Frontend_Optimizer SHALL detectar fetch de datos en componentes que debería estar en servicios
6. THE Frontend_Optimizer SHALL verificar que imágenes usan optimización de Astro
7. THE Frontend_Optimizer SHALL identificar bundles JavaScript mayores a 200KB que requieren code splitting
8. THE Frontend_Optimizer SHALL detectar estilos inline que deberían estar en Tailwind classes
9. THE Frontend_Optimizer SHALL verificar que componentes pesados usan lazy loading
10. THE Frontend_Optimizer SHALL estandarizar manejo de estados (useState, useEffect patterns)

---

### Requirement 5: API Endpoint Standardization

**User Story:** Como desarrollador, quiero estandarizar los endpoints de API, para mejorar consistencia, documentación y mantenibilidad.

#### Acceptance Criteria

1. THE API_Standardizer SHALL verificar que todos los endpoints siguen convención REST (GET, POST, PUT, DELETE)
2. THE API_Standardizer SHALL estandarizar formato de respuestas (success, data, message)
3. WHEN un endpoint retorna error, THE API_Standardizer SHALL verificar uso de códigos HTTP correctos
4. THE API_Standardizer SHALL identificar endpoints sin validación de entrada (express-validator)
5. THE API_Standardizer SHALL verificar que endpoints protegidos usan authMiddleware
6. THE API_Standardizer SHALL estandarizar nombres de rutas (plural para colecciones, singular para items)
7. THE API_Standardizer SHALL identificar endpoints sin documentación JSDoc/Swagger
8. THE API_Standardizer SHALL verificar que rate limiting está aplicado a endpoints sensibles
9. THE API_Standardizer SHALL consolidar lógica de autorización repetida en middleware reutilizable
10. THE API_Standardizer SHALL estandarizar paginación en endpoints que retornan listas

---

### Requirement 6: Error Handling Improvement

**User Story:** Como desarrollador, quiero mejorar el manejo de errores en toda la aplicación, para facilitar debugging y mejorar experiencia de usuario.

#### Acceptance Criteria

1. THE Error_Handler SHALL estandarizar clases de error personalizadas (ValidationError, AuthError, DatabaseError)
2. THE Error_Handler SHALL verificar que todos los try-catch loguean errores con contexto suficiente
3. WHEN ocurre un error, THE Error_Handler SHALL incluir request ID para trazabilidad
4. THE Error_Handler SHALL implementar middleware global de manejo de errores en Express
5. THE Error_Handler SHALL verificar que errores de base de datos no exponen información sensible
6. THE Error_Handler SHALL estandarizar mensajes de error en español e inglés según contexto
7. THE Error_Handler SHALL implementar circuit breaker para servicios externos (SQL Server)
8. THE Error_Handler SHALL verificar que errores async/await se manejan correctamente
9. THE Error_Handler SHALL implementar retry logic para operaciones transitorias (network, timeout)
10. THE Error_Handler SHALL consolidar logging de errores en formato estructurado (JSON)

---

### Requirement 7: Cron Job Optimization

**User Story:** Como desarrollador, quiero optimizar los cron jobs, para mejorar eficiencia, confiabilidad y manejo de errores.

#### Acceptance Criteria

1. THE Cron_Optimizer SHALL identificar jobs con lógica duplicada que puede consolidarse
2. THE Cron_Optimizer SHALL verificar que todos los jobs tienen timeout configurado
3. WHEN un job falla, THE Cron_Optimizer SHALL implementar retry con backoff exponencial
4. THE Cron_Optimizer SHALL estandarizar logging de inicio, progreso y finalización de jobs
5. THE Cron_Optimizer SHALL verificar que jobs no bloquean ejecuciones subsecuentes
6. THE Cron_Optimizer SHALL implementar health checks para monitoreo de jobs
7. THE Cron_Optimizer SHALL consolidar configuración de jobs en archivo centralizado
8. THE Cron_Optimizer SHALL verificar que jobs liberan recursos (conexiones DB) correctamente
9. THE Cron_Optimizer SHALL implementar locks distribuidos para prevenir ejecuciones concurrentes
10. THE Cron_Optimizer SHALL estandarizar manejo de señales (SIGTERM, SIGINT) para graceful shutdown

---

### Requirement 8: Docker Configuration Optimization

**User Story:** Como DevOps, quiero optimizar la configuración de Docker, para reducir tamaño de imágenes, mejorar build time y simplificar deployment en la VM Linux de producción.

#### Acceptance Criteria

1. THE Docker_Optimizer SHALL reducir tamaño de imágenes usando multi-stage builds
2. THE Docker_Optimizer SHALL verificar que imágenes usan versiones específicas (no latest)
3. WHEN se construye una imagen, THE Docker_Optimizer SHALL usar layer caching óptimo
4. THE Docker_Optimizer SHALL consolidar variables de entorno duplicadas entre servicios
5. THE Docker_Optimizer SHALL verificar que servicios usan health checks configurados
6. THE Docker_Optimizer SHALL optimizar orden de comandos en Dockerfile para mejor caching
7. THE Docker_Optimizer SHALL identificar dependencias innecesarias en package.json
8. THE Docker_Optimizer SHALL estandarizar nombres de servicios y contenedores
9. THE Docker_Optimizer SHALL verificar que volúmenes persistentes están correctamente configurados
10. THE Docker_Optimizer SHALL consolidar scripts de build/deploy en Makefile o script unificado
11. THE Docker_Optimizer SHALL verificar configuración de red para segmentación (admin/seller interno, client vía Cloudflare)
12. THE Docker_Optimizer SHALL documentar configuración específica para VM Linux (172.20.10.151)

---

### Requirement 9: Security Audit and Hardening

**User Story:** Como desarrollador, quiero auditar y mejorar la seguridad del código, para proteger datos sensibles y prevenir vulnerabilidades.

#### Acceptance Criteria

1. THE Security_Auditor SHALL identificar secretos hardcodeados en código fuente
2. THE Security_Auditor SHALL verificar que passwords se hashean con bcrypt (no plaintext)
3. WHEN se maneja información sensible, THE Security_Auditor SHALL verificar encriptación adecuada
4. THE Security_Auditor SHALL identificar endpoints sin rate limiting que permiten brute force
5. THE Security_Auditor SHALL verificar que JWT tokens tienen expiración configurada
6. THE Security_Auditor SHALL detectar SQL injection vulnerabilities en queries dinámicas
7. THE Security_Auditor SHALL verificar que CORS está configurado con whitelist específica
8. THE Security_Auditor SHALL identificar dependencias con vulnerabilidades conocidas (npm audit)
9. THE Security_Auditor SHALL verificar que archivos subidos tienen validación de tipo y tamaño
10. THE Security_Auditor SHALL implementar sanitización de inputs en todos los endpoints

---

### Requirement 10: Code Documentation and Standards

**User Story:** Como desarrollador, quiero mejorar la documentación del código, para facilitar onboarding y mantenimiento futuro.

#### Acceptance Criteria

1. THE Documentation_Generator SHALL generar JSDoc para todas las funciones públicas
2. THE Documentation_Generator SHALL crear README.md para cada módulo principal
3. WHEN una función tiene más de 3 parámetros, THE Documentation_Generator SHALL documentar cada uno
4. THE Documentation_Generator SHALL estandarizar comentarios de código (español o inglés consistente)
5. THE Documentation_Generator SHALL generar diagramas de arquitectura actualizados
6. THE Documentation_Generator SHALL documentar flujos críticos (autenticación, generación PDFs, envío emails)
7. THE Documentation_Generator SHALL crear guía de convenciones de código (naming, estructura)
8. THE Documentation_Generator SHALL documentar variables de entorno requeridas por servicio
9. THE Documentation_Generator SHALL generar changelog de cambios realizados en refactoring
10. THE Documentation_Generator SHALL crear guía de troubleshooting para errores comunes

---

### Requirement 11: Testing Infrastructure Setup

**User Story:** Como desarrollador, quiero establecer infraestructura de testing, para prevenir regresiones y facilitar refactoring seguro.

#### Acceptance Criteria

1. THE Test_Infrastructure SHALL configurar framework de testing (Jest o Mocha)
2. THE Test_Infrastructure SHALL crear tests unitarios para servicios críticos (order, customer, email)
3. WHEN se refactoriza código, THE Test_Infrastructure SHALL verificar que tests existentes pasan
4. THE Test_Infrastructure SHALL implementar tests de integración para endpoints principales
5. THE Test_Infrastructure SHALL configurar coverage reporting con umbral mínimo del 60%
6. THE Test_Infrastructure SHALL crear mocks para dependencias externas (SQL Server, SMTP)
7. THE Test_Infrastructure SHALL implementar tests E2E para flujos críticos
8. THE Test_Infrastructure SHALL configurar CI/CD pipeline para ejecutar tests automáticamente
9. THE Test_Infrastructure SHALL crear fixtures de datos de prueba realistas
10. THE Test_Infrastructure SHALL documentar estrategia de testing y guía de escritura de tests

---

### Requirement 12: Performance Monitoring Implementation

**User Story:** Como desarrollador, quiero implementar monitoreo de rendimiento, para identificar cuellos de botella y optimizar proactivamente.

#### Acceptance Criteria

1. THE Performance_Monitor SHALL implementar logging de tiempo de respuesta de endpoints
2. THE Performance_Monitor SHALL rastrear uso de memoria y CPU por servicio
3. WHEN un endpoint tarda más de 3 segundos, THE Performance_Monitor SHALL generar alerta
4. THE Performance_Monitor SHALL implementar métricas de queries lentas (> 1 segundo)
5. THE Performance_Monitor SHALL rastrear tamaño de payloads de requests/responses
6. THE Performance_Monitor SHALL monitorear tasa de errores por endpoint
7. THE Performance_Monitor SHALL implementar dashboard de métricas en tiempo real
8. THE Performance_Monitor SHALL rastrear uso de connection pool (MySQL y SQL Server)
9. THE Performance_Monitor SHALL monitorear latencia de Socket.io events
10. THE Performance_Monitor SHALL generar reportes semanales de performance con tendencias

---

### Requirement 13: Dependency Management and Updates

**User Story:** Como desarrollador, quiero gestionar y actualizar dependencias, para mantener seguridad y aprovechar mejoras de librerías.

#### Acceptance Criteria

1. THE Dependency_Manager SHALL auditar todas las dependencias con vulnerabilidades conocidas
2. THE Dependency_Manager SHALL identificar dependencias obsoletas (> 2 años sin updates)
3. WHEN una dependencia tiene vulnerabilidad crítica, THE Dependency_Manager SHALL priorizar actualización
4. THE Dependency_Manager SHALL verificar que dependencias de desarrollo no están en producción
5. THE Dependency_Manager SHALL consolidar versiones duplicadas de misma librería
6. THE Dependency_Manager SHALL identificar dependencias no utilizadas en package.json
7. THE Dependency_Manager SHALL crear plan de actualización gradual para major versions
8. THE Dependency_Manager SHALL verificar compatibilidad de dependencias actualizadas con tests
9. THE Dependency_Manager SHALL documentar breaking changes de actualizaciones importantes
10. THE Dependency_Manager SHALL configurar Dependabot o Renovate para updates automáticos

---

### Requirement 14: Configuration Management Centralization

**User Story:** Como desarrollador, quiero centralizar la gestión de configuración, para simplificar deployment y reducir errores de configuración.

#### Acceptance Criteria

1. THE Config_Manager SHALL consolidar variables de entorno en archivo centralizado
2. THE Config_Manager SHALL validar configuración requerida al inicio de aplicación
3. WHEN falta una variable crítica, THE Config_Manager SHALL fallar con mensaje descriptivo
4. THE Config_Manager SHALL implementar configuración por ambiente (dev, staging, prod)
5. THE Config_Manager SHALL encriptar valores sensibles en archivos de configuración
6. THE Config_Manager SHALL documentar todas las variables de entorno con descripción y valores ejemplo
7. THE Config_Manager SHALL implementar validación de tipos para configuración (number, boolean, string)
8. THE Config_Manager SHALL consolidar configuración de timeouts, limits y thresholds
9. THE Config_Manager SHALL implementar hot-reload de configuración sin reiniciar servicios
10. THE Config_Manager SHALL crear template de configuración para nuevos ambientes

---

### Requirement 15: Code Style and Linting Standardization

**User Story:** Como desarrollador, quiero estandarizar el estilo de código, para mejorar legibilidad y consistencia en todo el proyecto.

#### Acceptance Criteria

1. THE Code_Styler SHALL configurar ESLint con reglas estrictas para JavaScript/TypeScript
2. THE Code_Styler SHALL configurar Prettier para formateo automático consistente
3. WHEN se hace commit, THE Code_Styler SHALL ejecutar linting automático (pre-commit hook)
4. THE Code_Styler SHALL estandarizar indentación (2 espacios) en todos los archivos
5. THE Code_Styler SHALL verificar uso consistente de comillas (simples o dobles)
6. THE Code_Styler SHALL estandarizar declaración de funciones (arrow vs function)
7. THE Code_Styler SHALL verificar que imports están ordenados alfabéticamente
8. THE Code_Styler SHALL detectar console.log olvidados que deben ser logger
9. THE Code_Styler SHALL estandarizar nombres de archivos (kebab-case, camelCase, PascalCase)
10. THE Code_Styler SHALL generar reporte de violaciones de estilo con ubicación exacta

---

### Requirement 16: Logging and Monitoring Standardization

**User Story:** Como desarrollador, quiero estandarizar logging y monitoreo, para facilitar debugging y análisis de problemas.

#### Acceptance Criteria

1. THE Logger_Standardizer SHALL consolidar todos los console.log en uso de logger centralizado
2. THE Logger_Standardizer SHALL implementar niveles de log consistentes (debug, info, warn, error)
3. WHEN se loguea un error, THE Logger_Standardizer SHALL incluir stack trace completo
4. THE Logger_Standardizer SHALL implementar log rotation para prevenir llenado de disco
5. THE Logger_Standardizer SHALL estandarizar formato de logs (timestamp, level, service, message)
6. THE Logger_Standardizer SHALL implementar correlation IDs para rastrear requests entre servicios
7. THE Logger_Standardizer SHALL configurar log levels por ambiente (verbose en dev, error en prod)
8. THE Logger_Standardizer SHALL implementar structured logging (JSON) para parsing automático
9. THE Logger_Standardizer SHALL consolidar logs de todos los servicios en sistema centralizado
10. THE Logger_Standardizer SHALL implementar alertas automáticas para errores críticos

---

### Requirement 17: Database Schema Optimization

**User Story:** Como desarrollador, quiero optimizar el esquema de base de datos, para mejorar integridad, rendimiento y mantenibilidad.

#### Acceptance Criteria

1. THE Schema_Optimizer SHALL identificar tablas sin primary keys o índices
2. THE Schema_Optimizer SHALL detectar columnas con tipos de datos subóptimos (VARCHAR(255) innecesario)
3. WHEN una tabla tiene más de 50 columnas, THE Schema_Optimizer SHALL sugerir normalización
4. THE Schema_Optimizer SHALL identificar foreign keys faltantes para relaciones existentes
5. THE Schema_Optimizer SHALL verificar que timestamps usan TIMESTAMP en lugar de VARCHAR
6. THE Schema_Optimizer SHALL detectar columnas JSON que podrían ser tablas relacionadas
7. THE Schema_Optimizer SHALL identificar índices no utilizados que consumen espacio
8. THE Schema_Optimizer SHALL verificar que columnas nullable tienen valores default apropiados
9. THE Schema_Optimizer SHALL sugerir particionamiento para tablas con millones de registros
10. THE Schema_Optimizer SHALL generar scripts de migración para cambios de esquema propuestos

---

### Requirement 18: Socket.io Communication Optimization

**User Story:** Como desarrollador, quiero optimizar la comunicación WebSocket, para reducir latencia y mejorar escalabilidad del chat.

#### Acceptance Criteria

1. THE Socket_Optimizer SHALL implementar compresión de mensajes para payloads grandes
2. THE Socket_Optimizer SHALL verificar que rooms se limpian cuando usuarios desconectan
3. WHEN un mensaje se envía, THE Socket_Optimizer SHALL usar broadcast eficiente (no loop manual)
4. THE Socket_Optimizer SHALL implementar throttling para prevenir spam de mensajes
5. THE Socket_Optimizer SHALL verificar que eventos tienen validación de datos
6. THE Socket_Optimizer SHALL implementar reconnection logic con backoff exponencial
7. THE Socket_Optimizer SHALL consolidar eventos duplicados en eventos genéricos
8. THE Socket_Optimizer SHALL implementar heartbeat para detectar conexiones muertas
9. THE Socket_Optimizer SHALL verificar que autenticación de socket es segura
10. THE Socket_Optimizer SHALL implementar rate limiting por usuario en eventos

---

### Requirement 19: Email Service Optimization

**User Story:** Como desarrollador, quiero optimizar el servicio de email, para mejorar confiabilidad, rendimiento y mantenibilidad de templates.

#### Acceptance Criteria

1. THE Email_Optimizer SHALL implementar queue para envío asíncrono de emails
2. THE Email_Optimizer SHALL verificar que templates Handlebars no tienen lógica compleja
3. WHEN un email falla, THE Email_Optimizer SHALL implementar retry con límite de intentos
4. THE Email_Optimizer SHALL consolidar templates duplicados entre idiomas
5. THE Email_Optimizer SHALL implementar validación de emails antes de envío
6. THE Email_Optimizer SHALL verificar que attachments tienen límite de tamaño
7. THE Email_Optimizer SHALL implementar logging detallado de envíos (éxito, fallo, destinatarios)
8. THE Email_Optimizer SHALL consolidar lógica de permisos de contactos en función reutilizable
9. THE Email_Optimizer SHALL implementar preview de emails para testing
10. THE Email_Optimizer SHALL verificar que emails tienen fallback text/plain

---

### Requirement 20: Migration and Rollback Strategy

**User Story:** Como desarrollador, quiero definir estrategia de migración y rollback, para aplicar cambios de refactoring de forma segura y reversible.

#### Acceptance Criteria

1. THE Migration_Planner SHALL crear plan de migración por fases (backend, frontend, database, cron)
2. THE Migration_Planner SHALL definir criterios de éxito para cada fase
3. WHEN una fase falla, THE Migration_Planner SHALL tener procedimiento de rollback documentado
4. THE Migration_Planner SHALL implementar feature flags para activar cambios gradualmente
5. THE Migration_Planner SHALL crear backup completo antes de cada fase
6. THE Migration_Planner SHALL definir ventanas de mantenimiento para cambios críticos
7. THE Migration_Planner SHALL implementar smoke tests para verificar funcionalidad post-migración
8. THE Migration_Planner SHALL documentar dependencias entre cambios (orden de aplicación)
9. THE Migration_Planner SHALL crear checklist de validación para cada fase
10. THE Migration_Planner SHALL definir comunicación a stakeholders sobre cambios y downtime

