# Design Document: SQL Server Views Refactoring

## Overview

Este documento describe el diseño técnico para refactorizar el código backend de la aplicación de gestión documental Gelymar para adaptarse a la nueva estructura de vistas en SQL Server. La refactorización principal consiste en eliminar la duplicidad de datos que existía en Vista_HDR, separando las órdenes de compra de sus facturas asociadas en vistas independientes.

### Current State (Before Refactoring)

La vista `jor_imp_HDR_90_softkey` (Vista_HDR) contenía:
- Múltiples filas por PC (Purchase Order) cuando existían múltiples facturas
- Campos de orden (PC, OC, Fecha, ETD_OV, ETA_OV, etc.)
- Campos de factura (Factura, Fecha_factura, ETD_ENC_FA, ETA_ENC_FA, etc.)
- Duplicidad de datos de orden en cada fila de factura

### Target State (After Refactoring)

**Vista_HDR** (`jor_imp_HDR_90_softkey`):
- Una sola fila por PC (sin duplicidad)
- Solo campos de orden
- Sin campos de factura

**ESTRUCTURA REAL DE Vista_HDR** (ejemplo con Nro=21475):
```
IDNroOvMasFactura | Tipo | Nro   | Fecha     | OC                    | RCO | Rut         | Direccion | Direccion_alterna | Job | Condicion_venta       | Localizacion | Cod_Impto | Vendedor | Certificados | Puerto_Embarque | Nave | Puerto_Destino | Clausula | Factura | Fecha_factura | EstadoOV | ETD_OV | ETA_OV | MedioDeEnvioFact | GtoAdicFlete | FechaOriginalCompromisoCliente | GtoAdicFleteFactura | MedioDeEnvioOV | ETD_ENC_FA | ETA_ENC_FA
------------------|------|-------|-----------|----------------------|-----|-------------|-----------|-------------------|-----|----------------------|--------------|-----------|----------|--------------|-----------------|------|----------------|----------|---------|---------------|----------|--------|--------|------------------|--------------|--------------------------------|---------------------|----------------|------------|------------
214751019271      | OV   | 21475 | 2026-2-25 | GEL 779 - 782 (AEREO)| ... | 33002413-5C | ...       | Ciudad de México  | USD | 120 days Invoice Date|              | IVA_EXE   | 44       | Análisis S.  |                 |      |                | CIP      | 1019271 | 2026-2-26     | Cerrada  |        |        | Aéreo            |              | 2026-03-09 00:00:00.000        | 0.000000            | Aéreo          |            |
```

**IMPORTANTE**: Vista_HDR contiene el campo `Clausula` (Incoterm = CIP en este ejemplo). Este es un atributo de la orden.

**Vista_FACT** (`jor_imp_FACT_90_softkey`) - NUEVA:
- Una fila por cada factura
- Campos de factura relacionados con el PC
- Relación: Vista_FACT.Nro → Vista_HDR.Nro

**ESTRUCTURA REAL DE Vista_FACT** (ejemplo con Nro=21475):
```
Factura | Fecha_factura | Nro   | Cod_Impto | MedioDeEnvioFact | GtoAdicFleteFactura | ETD_ENC_FA | ETA_ENC_FA
--------|---------------|-------|-----------|------------------|---------------------|------------|------------
1019271 | 2026-2-26     | 21475 | IVA_EXE   | Aéreo            | 0.000000            |            |
```

**IMPORTANTE**: Vista_FACT NO contiene el campo `Clausula` (Incoterm). El Incoterm es un atributo de la orden y solo existe en Vista_HDR.

**Vista_ITEM** (`jor_imp_item_90_softkey`):
- Sin cambios estructurales
- Mantiene el campo Factura para relacionar items con facturas
- Relación: Vista_ITEM.Nro → Vista_FACT.Nro

**ESTRUCTURA REAL DE Vista_ITEM** (ejemplo con Nro=21475):
```
IDNroOvMasFactura | Tipo | Nro   | Linea | Factura | Localizacion | Item         | Descripcion        | Cant_ordenada | Cant_enviada | Precio_Unit | Comentario | Mercado | Embalaje | Volumen  | Etiqueta | Kto_Etiqueta5 | ETD_Item_OV | ETA_Item_OV | KilosFacturados | ETD_ENC_FA | ETA_ENC_FA
------------------|------|-------|-------|---------|--------------|--------------|--------------------|--------------|--------------|-----------|-----------|---------|---------|---------|---------|--------------|-----------|-----------|-----------------|------------|------------
214751019271      | OV   | 21475 | 0     | 1019271 | P01          | PFALPGU09131 | GELY ALG PGU 9131  | 600.000000   | 600.000000   | 12.340000  |           | US      |         | 0.000000 |          |              |            |            | 600.000000      |            |
214751019271      | OV   | 21475 | 1     | 1019271 | P01          | PFCLDDE05429 | CARRALACT DDE 5429 | 200.000000   | 200.000000   | 7.160000   |           | US      |         | 0.000000 |          |              |            |            | 200.000000      |            |
214751019271      | OV   | 21475 | 2     | 1019271 | P01          | PFGELYCASSIA | GELY CASSIA        | 300.000000   | 300.000000   | 8.620000   |           | US      |         | 0.000000 |          |              |            |            | 300.000000      |            |
214751019271      | OV   | 21475 | 3     | 1019271 | P01          | PFGGGUM07254 | GELY GUM 7254      | 100.000000   | 100.000000   | 11.000000  |           | US      |         | 0.000000 |          |              |            |            | 100.000000      |            |
214751019271      | OV   | 21475 | 4     | 1019271 | P01          | PFCLDCR05423 | CARRALACT DCR 5423 | 100.000000   | 100.000000   | 16.780000  |           | US      |         | 0.000000 |          |              |            |            | 100.000000      |            |
```

**IMPORTANTE**: Vista_ITEM contiene el campo `Factura` (1019271 en este ejemplo) que relaciona cada item con su factura en Vista_FACT.

### Data Flow

```
Vista_HDR (Orders)
    ↓ (1:N via Nro/PC)
Vista_FACT (Invoices)
    ↓ (1:N via Nro/PC + Factura)
Vista_ITEM (Items)
```

### Key Design Principles

1. **Separation of Concerns**: Órdenes y facturas se manejan en mappers y queries separados
2. **Backward Compatibility**: Mantener la misma interfaz pública en servicios
3. **Data Integrity**: Usar JOINs apropiados (LEFT/INNER) según el caso de uso
4. **Business Rules Preservation**: Todas las reglas de negocio existentes se mantienen intactas
5. **Query Optimization**: Minimizar queries redundantes usando JOINs eficientes

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Services Layer                        │
│  (order.service, checkOrderReception.service, etc.)         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                       Mappers Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ hdr.mapper   │  │ fact.mapper  │  │ item.mapper  │      │
│  │ (Orders)     │  │ (Invoices)   │  │ (Items)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                    SQL Server Views                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Vista_HDR   │  │  Vista_FACT  │  │  Vista_ITEM  │      │
│  │  (1 per PC)  │  │ (N per PC)   │  │ (N per Fact) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Mapper Architecture

#### New Mapper: fact.mapper.js

**Purpose**: Transform Vista_FACT rows to JavaScript invoice objects

**Location**: `Backend/mappers/sqlsoftkey/fact.mapper.js`

**Responsibilities**:
- Map invoice-specific fields from Vista_FACT
- Apply data normalization (dates, decimals, strings)
- Provide consistent interface for invoice data

**Fields Mapped**:
```javascript
{
  pc: Nro,                          // Link to order
  factura: Factura,                 // Invoice number
  fecha_factura: Fecha_factura,     // Invoice date
  fecha_etd_factura: ETD_ENC_FA,    // Invoice ETD
  fecha_eta_factura: ETA_ENC_FA,    // Invoice ETA
  // NOTE: incoterm (Clausula) does NOT exist in Vista_FACT - it's in Vista_HDR only
  medio_envio_factura: MedioDeEnvioFact,  // Shipping method
  gasto_adicional_flete: GtoAdicFleteFactura,  // Additional freight cost
}
```

**IMPORTANT**: The `Clausula` (Incoterm) field does NOT exist in Vista_FACT. Incoterm is an order-level attribute and must be obtained from Vista_HDR.
  medio_envio_factura: MedioDeEnvioFact,  // Shipping method
  gasto_adicional_flete: GtoAdicFleteFactura,  // Additional freight cost
  id_nro_ov_mas_factura: IDNroOvMasFactura  // Unique order+invoice ID
}
```

#### Updated Mapper: hdr.mapper.js

**Changes**: Remove invoice-related fields

**Fields Removed**:
- `factura` (Factura)
- `fecha_factura` (Fecha_factura)
- `fecha_etd_factura` (ETD_ENC_FA)
- `fecha_eta_factura` (ETA_ENC_FA)
- `medio_envio_factura` (MedioDeEnvioFact)

**Fields Retained**:
```javascript
{
  pc: Nro,
  oc: OC,
  rut: Rut,
  fecha: Fecha,
  fecha_etd: ETD_OV,
  fecha_eta: ETA_OV,
  currency: Job,
  medio_envio_ov: MedioDeEnvioOV,
  incoterm: Clausula,
  puerto_destino: Puerto_Destino,
  certificados: Certificados,
  estado_ov: EstadoOV,
  vendedor: Vendedor,
  id_nro_ov_mas_factura: IDNroOvMasFactura
}
```

#### Unchanged Mapper: item.mapper.js

**Status**: No changes required

**Key Field**: Maintains `factura` field to link items to invoices

### Query Transformation Patterns

#### Pattern 1: Orders Without Invoices (ORN Documents)

**BEFORE** (Old Vista_HDR with duplicity):
```sql
SELECT h.Nro, h.OC, h.Factura, ...
FROM jor_imp_HDR_90_softkey h
WHERE (h.Factura IS NULL OR h.Factura = '' OR h.Factura = 0)
```

**AFTER** (New Vista_HDR without duplicity):
```sql
SELECT h.Nro, h.OC, ...
FROM jor_imp_HDR_90_softkey h
WHERE NOT EXISTS (
  SELECT 1 FROM jor_imp_FACT_90_softkey f
  WHERE f.Nro = h.Nro
    AND f.Factura IS NOT NULL
    AND LTRIM(RTRIM(f.Factura)) <> ''
    AND f.Factura <> 0
)
```

**Alternative** (Simpler, if Vista_HDR no longer has Factura field):
```sql
SELECT h.Nro, h.OC, ...
FROM jor_imp_HDR_90_softkey h
LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
WHERE f.Nro IS NULL
```

#### Pattern 2: Orders With Invoices (Shipment/Delivery/Availability)

**BEFORE** (Old Vista_HDR with duplicity):
```sql
SELECT h.Nro, h.OC, h.Factura, h.ETD_ENC_FA, h.ETA_ENC_FA, ...
FROM jor_imp_HDR_90_softkey h
WHERE h.Factura IS NOT NULL AND h.Factura <> ''
  AND ISDATE(h.ETD_ENC_FA) = 1
```

**AFTER** (New Vista_FACT):
```sql
SELECT h.Nro, h.OC, f.Factura, f.ETD_ENC_FA, f.ETA_ENC_FA, ...
FROM jor_imp_HDR_90_softkey h
INNER JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
WHERE f.Factura IS NOT NULL
  AND LTRIM(RTRIM(f.Factura)) <> ''
  AND f.Factura <> 0
  AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETD_ENC_FA)), '')) = 1
```

#### Pattern 3: Order Details with All Invoices

**BEFORE** (Old Vista_HDR with duplicity):
```sql
SELECT h.Nro, h.OC, h.Factura, h.Fecha_factura, ...
FROM jor_imp_HDR_90_softkey h
WHERE h.Nro = @pc
```
*This returned multiple rows per PC*

**AFTER** (New structure with explicit JOIN):
```sql
-- Get order (single row)
SELECT h.Nro, h.OC, h.Fecha, h.ETD_OV, ...
FROM jor_imp_HDR_90_softkey h
WHERE h.Nro = @pc

-- Get invoices for order (multiple rows)
SELECT f.Nro, f.Factura, f.Fecha_factura, f.ETD_ENC_FA, ...
FROM jor_imp_FACT_90_softkey f
WHERE f.Nro = @pc
  AND f.Factura IS NOT NULL
  AND LTRIM(RTRIM(f.Factura)) <> ''
```

**Alternative** (Single query with LEFT JOIN):
```sql
SELECT 
  h.Nro, h.OC, h.Fecha, h.ETD_OV, ...,
  f.Factura, f.Fecha_factura, f.ETD_ENC_FA, ...
FROM jor_imp_HDR_90_softkey h
LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
WHERE h.Nro = @pc
```

#### Pattern 4: Items by Invoice

**BEFORE** (Implicit relationship):
```sql
SELECT i.Nro, i.Linea, i.Item, i.Factura, ...
FROM jor_imp_item_90_softkey i
WHERE i.Nro = @pc AND i.Factura = @factura
```

**AFTER** (Explicit relationship with Vista_FACT):
```sql
SELECT i.Nro, i.Linea, i.Item, i.Factura, ...
FROM jor_imp_item_90_softkey i
INNER JOIN jor_imp_FACT_90_softkey f 
  ON f.Nro = i.Nro AND f.Factura = i.Factura
WHERE i.Nro = @pc AND i.Factura = @factura
```

*Note: The explicit JOIN validates that the invoice exists in Vista_FACT*

#### Pattern 5: Items Without Invoice (ORN Items)

**BEFORE**:
```sql
SELECT i.Nro, i.Linea, i.Item, ...
FROM jor_imp_item_90_softkey i
WHERE i.Nro = @pc
  AND (i.Factura IS NULL OR i.Factura = '' OR i.Factura = 0)
```

**AFTER** (Same, Vista_ITEM unchanged):
```sql
SELECT i.Nro, i.Linea, i.Item, ...
FROM jor_imp_item_90_softkey i
WHERE i.Nro = @pc
  AND (i.Factura IS NULL OR LTRIM(RTRIM(i.Factura)) = '' OR i.Factura = 0)
```

## Components and Interfaces

### Mapper Interfaces

#### fact.mapper.js

```javascript
/**
 * Maps a Vista_FACT row to an invoice object
 * @param {Object} row - Raw row from Vista_FACT
 * @returns {Object} Normalized invoice object
 */
function mapFactRowToInvoice(row = {}) {
  return {
    pc: normalizeValue(row.Nro),
    factura: normalizeValue(row.Factura),
    fecha_factura: normalizeDate(row.Fecha_factura),
    fecha_etd_factura: normalizeDate(row.ETD_ENC_FA),
    fecha_eta_factura: normalizeDate(row.ETA_ENC_FA),
    incoterm: normalizeValue(row.Clausula),
    medio_envio_factura: normalizeValue(row.MedioDeEnvioFact),
    gasto_adicional_flete: normalizeDecimal(row.GtoAdicFleteFactura, 2),
    id_nro_ov_mas_factura: normalizeValue(row.IDNroOvMasFactura)
  };
}

module.exports = {
  mapFactRowToInvoice
};
```

#### hdr.mapper.js (Updated)

```javascript
/**
 * Maps a Vista_HDR row to an order object
 * @param {Object} row - Raw row from Vista_HDR
 * @returns {Object} Normalized order object
 */
function mapHdrRowToOrder(row = {}) {
  return {
    pc: normalizeValue(row.Nro),
    oc: normalizeValue(row.OC),
    rut: normalizeValue(row.Rut),
    fecha: normalizeDate(row.Fecha),
    fecha_etd: normalizeDate(row.ETD_OV),
    fecha_eta: normalizeDate(row.ETA_OV),
    currency: normalizeValue(row.Job),
    medio_envio_ov: normalizeValue(row.MedioDeEnvioOV),
    incoterm: normalizeValue(row.Clausula),
    puerto_destino: normalizeValue(row.Puerto_Destino),
    certificados: normalizeValue(row.Certificados),
    estado_ov: normalizeValue(row.EstadoOV),
    vendedor: normalizeValue(row.Vendedor),
    id_nro_ov_mas_factura: normalizeValue(row.IDNroOvMasFactura)
  };
}

module.exports = {
  mapHdrRowToOrder
};
```

### Service Interfaces

#### order.service.js

**Key Functions**:

```javascript
/**
 * Get orders by filters
 * NOW: Performs LEFT JOIN with Vista_FACT to include invoice data
 */
async function getOrdersByFilters(filters = {})

/**
 * Get order by PC
 * NOW: Returns order + array of invoices
 */
async function getOrderByPc(pc)

/**
 * Get order items
 * NOW: Filters by PC and optional Factura
 */
async function getOrderItems(pc, factura = null)
```

**Query Strategy**:
- Use LEFT JOIN when invoices are optional
- Use INNER JOIN when invoices are required
- Separate queries for order vs invoices when clearer

#### checkOrderReception.service.js

**Key Function**:

```javascript
/**
 * Get orders ready for ORN (Order Receipt Notice)
 * NOW: Queries Vista_HDR and filters out orders with invoices
 */
async function getOrdersReadyForOrderReceiptNotice(sendFromDate, filterPc, filterFactura)
```

**Query Strategy**:
```sql
SELECT h.Nro, h.OC, ...
FROM jor_imp_HDR_90_softkey h
LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
WHERE f.Nro IS NULL  -- No invoices exist
  AND ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
```

#### checkShipmentNotice.service.js

**Key Function**:

```javascript
/**
 * Get orders ready for Shipment Notice
 * NOW: Queries Vista_FACT directly (one document per invoice)
 */
async function getOrdersReadyForShipmentNotice(sendFromDate, filterPc, filterFactura)
```

**Query Strategy**:
```sql
SELECT f.Nro, f.Factura, f.ETD_ENC_FA, f.ETA_ENC_FA, ...
FROM jor_imp_FACT_90_softkey f
INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
WHERE f.Factura IS NOT NULL
  AND LTRIM(RTRIM(f.Factura)) <> ''
  AND f.Factura <> 0
  AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETD_ENC_FA)), '')) = 1
  AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1
  AND f.Clausula IN ('CFR', 'CIF', 'CIP', 'DAP', 'DDP')
```

#### checkOrderDeliveryNotice.service.js

**Key Function**:

```javascript
/**
 * Get orders ready for Delivery Notice
 * NOW: Queries Vista_FACT directly (one document per invoice)
 */
async function getOrdersReadyForOrderDeliveryNotice(sendFromDate, filterPc, filterFactura)
```

**Query Strategy**:
```sql
SELECT f.Nro, f.Factura, f.ETA_ENC_FA, ...
FROM jor_imp_FACT_90_softkey f
INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
WHERE f.Factura IS NOT NULL
  AND LTRIM(RTRIM(f.Factura)) <> ''
  AND f.Factura <> 0
  AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1
  AND DATEADD(day, 7, CAST(f.ETA_ENC_FA AS date)) <= CAST(GETDATE() AS date)
```

#### checkAvailabilityNotice.service.js

**Key Function**:

```javascript
/**
 * Get orders ready for Availability Notice
 * NOW: Queries Vista_FACT directly (one document per invoice)
 */
async function getOrdersReadyForAvailabilityNotice(sendFromDate, filterPc, filterFactura)
```

**Query Strategy**:
```sql
SELECT f.Nro, f.Factura, f.Clausula, ...
FROM jor_imp_FACT_90_softkey f
INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
WHERE f.Factura IS NOT NULL
  AND LTRIM(RTRIM(f.Factura)) <> ''
  AND f.Factura <> 0
  AND f.Clausula IN ('EWX', 'FCA', 'FOB', 'FCA Port', 'FCA Warehouse Santiago', 'FCA Airport', 'FCAWSTGO')
```

## Data Models

### Order Model (from Vista_HDR)

```javascript
{
  pc: String,              // Purchase Order number (Nro)
  oc: String,              // Order Code
  rut: String,             // Customer RUT
  fecha: String,           // Order date (YYYY-MM-DD)
  fecha_etd: String,       // Order ETD (YYYY-MM-DD)
  fecha_eta: String,       // Order ETA (YYYY-MM-DD)
  currency: String,        // Currency (Job)
  medio_envio_ov: String,  // Order shipping method
  incoterm: String,        // Incoterm (Clausula)
  puerto_destino: String,  // Destination port
  certificados: String,    // Certificates
  estado_ov: String,       // Order status
  vendedor: String,        // Seller code
  id_nro_ov_mas_factura: String  // Unique order+invoice ID
}
```

### Invoice Model (from Vista_FACT)

```javascript
{
  pc: String,                    // Purchase Order number (Nro) - FK to Order
  factura: String,               // Invoice number
  fecha_factura: String,         // Invoice date (YYYY-MM-DD)
  fecha_etd_factura: String,     // Invoice ETD (YYYY-MM-DD)
  fecha_eta_factura: String,     // Invoice ETA (YYYY-MM-DD)
  incoterm: String,              // Incoterm (Clausula)
  medio_envio_factura: String,   // Invoice shipping method
  gasto_adicional_flete: Number, // Additional freight cost
  id_nro_ov_mas_factura: String  // Unique order+invoice ID
}
```

### Item Model (from Vista_ITEM)

```javascript
{
  pc: String,              // Purchase Order number (Nro) - FK to Order
  factura: String,         // Invoice number - FK to Invoice (nullable)
  linea: Number,           // Line number
  item_code: String,       // Item code
  item_name: String,       // Item name
  tipo: String,            // Type
  localizacion: String,    // Location
  descripcion: String,     // Description
  kg_solicitados: Number,  // Requested kg
  kg_despachados: Number,  // Dispatched kg
  kg_facturados: Number,   // Invoiced kg
  unit_price: Number,      // Unit price
  observacion: String,     // Observation
  mercado: String,         // Market
  embalaje: String,        // Packaging
  volumen: Number,         // Volume
  etiqueta: String,        // Label
  kto_etiqueta5: String,   // Label 5
  fecha_etd: String,       // Item ETD
  fecha_eta: String,       // Item ETA
  fecha_etd_factura: String,  // Invoice ETD
  fecha_eta_factura: String,  // Invoice ETA
  unidad_medida: String    // Unit of measure
}
```

### Relationships

```
Order (1) ←→ (N) Invoice
  via: Order.pc = Invoice.pc

Invoice (1) ←→ (N) Item
  via: Invoice.pc = Item.pc AND Invoice.factura = Item.factura

Order (1) ←→ (N) Item (without invoice)
  via: Order.pc = Item.pc WHERE Item.factura IS NULL
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties and performed redundancy elimination:

**Redundancy Analysis**:
- Properties 3.2, 3.3, 3.4 (various order query functions) can be consolidated into a single property about correct JOIN usage
- Properties 5.3, 6.3, 7.3 (document generation per invoice) are all the same pattern and can be consolidated
- Properties 9.2, 10.2, 11.2, 13.2 (querying Vista_HDR for orders) are redundant with general query correctness
- Properties 14.2, 14.3, 14.4 (result equivalence, field names, data types) can be consolidated into one comprehensive equivalence property
- Properties 16.4 and 16.5 (LEFT JOIN vs INNER JOIN) can be combined into one property about correct JOIN type selection

**Final Property Set**: After eliminating redundancy, we have 15 unique, high-value properties.

### Property 1: Mapper Field Completeness

*For any* Vista_FACT row with valid data, the fact.mapper SHALL produce an output object containing all required invoice fields (pc, factura, fecha_factura, fecha_etd_factura, fecha_eta_factura, incoterm, medio_envio_factura, gasto_adicional_flete, id_nro_ov_mas_factura) with correct data types.

**Validates: Requirements 1.2, 1.4**

### Property 2: Mapper Field Normalization

*For any* mapper (fact, hdr, item) and any input row, all output fields SHALL be normalized using the appropriate utils functions (normalizeValue, normalizeDate, normalizeDecimal, normalizeNumber) such that null/undefined/empty values are consistently handled.

**Validates: Requirements 1.4**

### Property 3: HDR Mapper Invoice Field Exclusion

*For any* Vista_HDR row, the hdr.mapper output SHALL NOT contain invoice-related fields (factura, fecha_factura, fecha_etd_factura, fecha_eta_factura, medio_envio_factura) and SHALL contain all order fields.

**Validates: Requirements 2.2, 2.3**

### Property 4: Order Query JOIN Correctness

*For any* order service query that requires both order and invoice data, the query SHALL use LEFT JOIN between Vista_HDR and Vista_FACT when invoices are optional, and SHALL return correct results for orders with zero, one, or multiple invoices.

**Validates: Requirements 3.2, 3.3, 3.4, 8.2, 9.3, 11.3, 12.2**

### Property 5: Item Filtering by Invoice

*For any* PC and optional Factura parameter, querying items SHALL return only items matching the PC and (if Factura is provided) matching that specific Factura, or (if Factura is null) items where Factura IS NULL OR Factura = '' OR Factura = 0.

**Validates: Requirements 3.5**


### Property 6: ORN Document Filtering

*For any* query for ORN (Order Receipt Notice) documents, the result set SHALL contain only orders that have NO associated invoices in Vista_FACT (i.e., no rows in Vista_FACT where Nro matches and Factura IS NOT NULL AND Factura <> '' AND Factura <> 0).

**Validates: Requirements 4.2, 4.3**

### Property 7: Shipment Document Validation

*For any* invoice in Vista_FACT returned by the Shipment Notice query, that invoice SHALL have: (1) Factura IS NOT NULL AND <> '' AND <> 0, (2) valid ETD_ENC_FA date, (3) valid ETA_ENC_FA date, and (4) Clausula IN ('CFR', 'CIF', 'CIP', 'DAP', 'DDP').

**Validates: Requirements 5.2**

### Property 8: Delivery Document Validation

*For any* invoice in Vista_FACT returned by the Delivery Notice query, that invoice SHALL have: (1) Factura IS NOT NULL AND <> '' AND <> 0, (2) valid ETA_ENC_FA date, and (3) ETA_ENC_FA + 7 days <= current date.

**Validates: Requirements 6.2**

### Property 9: Availability Document Validation

*For any* invoice in Vista_FACT returned by the Availability Notice query, that invoice SHALL have: (1) Factura IS NOT NULL AND <> '' AND <> 0, and (2) Clausula IN ('EWX', 'FCA', 'FOB', 'FCA Port', 'FCA Warehouse Santiago', 'FCA Airport', 'FCAWSTGO').

**Validates: Requirements 7.2**

### Property 10: Document-per-Invoice Relationship

*For any* document type that operates on invoices (Shipment, Delivery, Availability), the system SHALL generate exactly one document per invoice that meets the criteria, such that if an order has N invoices meeting criteria, N documents are generated.

**Validates: Requirements 5.3, 6.3, 7.3**

### Property 11: Query Result Equivalence

*For any* refactored service query, the result set (after mapping) SHALL be functionally equivalent to the pre-refactoring implementation, meaning: (1) same field names in response objects, (2) same data types for each field, (3) same business logic applied, and (4) same number of records for equivalent input conditions.

**Validates: Requirements 3.6, 10.5, 14.2, 14.3, 14.4**

### Property 12: Incoterm Validation Preservation

*For any* document type that validates Incoterm (Shipment, Delivery, Availability), the system SHALL apply the exact same Incoterm validation rules as the pre-refactoring implementation (same allowed values, same validation logic).

**Validates: Requirements 15.1**


### Property 13: Date Validation Preservation

*For any* query that validates dates (ETD, ETA), the system SHALL apply the same date validation logic as the pre-refactoring implementation, using ISDATE() and NULLIF() functions to handle empty strings and invalid dates consistently.

**Validates: Requirements 15.3**

### Property 14: JOIN Key Correctness

*For any* JOIN between Vista_HDR and Vista_FACT, the JOIN condition SHALL use Nro (PC) as the key; *for any* JOIN between Vista_FACT and Vista_ITEM, the JOIN condition SHALL use Nro (PC) as the key, ensuring referential integrity.

**Validates: Requirements 16.1, 16.2**

### Property 15: JOIN Type Selection

*For any* query, the system SHALL use LEFT JOIN when the business logic requires including orders without invoices (e.g., order listing, order details), and SHALL use INNER JOIN when the business logic requires only orders with invoices (e.g., Shipment/Delivery/Availability documents), such that no records are incorrectly excluded or included.

**Validates: Requirements 14.5, 16.3, 16.4, 16.5**

## Error Handling

### Mapper Error Handling

**Null/Undefined Input**:
- All mappers SHALL handle null or undefined input rows by returning an object with all fields set to null
- Normalization functions SHALL convert null, undefined, empty strings, and invalid values to null consistently

**Invalid Data Types**:
- Date fields: Invalid date strings SHALL be normalized to null
- Decimal fields: Non-numeric values SHALL be normalized to null
- String fields: Null-like values ('null', 'undefined', empty strings) SHALL be normalized to null

**Example**:
```javascript
// Input: { Nro: null, Factura: '', ETD_ENC_FA: 'invalid-date' }
// Output: { pc: null, factura: null, fecha_etd_factura: null, ... }
```

### Service Error Handling

**Database Connection Errors**:
- All services SHALL catch and log database connection errors
- Services SHALL throw descriptive errors that include the operation being performed
- Example: `Error obteniendo ordenes para Order Receipt Notice: ${error.message}`

**Query Execution Errors**:
- Services SHALL validate input parameters before executing queries
- Services SHALL use parameterized queries to prevent SQL injection
- Services SHALL log query errors with context (PC, Factura, filters)

**Empty Result Sets**:
- Services SHALL return empty arrays for queries with no results (not null or undefined)
- Services SHALL not throw errors for empty result sets
- Example: `if (!orders.length) return [];`

**Missing Related Data**:
- LEFT JOINs SHALL handle missing related data gracefully (invoice fields will be null)
- Services SHALL not fail when an order has no invoices (for ORN documents)
- Services SHALL not fail when an invoice has no items


### Data Validation Errors

**Invalid PC/Factura**:
- Services SHALL validate that PC is a non-empty string before querying
- Services SHALL normalize Factura values (trim, handle '0' as null)
- Services SHALL return empty results for invalid identifiers (not throw errors)

**Invalid Date Ranges**:
- Services SHALL validate date format (YYYY-MM-DD) before using in queries
- Services SHALL handle invalid date ranges gracefully (swap start/end if reversed)
- Services SHALL use default date ranges when parameters are missing

**Invalid Filters**:
- Services SHALL ignore invalid filter values (treat as not provided)
- Services SHALL validate RUT format before querying
- Services SHALL validate seller codes exist before filtering

## Testing Strategy

### Dual Testing Approach

This refactoring requires both unit tests and property-based tests to ensure correctness:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Specific order scenarios (order with 0 invoices, 1 invoice, multiple invoices)
- Edge cases (empty strings, null values, '0' as Factura)
- Integration between mappers and services
- Error conditions (connection failures, invalid inputs)

**Property-Based Tests**: Verify universal properties across all inputs
- Generate random Vista_HDR, Vista_FACT, Vista_ITEM rows
- Verify mapper properties hold for all generated inputs
- Verify query properties hold for various data combinations
- Minimum 100 iterations per property test

### Property-Based Testing Configuration

**Library Selection**: Use `fast-check` for JavaScript property-based testing

**Test Configuration**:
```javascript
const fc = require('fast-check');

// Example property test
fc.assert(
  fc.property(
    fc.record({
      Nro: fc.string(),
      Factura: fc.oneof(fc.string(), fc.constant(null)),
      ETD_ENC_FA: fc.date().map(d => d.toISOString().slice(0, 10)),
      // ... other fields
    }),
    (row) => {
      const result = mapFactRowToInvoice(row);
      // Assertions
      expect(result).toHaveProperty('pc');
      expect(result).toHaveProperty('factura');
      // ...
    }
  ),
  { numRuns: 100 } // Minimum 100 iterations
);
```

**Test Tagging**: Each property test MUST include a comment referencing the design property:
```javascript
// Feature: sql-server-views-refactoring, Property 1: Mapper Field Completeness
test('fact.mapper produces complete invoice objects', () => {
  // property test implementation
});
```

### Unit Test Strategy

**Mapper Tests**:
- Test each mapper with valid input rows
- Test each mapper with null/undefined/empty values
- Test date normalization with various formats
- Test decimal normalization with various precisions
- Verify invoice fields are absent in hdr.mapper output
- Verify factura field is present in item.mapper output

**Service Tests**:
- Test order queries with and without invoices
- Test document validation queries (ORN, Shipment, Delivery, Availability)
- Test JOIN correctness (LEFT vs INNER)
- Test filtering by PC, Factura, date ranges
- Test error handling (connection errors, invalid inputs)
- Test backward compatibility (same results as old implementation)


**Integration Tests**:
- Test complete flows (order creation → invoice creation → item creation)
- Test document generation flows (order → validate → generate document)
- Test data consistency across services
- Test MySQL + SQL Server integration (file tracking)

**Regression Tests**:
- Compare results before and after refactoring for same inputs
- Test all 18 requirements with real-world data samples
- Verify no data loss in JOINs
- Verify no performance degradation

### Test Coverage Goals

- Mapper functions: 100% line coverage
- Service query functions: 100% line coverage
- Error handling paths: 100% coverage
- All 15 correctness properties: Verified with property-based tests
- All edge cases: Covered with unit tests

## Implementation Details

### Requirement 1: Create fact.mapper.js

**File**: `Backend/mappers/sqlsoftkey/fact.mapper.js`

**Implementation**:
```javascript
const { normalizeValue, normalizeDate, normalizeDecimal } = require('./utils');

/**
 * Maps a Vista_FACT row to an invoice object
 * @param {Object} row - Raw row from jor_imp_FACT_90_softkey
 * @returns {Object} Normalized invoice object
 */
const mapFactRowToInvoice = (row = {}) => ({
  pc: normalizeValue(row.Nro),
  factura: normalizeValue(row.Factura),
  fecha_factura: normalizeDate(row.Fecha_factura),
  fecha_etd_factura: normalizeDate(row.ETD_ENC_FA),
  fecha_eta_factura: normalizeDate(row.ETA_ENC_FA),
  incoterm: normalizeValue(row.Clausula),
  medio_envio_factura: normalizeValue(row.MedioDeEnvioFact),
  gasto_adicional_flete: normalizeDecimal(row.GtoAdicFleteFactura, 2),
  id_nro_ov_mas_factura: normalizeValue(row.IDNroOvMasFactura),
});

module.exports = {
  mapFactRowToInvoice,
};
```

**Key Decisions**:
- Follow exact same pattern as hdr.mapper.js and item.mapper.js
- Use normalizeDecimal with 2 decimals for gasto_adicional_flete (currency)
- Export single function for consistency

### Requirement 2: Update hdr.mapper.js

**File**: `Backend/mappers/sqlsoftkey/hdr.mapper.js`

**Changes**:
```javascript
// REMOVE these lines:
// factura: normalizeValue(row.Factura),
// fecha_factura: normalizeDate(row.Fecha_factura),
// fecha_etd_factura: normalizeDate(row.ETD_ENC_FA),
// fecha_eta_factura: normalizeDate(row.ETA_ENC_FA),
// medio_envio_factura: normalizeValue(row.MedioDeEnvioFact),

// KEEP all other fields unchanged
```

**Rationale**: Vista_HDR no longer contains invoice fields, so mapper should not attempt to map them.

### Requirement 3: Refactor order.service.js

**File**: `Backend/services/order.service.js`

**Key Changes**:

1. **Import fact.mapper**:
```javascript
const { mapFactRowToInvoice } = require('../mappers/sqlsoftkey/fact.mapper');
```

2. **Update getOrdersByFilters query**:
```javascript
// OLD: SELECT h.Factura, h.Fecha_factura, h.ETD_ENC_FA, h.ETA_ENC_FA, h.MedioDeEnvioFact FROM jor_imp_HDR_90_softkey h
// NEW: LEFT JOIN with Vista_FACT
let baseQuery = `
  SELECT 
    h.Nro, h.OC, h.Rut, h.Fecha, h.ETD_OV, h.ETA_OV, h.Job, h.MedioDeEnvioOV,
    h.Clausula, h.Puerto_Destino, h.Certificados, h.EstadoOV, h.Vendedor, h.IDNroOvMasFactura,
    f.Factura, f.Fecha_factura, f.ETD_ENC_FA, f.ETA_ENC_FA, f.MedioDeEnvioFact, f.GtoAdicFleteFactura,
    c.Nombre AS customer_name
  FROM jor_imp_HDR_90_softkey h
  LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
  LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
  WHERE ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
`;
```

3. **Update row mapping**:
```javascript
const mappedRows = rows.map((row) => ({
  raw: row,
  order: hdrMapper(row),      // Maps order fields
  invoice: row.Factura ? factMapper(row) : null  // Maps invoice fields if present
}));
```


4. **Update getOrderItems query**:
```javascript
// Handle items with or without invoice
const getOrderItems = async (pc, factura = null) => {
  const sqlPool = await getSqlPoolFn();
  const request = sqlPool.request();
  request.input('pc', sqlModule.VarChar, pc);
  
  let query = `
    SELECT i.* 
    FROM jor_imp_item_90_softkey i
    WHERE i.Nro = @pc
  `;
  
  if (factura) {
    // Items for specific invoice
    query += ` AND i.Factura = @factura`;
    request.input('factura', sqlModule.VarChar, factura);
  } else {
    // Items without invoice (for ORN)
    query += ` AND (i.Factura IS NULL OR LTRIM(RTRIM(i.Factura)) = '' OR i.Factura = 0)`;
  }
  
  const result = await request.query(query);
  return (result.recordset || []).map(itemMapper);
};
```

**Rationale**: 
- LEFT JOIN allows orders without invoices to be returned
- Separate order and invoice mapping provides clear data structure
- Backward compatible by merging invoice fields into order object if needed

### Requirement 4: Refactor checkOrderReception.service.js

**File**: `Backend/services/checkOrderReception.service.js`

**Key Changes**:

**Update getOrdersReadyForOrderReceiptNotice query**:
```javascript
// OLD: WHERE (h.Factura IS NULL OR h.Factura = '' OR h.Factura = 0)
// NEW: Use LEFT JOIN to find orders without invoices

const result = await request.query(`
  SELECT
    h.Nro AS pc,
    h.OC AS oc,
    h.IDNroOvMasFactura AS id_nro_ov_mas_factura,
    h.Fecha AS fecha_ingreso,
    c.Nombre AS customer_name,
    c.Rut AS customer_rut
  FROM jor_imp_HDR_90_softkey h
  JOIN jor_imp_CLI_01_softkey c ON h.Rut = c.Rut
  LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
  WHERE ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
    AND f.Nro IS NULL  -- No invoices exist for this order
    ${sendFromFilter}
    ${pcFilter}
  ORDER BY h.Nro ASC
`);
```

**Rationale**:
- LEFT JOIN with `f.Nro IS NULL` ensures only orders without ANY invoices are returned
- Removes dependency on Factura field in Vista_HDR
- Maintains all existing validations (EstadoOV, sendFrom date)

### Requirement 5: Refactor checkShipmentNotice.service.js

**File**: `Backend/services/checkShipmentNotice.service.js`

**Key Changes**:

**Update getOrdersReadyForShipmentNotice query**:
```javascript
// OLD: Query Vista_HDR with Factura filters
// NEW: Query Vista_FACT directly (one document per invoice)

const result = await request.query(`
  SELECT
    f.Nro AS pc,
    h.OC AS oc,
    f.Factura AS factura,
    f.IDNroOvMasFactura AS id_nro_ov_mas_factura,
    f.ETD_ENC_FA AS fecha_etd,
    f.ETA_ENC_FA AS fecha_eta,
    c.Nombre AS customer_name,
    c.Rut AS customer_rut
  FROM jor_imp_FACT_90_softkey f
  INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
  JOIN jor_imp_CLI_01_softkey c ON h.Rut = c.Rut
  WHERE f.Factura IS NOT NULL
    AND LTRIM(RTRIM(f.Factura)) <> ''
    AND f.Factura <> 0
    AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETD_ENC_FA)), '')) = 1
    AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1
    AND f.Clausula IN ('CFR', 'CIF', 'CIP', 'DAP', 'DDP')
    ${sendFromFilter}
    ${pcFilter}
    ${facturaFilter}
  ORDER BY f.Nro ASC, f.Factura ASC
`);
```

**Rationale**:
- Query Vista_FACT as primary table (invoices are the main entity)
- INNER JOIN with Vista_HDR to get OC and validate order exists
- Each invoice generates one Shipment document
- Incoterm validation on Vista_FACT.Clausula


### Requirement 6: Refactor checkOrderDeliveryNotice.service.js

**File**: `Backend/services/checkOrderDeliveryNotice.service.js`

**Key Changes**:

**Update getOrdersReadyForOrderDeliveryNotice query**:
```javascript
// OLD: Query Vista_HDR with Factura and ETA filters
// NEW: Query Vista_FACT directly (one document per invoice)

const result = await request.query(`
  SELECT
    f.Nro AS pc,
    h.OC AS oc,
    f.Factura AS factura,
    f.IDNroOvMasFactura AS id_nro_ov_mas_factura,
    f.ETA_ENC_FA AS fecha_eta,
    c.Nombre AS customer_name,
    c.Rut AS customer_rut
  FROM jor_imp_FACT_90_softkey f
  INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
  JOIN jor_imp_CLI_01_softkey c ON h.Rut = c.Rut
  WHERE f.Factura IS NOT NULL
    AND LTRIM(RTRIM(f.Factura)) <> ''
    AND f.Factura <> 0
    AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1
    AND DATEADD(day, 7, CAST(f.ETA_ENC_FA AS date)) <= CAST(GETDATE() AS date)
    ${sendFromFilter}
    ${pcFilter}
    ${facturaFilter}
    ${idNroOvMasFacturaFilter}
  ORDER BY f.Nro ASC, f.Factura ASC
`);
```

**Rationale**:
- Query Vista_FACT as primary table
- ETA + 7 days validation on Vista_FACT.ETA_ENC_FA
- Each invoice generates one Delivery document
- Supports optional filters (PC, Factura, IDNroOvMasFactura)

### Requirement 7: Refactor checkAvailabilityNotice.service.js

**File**: `Backend/services/checkAvailabilityNotice.service.js`

**Key Changes**:

**Update getOrdersReadyForAvailabilityNotice query**:
```javascript
// OLD: Query Vista_HDR with Factura and Incoterm filters
// NEW: Query Vista_FACT directly (one document per invoice)

const result = await request.query(`
  SELECT
    f.Nro AS pc,
    h.OC AS oc,
    f.Factura AS factura,
    f.IDNroOvMasFactura AS id_nro_ov_mas_factura,
    f.Clausula AS incoterm,
    c.Nombre AS customer_name,
    c.Rut AS customer_rut
  FROM jor_imp_FACT_90_softkey f
  INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
  JOIN jor_imp_CLI_01_softkey c ON h.Rut = c.Rut
  WHERE f.Factura IS NOT NULL
    AND LTRIM(RTRIM(f.Factura)) <> ''
    AND f.Factura <> 0
    AND f.Clausula IN ('EWX', 'FCA', 'FOB', 'FCA Port', 'FCA Warehouse Santiago', 'FCA Airport', 'FCAWSTGO')
    ${sendFromFilter}
    ${pcFilter}
    ${facturaFilter}
  ORDER BY f.Nro ASC, f.Factura ASC
`);
```

**Rationale**:
- Query Vista_FACT as primary table
- Incoterm validation on Vista_FACT.Clausula (different set than Shipment)
- Each invoice generates one Availability document
- Supports optional filters (PC, Factura)

### Requirement 8: Refactor documentFile.service.js

**File**: `Backend/services/documentFile.service.js`

**Key Changes**:

1. **Update queries that fetch order + invoice data**:
```javascript
// When fetching document metadata that includes invoice info
const query = `
  SELECT 
    h.Nro, h.OC, h.Rut, h.Fecha,
    f.Factura, f.Fecha_factura, f.ETD_ENC_FA, f.ETA_ENC_FA
  FROM jor_imp_HDR_90_softkey h
  LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
  WHERE h.Nro = @pc
    AND (@factura IS NULL OR f.Factura = @factura)
`;
```

2. **Update file validation queries**:
```javascript
// When validating if a file belongs to an order/invoice
const query = `
  SELECT 1
  FROM jor_imp_HDR_90_softkey h
  LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
  WHERE h.Nro = @pc
    AND (@factura IS NULL OR f.Factura = @factura)
`;
```

**Rationale**:
- Maintain same public interface (functions accept PC and optional Factura)
- Use LEFT JOIN to support both order-level and invoice-level files
- Preserve all file access control logic


### Requirement 9: Refactor customer.service.js

**File**: `Backend/services/customer.service.js`

**Key Changes**:

1. **Update getCustomerOrders query**:
```javascript
// Get orders for a customer (with invoice counts)
const query = `
  SELECT 
    h.Nro, h.OC, h.Fecha, h.EstadoOV,
    COUNT(DISTINCT f.Factura) AS invoice_count
  FROM jor_imp_HDR_90_softkey h
  LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
  WHERE h.Rut = @customerRut
    AND ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
  GROUP BY h.Nro, h.OC, h.Fecha, h.EstadoOV
  ORDER BY h.Fecha DESC
`;
```

2. **Update getCustomerInvoices query**:
```javascript
// Get invoices for a customer
const query = `
  SELECT 
    f.Nro, f.Factura, f.Fecha_factura, f.ETD_ENC_FA, f.ETA_ENC_FA,
    h.OC, h.Fecha AS order_date
  FROM jor_imp_FACT_90_softkey f
  INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
  WHERE h.Rut = @customerRut
    AND f.Factura IS NOT NULL
    AND LTRIM(RTRIM(f.Factura)) <> ''
  ORDER BY f.Fecha_factura DESC
`;
```

**Rationale**:
- Separate queries for orders vs invoices provides clearer data structure
- COUNT(DISTINCT f.Factura) gives accurate invoice count per order
- INNER JOIN for invoices ensures only valid invoices are returned

### Requirement 10: Refactor projection.service.js

**File**: `Backend/services/projection.service.js`

**Key Changes**:

1. **Update order-level projections**:
```javascript
// Projections by order (aggregate across all invoices)
const query = `
  SELECT 
    h.Nro, h.OC, h.Fecha, h.currency,
    SUM(i.kg_solicitados * i.unit_price) AS total_order_value
  FROM jor_imp_HDR_90_softkey h
  LEFT JOIN jor_imp_item_90_softkey i ON i.Nro = h.Nro
  WHERE h.Fecha >= @startDate AND h.Fecha <= @endDate
  GROUP BY h.Nro, h.OC, h.Fecha, h.currency
`;
```

2. **Update invoice-level projections**:
```javascript
// Projections by invoice
const query = `
  SELECT 
    f.Nro, f.Factura, f.Fecha_factura,
    SUM(i.kg_facturados * i.unit_price) AS total_invoice_value
  FROM jor_imp_FACT_90_softkey f
  INNER JOIN jor_imp_item_90_softkey i ON i.Nro = f.Nro AND i.Factura = f.Factura
  WHERE f.Fecha_factura >= @startDate AND f.Fecha_factura <= @endDate
  GROUP BY f.Nro, f.Factura, f.Fecha_factura
`;
```

**Rationale**:
- Order projections use Vista_HDR as base (all items regardless of invoice)
- Invoice projections use Vista_FACT as base (only invoiced items)
- Aggregations produce same results as before (functional equivalence)

### Requirement 11: Refactor orderDetail.service.js

**File**: `Backend/services/orderDetail.service.js`

**Key Changes**:

1. **Update getOrderDetail function**:
```javascript
// Get order header
const getOrderDetail = async (pc) => {
  const sqlPool = await getSqlPoolFn();
  
  // Get order
  const orderResult = await sqlPool.request()
    .input('pc', sqlModule.VarChar, pc)
    .query(`
      SELECT h.* 
      FROM jor_imp_HDR_90_softkey h
      WHERE h.Nro = @pc
    `);
  
  if (!orderResult.recordset.length) return null;
  
  const order = hdrMapper(orderResult.recordset[0]);
  
  // Get invoices for this order
  const invoiceResult = await sqlPool.request()
    .input('pc', sqlModule.VarChar, pc)
    .query(`
      SELECT f.*
      FROM jor_imp_FACT_90_softkey f
      WHERE f.Nro = @pc
        AND f.Factura IS NOT NULL
        AND LTRIM(RTRIM(f.Factura)) <> ''
      ORDER BY f.Factura ASC
    `);
  
  const invoices = invoiceResult.recordset.map(factMapper);
  
  // Get items for each invoice
  for (const invoice of invoices) {
    const itemResult = await sqlPool.request()
      .input('pc', sqlModule.VarChar, pc)
      .input('factura', sqlModule.VarChar, invoice.factura)
      .query(`
        SELECT i.*
        FROM jor_imp_item_90_softkey i
        WHERE i.Nro = @pc AND i.Factura = @factura
      `);
    
    invoice.items = itemResult.recordset.map(itemMapper);
  }
  
  return {
    order,
    invoices
  };
};
```

**Rationale**:
- Separate queries provide clear data structure
- Order → Invoices → Items hierarchy matches business model
- Each entity mapped with appropriate mapper


### Requirement 12: Refactor item.service.js

**File**: `Backend/services/item.service.js`

**Key Changes**:

1. **Update getItemsByOrder function**:
```javascript
// Get all items for an order (with invoice info)
const getItemsByOrder = async (pc) => {
  const query = `
    SELECT 
      i.*,
      f.Fecha_factura, f.ETD_ENC_FA, f.ETA_ENC_FA
    FROM jor_imp_item_90_softkey i
    LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = i.Nro AND f.Factura = i.Factura
    WHERE i.Nro = @pc
    ORDER BY i.Linea ASC
  `;
  
  const result = await sqlPool.request()
    .input('pc', sqlModule.VarChar, pc)
    .query(query);
  
  return result.recordset.map(itemMapper);
};
```

2. **Update getItemsByInvoice function**:
```javascript
// Get items for a specific invoice
const getItemsByInvoice = async (pc, factura) => {
  const query = `
    SELECT 
      i.*,
      f.Fecha_factura, f.ETD_ENC_FA, f.ETA_ENC_FA
    FROM jor_imp_item_90_softkey i
    INNER JOIN jor_imp_FACT_90_softkey f ON f.Nro = i.Nro AND f.Factura = i.Factura
    WHERE i.Nro = @pc AND i.Factura = @factura
    ORDER BY i.Linea ASC
  `;
  
  const result = await sqlPool.request()
    .input('pc', sqlModule.VarChar, pc)
    .input('factura', sqlModule.VarChar, factura)
    .query(query);
  
  return result.recordset.map(itemMapper);
};
```

**Rationale**:
- LEFT JOIN for all items (includes items without invoices)
- INNER JOIN for invoice-specific items (validates invoice exists)
- JOIN with Vista_FACT enriches items with invoice dates

### Requirement 13: Refactor folder.service.js

**File**: `Backend/services/folder.service.js`

**Key Changes**:

1. **Update getFoldersByOrder function**:
```javascript
// Get folder structure for an order
const getFoldersByOrder = async (pc) => {
  const query = `
    SELECT 
      h.Nro, h.OC,
      f.Factura,
      COUNT(DISTINCT i.Linea) AS item_count
    FROM jor_imp_HDR_90_softkey h
    LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
    LEFT JOIN jor_imp_item_90_softkey i ON i.Nro = f.Nro AND i.Factura = f.Factura
    WHERE h.Nro = @pc
    GROUP BY h.Nro, h.OC, f.Factura
    ORDER BY f.Factura ASC
  `;
  
  const result = await sqlPool.request()
    .input('pc', sqlModule.VarChar, pc)
    .query(query);
  
  // Structure: Order → Invoices → Items
  return buildFolderStructure(result.recordset);
};
```

2. **Update getFoldersByInvoice function**:
```javascript
// Get folder structure for an invoice
const getFoldersByInvoice = async (pc, factura) => {
  const query = `
    SELECT 
      f.Nro, f.Factura,
      COUNT(DISTINCT i.Linea) AS item_count
    FROM jor_imp_FACT_90_softkey f
    LEFT JOIN jor_imp_item_90_softkey i ON i.Nro = f.Nro AND i.Factura = f.Factura
    WHERE f.Nro = @pc AND f.Factura = @factura
    GROUP BY f.Nro, f.Factura
  `;
  
  const result = await sqlPool.request()
    .input('pc', sqlModule.VarChar, pc)
    .input('factura', sqlModule.VarChar, factura)
    .query(query);
  
  return buildFolderStructure(result.recordset);
};
```

**Rationale**:
- Folder hierarchy matches data hierarchy (Order → Invoice → Item)
- LEFT JOINs handle cases where invoices or items don't exist
- Maintains existing folder structure for backward compatibility

### Requirement 14: Maintain Query Compatibility

**Strategy**: All refactored queries MUST produce functionally equivalent results

**Verification Approach**:
1. Run old query and new query side-by-side with same inputs
2. Compare result sets (same number of rows, same field values)
3. Verify field names and data types match
4. Test with various scenarios (0 invoices, 1 invoice, multiple invoices)

**Example Verification**:
```javascript
// Test: Order with 2 invoices should return 2 rows (or 1 order + 2 invoices)
const oldResult = await oldQuery(pc);  // Returns 2 rows from Vista_HDR (duplicity)
const newResult = await newQuery(pc);  // Returns 1 order + 2 invoices

// Verify equivalence
expect(newResult.order.pc).toBe(oldResult[0].pc);
expect(newResult.invoices.length).toBe(oldResult.length);
expect(newResult.invoices[0].factura).toBe(oldResult[0].factura);
expect(newResult.invoices[1].factura).toBe(oldResult[1].factura);
```


### Requirement 15: Preserve Business Rules

**Business Rules to Preserve**:

1. **Incoterm Validation**:
   - Shipment documents: `Clausula IN ('CFR', 'CIF', 'CIP', 'DAP', 'DDP')`
   - Availability documents: `Clausula IN ('EWX', 'FCA', 'FOB', 'FCA Port', 'FCA Warehouse Santiago', 'FCA Airport', 'FCAWSTGO')`
   - Source: Vista_FACT.Clausula (was Vista_HDR.Clausula)

2. **Date Validation**:
   - ETD validation: `ISDATE(NULLIF(LTRIM(RTRIM(f.ETD_ENC_FA)), '')) = 1`
   - ETA validation: `ISDATE(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1`
   - Delivery date: `DATEADD(day, 7, CAST(f.ETA_ENC_FA AS date)) <= CAST(GETDATE() AS date)`
   - Source: Vista_FACT dates (was Vista_HDR dates)

3. **Order Status Validation**:
   - Exclude cancelled orders: `ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'`
   - Source: Vista_HDR.EstadoOV (unchanged)

4. **Invoice Validation**:
   - Valid invoice: `Factura IS NOT NULL AND LTRIM(RTRIM(Factura)) <> '' AND Factura <> 0`
   - No invoice: `Factura IS NULL OR LTRIM(RTRIM(Factura)) = '' OR Factura = 0`
   - Source: Vista_FACT.Factura (was Vista_HDR.Factura)

5. **Document Generation Rules**:
   - ORN: One per order WITHOUT invoices
   - Shipment: One per invoice WITH valid ETD/ETA and specific Incoterms
   - Delivery: One per invoice WITH valid ETA and ETA+7 <= today
   - Availability: One per invoice WITH specific Incoterms

**Implementation**:
- Copy exact WHERE clauses from old queries
- Update table references (Vista_HDR → Vista_FACT for invoice fields)
- Maintain exact same validation logic

### Requirement 16: Validate Data Integrity

**JOIN Key Validation**:

1. **Vista_HDR ↔ Vista_FACT**:
```sql
-- Correct JOIN
FROM jor_imp_HDR_90_softkey h
LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro

-- Verify no data loss
SELECT COUNT(*) FROM jor_imp_HDR_90_softkey;  -- Total orders
SELECT COUNT(DISTINCT Nro) FROM jor_imp_FACT_90_softkey;  -- Orders with invoices
-- Difference = orders without invoices
```

2. **Vista_FACT ↔ Vista_ITEM**:
```sql
-- Correct JOIN
FROM jor_imp_FACT_90_softkey f
INNER JOIN jor_imp_item_90_softkey i ON i.Nro = f.Nro AND i.Factura = f.Factura

-- Verify referential integrity
SELECT COUNT(*) FROM jor_imp_item_90_softkey WHERE Factura IS NOT NULL;  -- Items with invoice
SELECT COUNT(*) FROM jor_imp_FACT_90_softkey;  -- Total invoices
-- All items should reference valid invoices
```

3. **LEFT JOIN vs INNER JOIN**:
```sql
-- Use LEFT JOIN when including orders without invoices
SELECT h.*, f.Factura
FROM jor_imp_HDR_90_softkey h
LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
-- Returns all orders, f.Factura is NULL for orders without invoices

-- Use INNER JOIN when requiring invoices
SELECT h.*, f.Factura
FROM jor_imp_HDR_90_softkey h
INNER JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
-- Returns only orders that have at least one invoice
```

**Data Integrity Tests**:
- Verify no orders are lost in JOINs
- Verify no invoices are orphaned (all reference valid orders)
- Verify no items are orphaned (all reference valid orders/invoices)
- Verify counts match before and after refactoring

### Requirement 17: Document Query Changes

**Documentation Strategy**:

1. **Inline Comments**:
```javascript
// REFACTORING NOTE: Vista_HDR no longer contains invoice fields
// Invoice data now comes from Vista_FACT via LEFT JOIN
const query = `
  SELECT 
    h.Nro, h.OC,           -- Order fields from Vista_HDR
    f.Factura, f.ETD_ENC_FA -- Invoice fields from Vista_FACT
  FROM jor_imp_HDR_90_softkey h
  LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro  -- One order → many invoices
  WHERE h.Nro = @pc
`;
```

2. **Function Documentation**:
```javascript
/**
 * Get orders ready for Shipment Notice
 * 
 * REFACTORING CHANGES:
 * - OLD: Queried Vista_HDR (had duplicity, one row per invoice)
 * - NEW: Queries Vista_FACT directly (one row per invoice, no duplicity)
 * - REASON: Vista_HDR now has one row per order, invoice data moved to Vista_FACT
 * 
 * @param {string} sendFromDate - Filter orders from this date
 * @param {string} filterPc - Optional PC filter
 * @param {string} filterFactura - Optional Factura filter
 * @returns {Promise<Array>} Invoices ready for Shipment Notice
 */
async function getOrdersReadyForShipmentNotice(sendFromDate, filterPc, filterFactura) {
  // ...
}
```

3. **README Documentation**:
Create `Backend/docs/VISTA_REFACTORING.md`:
```markdown
# Vista Refactoring Guide

## Overview
Vista_HDR has been refactored to eliminate duplicity. Invoice data moved to Vista_FACT.

## Key Changes

### Before
- Vista_HDR: Multiple rows per PC (one per invoice)
- Fields: Order fields + Invoice fields

### After
- Vista_HDR: One row per PC
- Vista_FACT: Multiple rows per PC (one per invoice)
- Fields: Order fields in HDR, Invoice fields in FACT

## Common Query Patterns

### Pattern 1: Get order with invoices
```sql
SELECT h.*, f.Factura, f.Fecha_factura
FROM jor_imp_HDR_90_softkey h
LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
WHERE h.Nro = @pc
```

### Pattern 2: Get orders without invoices
```sql
SELECT h.*
FROM jor_imp_HDR_90_softkey h
LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
WHERE f.Nro IS NULL
```

### Pattern 3: Get invoices only
```sql
SELECT f.*
FROM jor_imp_FACT_90_softkey f
WHERE f.Factura IS NOT NULL
```
```


### Requirement 18: Create Regression Tests

**Test Structure**:

```
Backend/tests/
├── mappers/
│   ├── fact.mapper.test.js
│   ├── hdr.mapper.test.js (updated)
│   └── item.mapper.test.js (verify unchanged)
├── services/
│   ├── order.service.test.js (updated)
│   ├── checkOrderReception.service.test.js (updated)
│   ├── checkShipmentNotice.service.test.js (updated)
│   ├── checkOrderDeliveryNotice.service.test.js (updated)
│   ├── checkAvailabilityNotice.service.test.js (updated)
│   ├── documentFile.service.test.js (updated)
│   ├── customer.service.test.js (updated)
│   ├── projection.service.test.js (updated)
│   ├── orderDetail.service.test.js (updated)
│   ├── item.service.test.js (updated)
│   └── folder.service.test.js (updated)
└── integration/
    └── vista-refactoring.integration.test.js (new)
```

**Test Categories**:

1. **Mapper Tests** (`fact.mapper.test.js`):
```javascript
describe('fact.mapper', () => {
  // Feature: sql-server-views-refactoring, Property 1: Mapper Field Completeness
  test('should map all invoice fields from Vista_FACT row', () => {
    const row = {
      Nro: '12345',
      Factura: 'INV-001',
      Fecha_factura: '2024-01-15',
      ETD_ENC_FA: '2024-01-20',
      ETA_ENC_FA: '2024-02-10',
      Clausula: 'CIF',
      MedioDeEnvioFact: 'Air',
      GtoAdicFleteFactura: 150.50,
      IDNroOvMasFactura: '12345-INV-001'
    };
    
    const result = mapFactRowToInvoice(row);
    
    expect(result).toHaveProperty('pc', '12345');
    expect(result).toHaveProperty('factura', 'INV-001');
    expect(result).toHaveProperty('fecha_factura', '2024-01-15');
    expect(result).toHaveProperty('fecha_etd_factura', '2024-01-20');
    expect(result).toHaveProperty('fecha_eta_factura', '2024-02-10');
    expect(result).toHaveProperty('incoterm', 'CIF');
    expect(result).toHaveProperty('medio_envio_factura', 'Air');
    expect(result).toHaveProperty('gasto_adicional_flete', 150.50);
    expect(result).toHaveProperty('id_nro_ov_mas_factura', '12345-INV-001');
  });
  
  // Feature: sql-server-views-refactoring, Property 2: Mapper Field Normalization
  test('should normalize null and empty values', () => {
    const row = {
      Nro: null,
      Factura: '',
      Fecha_factura: 'invalid-date',
      GtoAdicFleteFactura: 'not-a-number'
    };
    
    const result = mapFactRowToInvoice(row);
    
    expect(result.pc).toBeNull();
    expect(result.factura).toBeNull();
    expect(result.fecha_factura).toBeNull();
    expect(result.gasto_adicional_flete).toBeNull();
  });
});
```

2. **Service Tests** (`checkOrderReception.service.test.js`):
```javascript
describe('checkOrderReception.service', () => {
  // Feature: sql-server-views-refactoring, Property 6: ORN Document Filtering
  test('should return only orders without invoices', async () => {
    // Setup: Create test data
    // - Order 1: No invoices
    // - Order 2: Has 1 invoice
    // - Order 3: Has 2 invoices
    
    const result = await getOrdersReadyForOrderReceiptNotice();
    
    // Should only return Order 1
    expect(result).toHaveLength(1);
    expect(result[0].pc).toBe('ORDER-1');
    
    // Verify Order 2 and 3 are not included
    expect(result.find(o => o.pc === 'ORDER-2')).toBeUndefined();
    expect(result.find(o => o.pc === 'ORDER-3')).toBeUndefined();
  });
  
  // Feature: sql-server-views-refactoring, Property 11: Query Result Equivalence
  test('should produce same results as old implementation', async () => {
    const oldResult = await oldGetOrdersReadyForORN();
    const newResult = await getOrdersReadyForOrderReceiptNotice();
    
    expect(newResult.length).toBe(oldResult.length);
    
    for (let i = 0; i < newResult.length; i++) {
      expect(newResult[i].pc).toBe(oldResult[i].pc);
      expect(newResult[i].oc).toBe(oldResult[i].oc);
      expect(newResult[i].customer_name).toBe(oldResult[i].customer_name);
    }
  });
});
```

3. **Integration Tests** (`vista-refactoring.integration.test.js`):
```javascript
describe('Vista Refactoring Integration', () => {
  // Feature: sql-server-views-refactoring, Property 14: JOIN Key Correctness
  test('should maintain referential integrity across all JOINs', async () => {
    // Verify Vista_HDR ↔ Vista_FACT relationship
    const orders = await getAllOrders();
    const invoices = await getAllInvoices();
    
    for (const invoice of invoices) {
      const order = orders.find(o => o.pc === invoice.pc);
      expect(order).toBeDefined();
    }
    
    // Verify Vista_FACT ↔ Vista_ITEM relationship
    const items = await getAllItems();
    
    for (const item of items.filter(i => i.factura)) {
      const invoice = invoices.find(inv => 
        inv.pc === item.pc && inv.factura === item.factura
      );
      expect(invoice).toBeDefined();
    }
  });
  
  // Feature: sql-server-views-refactoring, Property 15: JOIN Type Selection
  test('should use correct JOIN types for different scenarios', async () => {
    // LEFT JOIN scenario: Get all orders (with or without invoices)
    const allOrders = await getOrdersByFilters({});
    const ordersWithoutInvoices = allOrders.filter(o => !o.invoice);
    expect(ordersWithoutInvoices.length).toBeGreaterThan(0);
    
    // INNER JOIN scenario: Get only invoices
    const shipmentDocs = await getOrdersReadyForShipmentNotice();
    for (const doc of shipmentDocs) {
      expect(doc.factura).toBeTruthy();
    }
  });
});
```

4. **Property-Based Tests**:
```javascript
const fc = require('fast-check');

describe('Property-Based Tests', () => {
  // Feature: sql-server-views-refactoring, Property 1: Mapper Field Completeness
  test('fact.mapper always produces complete objects', () => {
    fc.assert(
      fc.property(
        fc.record({
          Nro: fc.string(),
          Factura: fc.string(),
          Fecha_factura: fc.date().map(d => d.toISOString().slice(0, 10)),
          ETD_ENC_FA: fc.date().map(d => d.toISOString().slice(0, 10)),
          ETA_ENC_FA: fc.date().map(d => d.toISOString().slice(0, 10)),
          Clausula: fc.constantFrom('CIF', 'DDP', 'FOB'),
          MedioDeEnvioFact: fc.string(),
          GtoAdicFleteFactura: fc.float(),
          IDNroOvMasFactura: fc.string()
        }),
        (row) => {
          const result = mapFactRowToInvoice(row);
          
          // All fields must be present
          expect(result).toHaveProperty('pc');
          expect(result).toHaveProperty('factura');
          expect(result).toHaveProperty('fecha_factura');
          expect(result).toHaveProperty('fecha_etd_factura');
          expect(result).toHaveProperty('fecha_eta_factura');
          expect(result).toHaveProperty('incoterm');
          expect(result).toHaveProperty('medio_envio_factura');
          expect(result).toHaveProperty('gasto_adicional_flete');
          expect(result).toHaveProperty('id_nro_ov_mas_factura');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Test Execution**:
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- mappers/fact.mapper.test.js
npm test -- services/checkOrderReception.service.test.js
npm test -- integration/vista-refactoring.integration.test.js

# Run with coverage
npm test -- --coverage
```

## Summary

This design document provides a comprehensive technical approach for refactoring the backend code to work with the new SQL Server view structure. The key changes are:

1. **New fact.mapper.js** for mapping Vista_FACT invoice data
2. **Updated hdr.mapper.js** removing invoice fields
3. **Refactored services** using appropriate JOINs (LEFT for optional invoices, INNER for required invoices)
4. **Document validation services** now query Vista_FACT directly for invoice-based documents
5. **Preserved business rules** for Incoterms, dates, and document generation
6. **Comprehensive testing strategy** with both unit and property-based tests

All changes maintain backward compatibility and functional equivalence with the previous implementation while eliminating data duplicity and improving data integrity.

