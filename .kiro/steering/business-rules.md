---
inclusion: always
---

# Reglas de Negocio

## Órdenes y Parcialización

### Órdenes Parciales (Parcializadas)
Una orden puede dividirse en múltiples órdenes parciales que comparten el mismo PC (Purchase Order) y OC (Order Code):

- **Orden Padre**: Primera orden, sin factura (Factura IS NULL o vacío)
- **Órdenes Parciales**: Órdenes derivadas con el mismo PC/OC pero diferente factura
- **Identificador Único**: `IDNroOvMasFactura` identifica cada orden parcial de forma única
- **Items**: Cada orden parcial tiene sus propios items con cantidades específicas

### Ejemplo de Parcialización
```
Orden Padre:
- PC: 12345
- OC: CLI-2024-001
- Factura: NULL
- IDNroOvMasFactura: NULL
- Items: 1000 kg Producto A

Orden Parcial 1:
- PC: 12345
- OC: CLI-2024-001
- Factura: FAC-001
- IDNroOvMasFactura: 12345-FAC-001
- Items: 600 kg Producto A

Orden Parcial 2:
- PC: 12345
- OC: CLI-2024-001
- Factura: FAC-002
- IDNroOvMasFactura: 12345-FAC-002
- Items: 400 kg Producto A
```

## Generación de Documentos

### Aviso de Recepción de Orden (ORN)
- **REGLA CRÍTICA**: ORN solo se genera para la orden padre, NUNCA para órdenes parciales
- Condición: `Factura IS NULL OR Factura = '' OR Factura = 0`
- Momento: Cuando la orden ingresa al sistema (campo `Fecha` en SQL Server)
- Contenido: Información completa de la orden padre
- Identificador: file_id = 9

### Aviso de Embarque (Shipment Notice)
- Se genera para cada orden parcial cuando tiene factura
- Condición: `Factura IS NOT NULL AND Factura != ''`
- Momento: Cuando la orden es facturada y lista para embarque
- Contenido: Detalles de embarque, items específicos de esa factura
- Identificador: file_id = 19

### Aviso de Entrega (Delivery Notice)
- Se genera para cada orden parcial
- Momento: Cuando la orden llega a destino
- Contenido: Confirmación de entrega, items recibidos
- Identificador: file_id = 15

### Aviso de Disponibilidad (Availability Notice)
- Se genera para cada orden parcial
- Momento: Cuando los productos están disponibles para retiro
- Contenido: Productos disponibles, ubicación
- Identificador: file_id = 6

### Secuencia de Documentos
```
1. Orden ingresa → ORN (solo orden padre)
2. Orden facturada → Shipment Notice (por cada factura)
3. Orden embarcada → Delivery Notice (por cada factura)
4. Productos disponibles → Availability Notice (por cada factura)
```

## Permisos de Contactos

### Tipos de Permisos
Cada contacto de cliente tiene tres flags booleanos:

1. **sh_documents** (Shipment Documents)
   - Recibe documentos de embarque manuales
   - Aplica a documentos con `is_generated = 0`
   - Uso: Documentos subidos manualmente por admin

2. **reports** (Reports)
   - Recibe reportes y documentos generados automáticamente
   - Aplica a documentos con `is_generated = 1`
   - Uso: PDFs generados por el sistema (ORN, Shipment, Delivery, Availability)

3. **cco** (Carbon Copy)
   - Siempre recibe copia de todos los emails
   - Ignora otros permisos
   - Uso: Gerentes, supervisores que necesitan visibilidad total

### Lógica de Envío de Emails
```javascript
// Modo 0: Documento manual
if (is_generated === 0) {
  recipients = contacts.filter(c => c.sh_documents === true || c.cco === true)
}

// Modo 1: Documento generado
if (is_generated === 1) {
  recipients = contacts.filter(c => c.reports === true || c.cco === true)
}
```

### Validación de Permisos
- Si un contacto no tiene `sh_documents` ni `reports` habilitados, NO recibe emails (excepto si tiene `cco`)
- Si un contacto tiene `cco = true`, recibe TODOS los emails independientemente de otros flags
- Si no hay contactos con permisos adecuados, el email NO se envía y se registra error

## Roles de Usuario

### Admin (role_id = 1)
- Acceso completo al sistema
- Gestión de usuarios y configuraciones
- Visualización de todas las órdenes
- Generación manual de documentos
- Configuración de cron jobs
- Acceso al chat con todos los clientes

### Cliente (role_id = 2)
- Visualización de sus propias órdenes (filtradas por RUT)
- Descarga de documentos visibles (`is_visible_to_client = 1`)
- Chat con administradores
- Actualización de datos de contacto
- Sin acceso a órdenes de otros clientes

### Vendedor (role_id = 3)
- Visualización de órdenes de sus clientes asignados
- Filtrado por código de vendedor en Softkey
- Gestión de contactos de sus clientes
- Creación de órdenes (si implementado)
- Reportes de ventas
- Sin acceso a configuraciones del sistema

### Mapeo de Vendedores
```sql
-- Tabla sellers en MySQL
rut → codigo (código Softkey)

-- Filtrado en SQL Server
SELECT * FROM jor_imp_HDR_90_softkey 
WHERE Vendedor IN (SELECT codigo FROM sellers WHERE rut = ?)
```

## Visibilidad de Archivos

### Control de Acceso
- Campo `is_visible_to_client` en tabla `order_files`
- Por defecto: `0` (no visible)
- Se marca como `1` cuando:
  - Documento es generado automáticamente
  - Admin marca manualmente como visible
  - Documento es enviado por email al cliente

### Validación de Acceso
```javascript
// Cliente solo puede ver archivos de sus órdenes
1. Verificar que user.rut coincide con order.rut
2. Verificar que is_visible_to_client = 1
3. Permitir descarga/visualización

// Vendedor puede ver archivos de sus clientes
1. Verificar que vendedor tiene acceso al cliente
2. Verificar que is_visible_to_client = 1
3. Permitir descarga/visualización

// Admin puede ver todos los archivos
Sin restricciones
```

## Notificaciones Automáticas

### Configuración de Envío
Cada tipo de notificación tiene configuración en tabla `config`:
- `sendAutomaticOrderReception`: Habilita/deshabilita ORN automático
- `sendAutomaticOrderShipment`: Habilita/deshabilita Shipment Notice
- `sendAutomaticOrderDelivery`: Habilita/deshabilita Delivery Notice
- `sendAutomaticOrderAvailability`: Habilita/deshabilita Availability Notice

### Parámetros de Configuración
```json
{
  "enable": 1,  // 0=deshabilitado, 1=habilitado
  "sendFrom": "2024-01-01"  // Fecha desde la cual procesar órdenes
}
```

### Horarios de Ejecución (Cron)
- **ORN**: 10:00 AM diario
- **Shipment Notice**: Configurable
- **Delivery Notice**: Configurable
- **Availability Notice**: Configurable
- **Admin Notifications**: Configurable

### Lógica de Envío
1. Verificar si envío automático está habilitado
2. Obtener órdenes que cumplen condiciones
3. Verificar si ya se envió (campo `fecha_envio`)
4. Generar PDF si no existe
5. Obtener contactos con permisos adecuados
6. Enviar email a contactos autorizados
7. Marcar archivo como enviado (`fecha_envio = NOW()`)
8. Marcar como visible al cliente (`is_visible_to_client = 1`)

## Chat y Presencia

### Estados de Presencia
- **online = 1**: Usuario conectado activamente
- **online = 0**: Usuario desconectado
- Actualización en tiempo real vía Socket.io
- Timeout de token JWT actualiza estado a offline

### Notificaciones de Chat
- Admin offline recibe email cuando cliente envía mensaje
- Email incluye preview del mensaje y link al portal
- Mensajes encriptados en base de datos (AES)
- Soporte para mensajes de texto e imágenes

### Rooms de Socket.io
- `admin-room`: Broadcast a todos los admins
- `admin-{userId}`: Mensajes directos a admin específico
- `customer-{customerId}`: Mensajes a cliente específico

## Idioma y Localización

### Determinación de Idioma
1. Obtener país del cliente desde SQL Server (`Pais` en `jor_imp_CLI_01_softkey`)
2. Buscar idioma en tabla `country_lang`
3. Default: `en` (inglés)
4. Idiomas soportados: `es` (español), `en` (inglés)

### Aplicación de Idioma
- PDFs generados en idioma del cliente
- Emails enviados en idioma del cliente
- Templates Handlebars con i18n (Backend/pdf-generator/i18n/, Backend/mail-generator/i18n/)

## Sincronización con Softkey

### Frecuencia
- Cron master: 7:00 AM diario
- Secuencia: Client Access → Default Files

### Proceso de Sincronización
1. **Check Client Access**: Verifica clientes sin cuenta, crea usuarios
2. **Check Default Files**: Genera placeholders de documentos para órdenes nuevas

### Datos Sincronizados
- Clientes nuevos desde SQL Server
- Órdenes nuevas y actualizaciones
- Items de órdenes
- Productos del catálogo

### Mapeo de Datos
- Transformación vía mappers (Backend/mappers/sqlsoftkey/)
- Normalización de fechas, decimales, valores nulos
- Conversión de tipos de datos SQL Server → MySQL
