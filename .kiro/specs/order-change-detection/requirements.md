# Documento de Requerimientos: Detección de Cambios en Órdenes

## Introducción

Este sistema detecta cambios en los datos de órdenes que provienen de vistas de SQL Server (`jor_imp_HDR_90_softkey`, `jor_imp_FACT_90_softkey`, `jor_imp_item_90_softkey`). Dado que no se puede modificar SQL Server (sin triggers), se implementa un mecanismo de comparación por hash con snapshots periódicos. Un cron job lee los valores actuales, calcula un hash, lo compara contra el hash almacenado en MySQL, y cuando detecta diferencias, realiza una comparación campo a campo y registra los cambios. El frontend muestra indicadores visuales en las órdenes con cambios no reconocidos. Además, cuando se detectan cambios, el sistema envía un correo electrónico a los administradores con el detalle de los cambios.

## Glosario

- **Sistema_Detección**: Servicio backend (cron job) que periódicamente consulta SQL Server, calcula hashes y detecta cambios en los datos de órdenes.
- **Snapshot**: Representación JSON de los valores actuales de una orden en un momento dado, almacenada en MySQL.
- **Hash_Snapshot**: Hash MD5/SHA-256 calculado a partir del snapshot JSON de una orden, usado para comparación rápida.
- **Orden**: Registro identificado por la combinación de `pc` (Nro) y `factura`, proveniente de las vistas HDR y FACT de SQL Server.
- **Cambio_No_Reconocido**: Cambio detectado que aún no ha sido revisado/reconocido por un administrador.
- **Vista_HDR**: Vista SQL Server `jor_imp_HDR_90_softkey` con datos de cabecera de órdenes.
- **Vista_FACT**: Vista SQL Server `jor_imp_FACT_90_softkey` con datos de facturación.
- **Vista_ITEM**: Vista SQL Server `jor_imp_item_90_softkey` con datos de ítems/líneas de la orden.
- **API_Cambios**: Endpoints REST del backend que exponen los cambios detectados al frontend.
- **Indicador_Visual**: Elemento UI (ícono/badge) en la tabla de órdenes que señala cambios no reconocidos.

## Tablas MySQL Requeridas

Las siguientes tablas deben crearse manualmente en MySQL antes de implementar el sistema:

### Tabla `order_snapshots`

Almacena el hash actual y el snapshot JSON de cada orden.

```sql
CREATE TABLE order_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pc VARCHAR(50) NOT NULL COMMENT 'Número de orden (Nro de Vista_HDR)',
  factura VARCHAR(50) DEFAULT NULL COMMENT 'Número de factura (de Vista_FACT, NULL si no tiene)',
  snapshot_hash VARCHAR(64) NOT NULL COMMENT 'Hash SHA-256 del snapshot JSON',
  snapshot_data JSON NOT NULL COMMENT 'Snapshot completo de los campos monitoreados en formato JSON',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pc_factura (pc, factura)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Tabla `order_changes`

Registra cada cambio individual detectado campo a campo.

```sql
CREATE TABLE order_changes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pc VARCHAR(50) NOT NULL COMMENT 'Número de orden',
  factura VARCHAR(50) DEFAULT NULL COMMENT 'Número de factura (NULL si no tiene)',
  field_name VARCHAR(100) NOT NULL COMMENT 'Nombre del campo que cambió',
  old_value TEXT DEFAULT NULL COMMENT 'Valor anterior del campo',
  new_value TEXT DEFAULT NULL COMMENT 'Valor nuevo del campo',
  acknowledged TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=no reconocido, 1=reconocido por admin',
  acknowledged_by INT DEFAULT NULL COMMENT 'ID del usuario que reconoció el cambio',
  acknowledged_at DATETIME DEFAULT NULL COMMENT 'Fecha/hora del reconocimiento',
  detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha/hora de detección del cambio',
  INDEX idx_pc_factura (pc, factura),
  INDEX idx_acknowledged (acknowledged),
  INDEX idx_detected_at (detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Campos Monitoreados

### Desde Vista_HDR (`jor_imp_HDR_90_softkey`)
- `ETA_OV` (fecha_eta)
- `ETD_OV` (fecha_etd)
- `MedioDeEnvioOV` (medio_envio_ov)
- `Clausula` (incoterm)
- `Puerto_Destino` (puerto_destino)
- `Puerto_Embarque` (puerto_embarque)
- `EstadoOV` (estado_ov)
- `Certificados` (certificados)
- `GtoAdicFlete` (gasto_adicional_flete)
- `FechaOriginalCompromisoCliente` (fecha_incoterm)
- `Condicion_venta` (condicion_venta)
- `Nave` (nave)

### Desde Vista_FACT (`jor_imp_FACT_90_softkey`)
- `ETA_ENC_FA` (fecha_eta_factura)
- `ETD_ENC_FA` (fecha_etd_factura)
- `MedioDeEnvioFact` (medio_envio_factura)
- `GtoAdicFleteFactura` (gasto_adicional_flete_factura)
- `Fecha_factura` (fecha_factura)

### Desde Vista_ITEM (`jor_imp_item_90_softkey`)
- `Cant_ordenada` (kg_solicitados)
- `Cant_enviada` (kg_despachados)
- `KilosFacturados` (kg_facturados)
- `Precio_Unit` (unit_price)
- `ETD_Item_OV` (fecha_etd item)
- `ETA_Item_OV` (fecha_eta item)

## Requerimientos

### Requerimiento 1: Generación de Snapshots

**User Story:** Como administrador, quiero que el sistema capture periódicamente el estado actual de las órdenes desde SQL Server, para poder detectar cuando los datos cambian.

#### Criterios de Aceptación

1. WHEN el cron job de detección de cambios se ejecuta, THE Sistema_Detección SHALL consultar las vistas Vista_HDR, Vista_FACT y Vista_ITEM de SQL Server para obtener los valores actuales de todos los campos monitoreados de cada orden activa.
2. WHEN los datos de una orden son obtenidos de SQL Server, THE Sistema_Detección SHALL normalizar los valores usando las funciones existentes (`normalizeValue`, `normalizeDate`, `normalizeDecimal`) y construir un objeto JSON (snapshot) con todos los campos monitoreados.
3. WHEN el snapshot JSON es construido, THE Sistema_Detección SHALL calcular un hash SHA-256 del snapshot serializado de forma determinista (claves ordenadas alfabéticamente).
4. THE Sistema_Detección SHALL identificar cada orden de forma única usando la combinación de `pc` y `factura` (donde `factura` puede ser NULL para órdenes sin factura).

### Requerimiento 2: Comparación de Hashes y Detección de Cambios

**User Story:** Como administrador, quiero que el sistema compare el estado actual contra el estado anterior de cada orden, para saber cuándo algo cambió.

#### Criterios de Aceptación

1. WHEN el hash calculado para una orden no coincide con el hash almacenado en la tabla `order_snapshots`, THE Sistema_Detección SHALL realizar una comparación campo a campo entre el snapshot actual y el snapshot almacenado previamente.
2. WHEN la comparación campo a campo identifica diferencias, THE Sistema_Detección SHALL insertar un registro en la tabla `order_changes` por cada campo que cambió, incluyendo el nombre del campo, el valor anterior y el valor nuevo.
3. WHEN se detectan cambios en una orden, THE Sistema_Detección SHALL actualizar el registro en `order_snapshots` con el nuevo hash y el nuevo snapshot JSON.
4. WHEN el hash calculado coincide con el hash almacenado, THE Sistema_Detección SHALL omitir la comparación campo a campo para esa orden.
5. WHEN una orden es consultada por primera vez (sin registro previo en `order_snapshots`), THE Sistema_Detección SHALL crear el registro inicial de snapshot sin generar registros de cambio en `order_changes`.

### Requerimiento 3: Configuración del Cron Job

**User Story:** Como administrador, quiero configurar la frecuencia de ejecución del cron de detección de cambios, para ajustarlo según las necesidades operativas.

#### Criterios de Aceptación

1. THE Sistema_Detección SHALL leer su configuración de habilitación y horario desde la tabla `param_config` de MySQL, usando el mismo patrón que los cron jobs existentes (`cronConfig.service.js`).
2. WHEN la tarea de detección de cambios está deshabilitada en `param_config`, THE Sistema_Detección SHALL omitir la ejecución del ciclo de detección.
3. WHEN la tarea de detección de cambios se ejecuta, THE Sistema_Detección SHALL registrar en el log la cantidad de órdenes procesadas, la cantidad de cambios detectados y el tiempo de ejecución.

### Requerimiento 4: API de Consulta de Cambios

**User Story:** Como administrador, quiero consultar los cambios detectados en las órdenes a través de endpoints REST, para poder visualizarlos en el frontend.

#### Criterios de Aceptación

1. WHEN el frontend solicita la lista de órdenes, THE API_Cambios SHALL incluir un campo `has_unacknowledged_changes` (booleano) por cada orden, indicando si tiene cambios no reconocidos en la tabla `order_changes`.
2. WHEN el frontend solicita los cambios de una orden específica (por `pc` y `factura`), THE API_Cambios SHALL retornar la lista de cambios no reconocidos con los campos: `field_name`, `old_value`, `new_value` y `detected_at`.
3. WHEN el administrador reconoce los cambios de una orden, THE API_Cambios SHALL actualizar los registros correspondientes en `order_changes` marcándolos como `acknowledged = 1`, registrando el `acknowledged_by` (ID del usuario) y `acknowledged_at` (fecha/hora actual).

### Requerimiento 5: Notificación por Correo de Cambios Detectados

**User Story:** Como administrador, quiero recibir un correo electrónico cuando el cron detecta cambios en las órdenes, para enterarme de inmediato sin tener que estar revisando la plataforma.

#### Criterios de Aceptación

1. WHEN el ciclo de detección finaliza y se detectaron uno o más cambios, THE Sistema_Detección SHALL enviar un correo electrónico a todos los usuarios con rol administrador.
2. THE correo SHALL incluir un resumen con: la cantidad de órdenes afectadas, y por cada orden el listado de campos que cambiaron con su valor anterior y valor nuevo.
3. THE correo SHALL usar el template de notificaciones existente (`notifications-summary.hbs`) o uno dedicado, manteniendo el estilo visual de los correos de Gelymar.
4. WHEN no se detectan cambios en ninguna orden durante el ciclo, THE Sistema_Detección SHALL NO enviar correo alguno.
5. THE Sistema_Detección SHALL obtener la lista de correos de administradores desde la tabla `users` de MySQL filtrando por rol administrador.

### Requerimiento 6: Manejo de Errores en la Detección

**User Story:** Como administrador, quiero que el sistema maneje errores de forma robusta durante la detección de cambios, para que una falla en una orden no detenga el procesamiento de las demás.

#### Criterios de Aceptación

1. IF ocurre un error al consultar SQL Server durante el procesamiento de una orden individual, THEN THE Sistema_Detección SHALL registrar el error en el log con el identificador de la orden (`pc`, `factura`) y continuar procesando las órdenes restantes.
2. IF ocurre un error de conexión a SQL Server al inicio del ciclo de detección, THEN THE Sistema_Detección SHALL registrar el error en el log y abortar el ciclo completo sin modificar datos en MySQL.
3. IF ocurre un error al escribir en MySQL durante la actualización de un snapshot o registro de cambio, THEN THE Sistema_Detección SHALL registrar el error en el log con el contexto de la operación fallida y continuar con la siguiente orden.

### Requerimiento 7: Serialización Determinista del Snapshot

**User Story:** Como desarrollador, quiero que la serialización del snapshot sea determinista, para que el mismo conjunto de datos siempre produzca el mismo hash.

#### Criterios de Aceptación

1. THE Sistema_Detección SHALL serializar el snapshot JSON ordenando las claves alfabéticamente antes de calcular el hash.
2. THE Sistema_Detección SHALL normalizar valores nulos, cadenas vacías y valores `undefined` a `null` antes de la serialización, para evitar falsos positivos en la detección de cambios.
3. THE Sistema_Detección SHALL normalizar valores numéricos decimales a una precisión fija (según el campo) antes de la serialización, para evitar diferencias por redondeo.
4. FOR ALL snapshots válidos, serializar y luego deserializar y volver a serializar SHALL producir una cadena idéntica (propiedad round-trip).
