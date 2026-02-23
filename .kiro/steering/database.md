---
inclusion: always
---

# Arquitectura de Base de Datos

## Estrategia Dual de Bases de Datos

La plataforma utiliza dos bases de datos con propósitos específicos:

### MySQL 8.0 - Base de Datos de Aplicación
Base de datos principal para datos operacionales de la plataforma.

### SQL Server - Base de Datos Legacy (Softkey ERP)
Sistema ERP existente, acceso de solo lectura mediante vistas.

## Tablas MySQL Principales

### Usuarios y Autenticación
```sql
users
- id, rut, email, password_hash
- role_id (1=admin, 2=client, 3=seller)
- twoFAEnabled, twoFASecret
- online (presencia en tiempo real)
- created_at, updated_at
```

### Contactos de Clientes
```sql
customer_contacts
- id, rut (FK a cliente en SQL Server)
- primary_email
- contact_email (JSON array de contactos adicionales)
- role
Estructura JSON de contact_email:
[{
  idx: number,
  nombre: string,
  email: string,
  telefono: string,
  sh_documents: boolean,  // Recibe documentos de embarque
  reports: boolean,        // Recibe reportes generados
  cco: boolean            // Siempre recibe copia
}]
```

### Archivos de Órdenes
```sql
order_files
- id, pc, oc, factura
- id_nro_ov_mas_factura (identificador de orden parcial)
- file_id (tipo de documento: 9=ORN, 19=Shipment, 15=Delivery, 6=Availability)
- file_identifier (secuencia: ORN-1, ORN-2, etc.)
- path (ruta en fileserver)
- is_visible_to_client (control de acceso)
- is_generated (0=manual, 1=automático)
- fecha_envio (timestamp de envío por email)
- lang (idioma del documento: es/en)
- created_at, updated_at
```

### Chat
```sql
chat_messages
- id, customer_id, admin_id
- message (encriptado con AES)
- sender_type (admin/customer)
- is_read, is_security_message
- created_at
```

### Configuración de Cron
```sql
cron_tasks_config
- id, task_name
- is_enabled (boolean)
- updated_at
```

### Vendedores
```sql
sellers
- id, rut, codigo
- Mapea RUT de vendedor a código Softkey
- Usado para filtrar órdenes por vendedor
```

### Idioma por País
```sql
country_lang
- id, country, lang
- Determina idioma de documentos según país del cliente
```

## Vistas SQL Server (Softkey)

### jor_imp_HDR_90_softkey - Encabezados de Órdenes
```sql
Campos principales:
- Nro (PC - Purchase Order Number)
- OC (Order Code del cliente)
- Rut (Cliente)
- Fecha (Fecha de ingreso)
- Factura (Número de factura, NULL para orden padre)
- IDNroOvMasFactura (Identificador único de orden parcial)
- Fecha_factura
- ETD_OV, ETA_OV (fechas orden de venta)
- ETD_ENC_FA, ETA_ENC_FA (fechas factura)
- Job (Moneda: USD, CLP, EUR)
- MedioDeEnvioFact, MedioDeEnvioOV (transporte)
- Clausula (Incoterm: FOB, CIF, etc.)
- Puerto_Destino, Puerto_Embarque
- Certificados
- EstadoOV (estado de la orden)
- Vendedor (código de vendedor)
- Direccion, Direccion_Alterna
- Tipo, Condicion_venta, Nave
```

### jor_imp_ITEM_90_softkey - Líneas de Items
```sql
Campos principales:
- Nro (PC)
- Linea (número de línea)
- Item (código de producto)
- Descripcion
- Tipo, Localizacion, Mercado
- Cant_ordenada (kg_solicitados)
- Cant_enviada (kg_despachados)
- KilosFacturados (kg_facturados)
- Precio_Unit (precio unitario)
- Factura (vincula a orden parcial)
- IDNroOvMasFactura
- ETD_Item_OV, ETA_Item_OV
- Embalaje, Volumen, Etiqueta
- Comentario (observaciones)
```

### jor_imp_CLI_01_softkey - Clientes
```sql
Campos principales:
- Rut (identificador único)
- Nombre
- Direccion, Direccion2
- Ciudad, Pais
- Contacto, Contacto2
- Telefono, Fax
- Correo (email)
```

### jor_imp_PRO_01_softkey - Productos
```sql
Campos principales:
- Codigo (código de producto)
- Descripcion
- Categoria, Subcategoria
- Unidad_medida
```

## Patrones de Consulta

### Órdenes Parciales (Parcializadas)
Las órdenes pueden dividirse en múltiples facturas manteniendo el mismo PC/OC:
```sql
-- Orden padre (sin factura)
SELECT * FROM jor_imp_HDR_90_softkey 
WHERE Nro = 'PC123' 
  AND (Factura IS NULL OR Factura = '' OR Factura = 0)

-- Órdenes parciales (con factura)
SELECT * FROM jor_imp_HDR_90_softkey 
WHERE Nro = 'PC123' 
  AND Factura IS NOT NULL 
  AND Factura != '' 
  AND Factura != 0
```

### Normalización de OC
Los códigos OC se normalizan para comparación:
```javascript
// Remover espacios, guiones y paréntesis
normalizeOc = (oc) => oc.toUpperCase().replace(/[\s()-]+/g, '')
```

### Normalización de RUT
Los RUT se normalizan removiendo sufijo 'C':
```javascript
normalizeRut = (rut) => rut.trim().replace(/C$/i, '')
```

### Filtrado por Vendedor
```sql
-- 1. Obtener códigos de vendedor desde MySQL
SELECT codigo FROM sellers WHERE rut = ?

-- 2. Filtrar órdenes en SQL Server
SELECT * FROM jor_imp_HDR_90_softkey 
WHERE Vendedor IN (codigo1, codigo2, ...)
```

## Mappers (Transformación de Datos)

### hdr.mapper.js - Encabezados
Transforma campos de SQL Server a formato de aplicación:
- `Nro` → `pc`
- `OC` → `oc`
- `Rut` → `rut`
- `Fecha` → `fecha`
- `ETD_OV` → `fecha_etd`
- Normaliza fechas, valores nulos, decimales

### item.mapper.js - Items
Transforma líneas de items:
- `Item` → `item_code`
- `Descripcion` → `item_name`
- `Cant_ordenada` → `kg_solicitados`
- `Precio_Unit` → `unit_price`
- Normaliza decimales a 4 posiciones

### cli.mapper.js - Clientes
Transforma datos de clientes para uso en aplicación.

## Reglas de Integridad

### Órdenes
- PC es único por orden padre
- PC + Factura es único por orden parcial
- IDNroOvMasFactura es único global
- ORN solo se genera para orden padre (Factura IS NULL)

### Archivos
- file_identifier incrementa por PC (ORN-1, ORN-2, etc.)
- Un archivo por combinación PC + OC + Factura + file_id
- is_visible_to_client controla acceso del cliente

### Contactos
- Un registro por RUT en customer_contacts
- contact_email es JSON array
- primary_email es el email principal del cliente

## Consideraciones de Performance

### Índices Recomendados (MySQL)
```sql
-- order_files
INDEX idx_pc_oc (pc, oc)
INDEX idx_file_id (file_id)
INDEX idx_visible (is_visible_to_client)

-- users
INDEX idx_rut (rut)
INDEX idx_role (role_id)

-- customer_contacts
INDEX idx_rut (rut)

-- chat_messages
INDEX idx_customer (customer_id)
INDEX idx_admin (admin_id)
INDEX idx_read (is_read)
```

### Timeouts
- SQL Server: 60 segundos por consulta
- MySQL: Sin timeout explícito (usa connection pool)

### Connection Pooling
- MySQL: 10 conexiones máximo, wait for connections habilitado
- SQL Server: 10 max, 0 min, 30s idle timeout

## Backup y Recuperación

### Backup Automático
- Cron job: `sendDbBackup.js`
- Frecuencia: Configurable
- Método: mysqldump vía cron
- Destino: Email a administradores

### Datos Críticos
- Usuarios y autenticación
- Mensajes de chat (encriptados)
- Configuraciones de cron
- Mapeo de archivos a órdenes
