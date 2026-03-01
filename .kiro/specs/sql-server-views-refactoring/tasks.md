# Implementation Plan: SQL Server Views Refactoring

## Overview

This plan implements the refactoring of the Gelymar backend to work with the new SQL Server view structure. The refactoring eliminates data duplicity by separating orders (Vista_HDR) from invoices (Vista_FACT), while maintaining all existing business rules and backward compatibility.

## Tasks

- [x] 1. Create fact.mapper.js for invoice data mapping
  - Create `Backend/mappers/sqlsoftkey/fact.mapper.js`
  - Implement `mapFactRowToInvoice` function that maps all 8 invoice fields from Vista_FACT (excluding id_nro_ov_mas_factura)
  - Fields to map: pc, factura, fecha_factura, fecha_etd_factura, fecha_eta_factura, incoterm, medio_envio_factura, gasto_adicional_flete
  - DO NOT map id_nro_ov_mas_factura (field removed from Vista_FACT)
  - Use normalization functions (normalizeValue, normalizeDate, normalizeDecimal) for all fields
  - Follow the same structure and conventions as hdr.mapper.js and item.mapper.js
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 1.1 Write property test for fact.mapper field completeness
  - **Property 1: Mapper Field Completeness**
  - **Validates: Requirements 1.2, 1.4**
  - Generate random Vista_FACT rows and verify all 8 fields are present in output (excluding id_nro_ov_mas_factura)
  - Use fast-check with minimum 100 iterations

- [ ]* 1.2 Write property test for fact.mapper field normalization
  - **Property 2: Mapper Field Normalization**
  - **Validates: Requirements 1.4**
  - Generate rows with null/undefined/empty values and verify consistent normalization
  - Use fast-check with minimum 100 iterations

- [x] 2. Update hdr.mapper.js to remove invoice fields and id_nro_ov_mas_factura
  - Remove 5 invoice-related fields: factura, fecha_factura, fecha_etd_factura, fecha_eta_factura, medio_envio_factura
  - Remove id_nro_ov_mas_factura field (no longer exists in Vista_HDR)
  - Verify all 13 order fields are retained (excluding id_nro_ov_mas_factura)
  - Maintain the same function signature and structure
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ]* 2.1 Write property test for hdr.mapper invoice field exclusion
  - **Property 3: HDR Mapper Invoice Field Exclusion**
  - **Validates: Requirements 2.2, 2.3**
  - Generate random Vista_HDR rows and verify invoice fields are absent in output
  - Verify all order fields are present

- [x] 3. Validate item.mapper.js requires no changes
  - Review `Backend/mappers/sqlsoftkey/item.mapper.js`
  - Verify the `factura` field is present and correctly mapped
  - Confirm all existing fields and normalization logic are unchanged
  - _Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4_

- [x] 4. Refactor order.service.js to use new view structure
  - [x] 4.1 Import fact.mapper and update getOrdersByFilters
    - Add `const { mapFactRowToInvoice } = require('../mappers/sqlsoftkey/fact.mapper')`
    - Update query to LEFT JOIN Vista_HDR with Vista_FACT
    - Remove `h.IDNroOvMasFactura` from SELECT (field no longer exists)
    - Map order fields with hdr.mapper and invoice fields with fact.mapper
    - Remove `id_nro_ov_mas_factura` from Order model instantiation
    - Update document count queries to use only (pc, oc) without id_nro_ov_mas_factura
    - _Requirements: 3.2_

  - [x] 4.2 Update getClientDashboardOrders query
    - LEFT JOIN Vista_HDR with Vista_FACT
    - Remove `h.IDNroOvMasFactura` from SELECT
    - Maintain item count aggregation by grouping on Nro and Factura
    - _Requirements: 3.3_

  - [x] 4.3 Update order detail queries (getOrderByIdSimple, getOrderByPcOc, getOrderByPc)
    - LEFT JOIN Vista_HDR with Vista_FACT when invoice data is needed
    - Remove `h.IDNroOvMasFactura` from all SELECT queries
    - Remove `getOrderByPcId` function completely (no longer needed without id_nro_ov_mas_factura)
    - Use hdr.mapper for order fields and fact.mapper for invoice fields
    - Remove `id_nro_ov_mas_factura` from Order model instantiation
    - _Requirements: 3.4_

  - [x] 4.4 Update getOrderItems to filter by PC and optional Factura
    - Query Vista_ITEM filtering by Nro
    - Remove `h.IDNroOvMasFactura` from SELECT query
    - Remove `idNroOvMasFactura` parameter from function signature
    - Remove WHERE clause filtering by IDNroOvMasFactura
    - If factura parameter provided: `AND i.Factura = @factura`
    - If factura is null: `AND (i.Factura IS NULL OR LTRIM(RTRIM(i.Factura)) = '' OR i.Factura = 0)`
    - _Requirements: 3.5_

- [ ]* 4.5 Write property test for order query JOIN correctness
  - **Property 4: Order Query JOIN Correctness**
  - **Validates: Requirements 3.2, 3.3, 3.4, 8.2, 9.3, 11.3, 12.2**
  - Test queries with orders having 0, 1, and multiple invoices
  - Verify LEFT JOIN returns correct results for all scenarios

- [ ]* 4.6 Write property test for item filtering by invoice
  - **Property 5: Item Filtering by Invoice**
  - **Validates: Requirements 3.5**
  - Test with various PC and Factura combinations
  - Verify correct filtering for items with and without invoices

- [x] 5. Checkpoint - Verify mappers and order service
  - Run tests for fact.mapper, hdr.mapper, and order.service
  - Verify no compilation or linting errors
  - Verify id_nro_ov_mas_factura has been removed from all mappers and queries
  - Ask the user if questions arise

- [x] 6. Refactor checkOrderReception.service.js for ORN documents
  - Update `getOrdersReadyForOrderReceiptNotice` query
  - Use LEFT JOIN between Vista_HDR and Vista_FACT with `WHERE f.Nro IS NULL` to find orders without invoices
  - Maintain all existing validations: EstadoOV <> 'cancelada', sendFrom date filter
  - Maintain JOIN with jor_imp_CLI_01_softkey for customer data
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]* 6.1 Write property test for ORN document filtering
  - **Property 6: ORN Document Filtering**
  - **Validates: Requirements 4.2, 4.3**
  - Verify only orders without invoices are returned
  - Test with orders having 0, 1, and multiple invoices

- [x] 7. Refactor checkShipmentNotice.service.js for Shipment documents
  - Update `getOrdersReadyForShipmentNotice` query
  - Query Vista_FACT as primary table (not Vista_HDR)
  - INNER JOIN with Vista_HDR to get OC field
  - Filter: `f.Factura IS NOT NULL AND LTRIM(RTRIM(f.Factura)) <> '' AND f.Factura <> 0`
  - Validate ETD_ENC_FA and ETA_ENC_FA using ISDATE(NULLIF(LTRIM(RTRIM(...)), ''))
  - Validate Incoterm: `f.Clausula IN ('CFR', 'CIF', 'CIP', 'DAP', 'DDP')`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 7.1 Write property test for Shipment document validation
  - **Property 7: Shipment Document Validation**
  - **Validates: Requirements 5.2**
  - Verify all returned invoices have valid Factura, ETD, ETA, and Incoterm
  - Test with various invoice data combinations

- [ ]* 7.2 Write property test for document-per-invoice relationship
  - **Property 10: Document-per-Invoice Relationship**
  - **Validates: Requirements 5.3, 6.3, 7.3**
  - Verify one document is generated per invoice meeting criteria
  - Test with orders having multiple invoices

- [x] 8. Refactor checkOrderDeliveryNotice.service.js for Delivery documents
  - Update `getOrdersReadyForOrderDeliveryNotice` query
  - Query Vista_FACT as primary table (not Vista_HDR)
  - INNER JOIN with Vista_HDR to get OC field
  - Filter: `f.Factura IS NOT NULL AND LTRIM(RTRIM(f.Factura)) <> '' AND f.Factura <> 0`
  - Validate ETA_ENC_FA using ISDATE(NULLIF(LTRIM(RTRIM(...)), ''))
  - Validate ETA + 7 days: `DATEADD(day, 7, CAST(f.ETA_ENC_FA AS date)) <= CAST(GETDATE() AS date)`
  - Support optional filters: PC, Factura
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ]* 8.1 Write property test for Delivery document validation
  - **Property 8: Delivery Document Validation**
  - **Validates: Requirements 6.2**
  - Verify all returned invoices have valid Factura, ETA, and ETA+7 <= today
  - Test with various date combinations

- [x] 9. Refactor checkAvailabilityNotice.service.js for Availability documents
  - Update `getOrdersReadyForAvailabilityNotice` query
  - Query Vista_FACT as primary table (not Vista_HDR)
  - INNER JOIN with Vista_HDR to get OC field
  - Filter: `f.Factura IS NOT NULL AND LTRIM(RTRIM(f.Factura)) <> '' AND f.Factura <> 0`
  - Validate Incoterm: `f.Clausula IN ('EWX', 'FCA', 'FOB', 'FCA Port', 'FCA Warehouse Santiago', 'FCA Airport', 'FCAWSTGO')`
  - Support optional filters: PC, Factura
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 9.1 Write property test for Availability document validation
  - **Property 9: Availability Document Validation**
  - **Validates: Requirements 7.2**
  - Verify all returned invoices have valid Factura and Incoterm
  - Test with various Incoterm values

- [-] 10. Checkpoint - Verify document validation services
  - Run tests for all document validation services (ORN, Shipment, Delivery, Availability)
  - Verify correct filtering and validation logic
  - Ask the user if questions arise

- [-] 10.1 Remove id_nro_ov_mas_factura from all code and databases
  - [x] 10.1.1 Update fact.mapper.js to remove id_nro_ov_mas_factura field
    - Remove `id_nro_ov_mas_factura: normalizeValue(row.IDNroOvMasFactura)` from mapper
    - Vista_FACT no longer has this field
    - _Requirements: 1.2, 1.4_

  - [x] 10.1.2 Update hdr.mapper.js to remove id_nro_ov_mas_factura field
    - Remove `id_nro_ov_mas_factura: normalizeValue(row.IDNroOvMasFactura)` from mapper
    - Vista_HDR no longer has this field
    - _Requirements: 2.2, 2.3_

  - [x] 10.1.3 Update order.service.js to remove id_nro_ov_mas_factura
    - Remove `h.IDNroOvMasFactura` from all SELECT queries
    - Remove `id_nro_ov_mas_factura` from Order model instantiation
    - Remove `getOrderByPcId` function (no longer needed)
    - Remove `idNroOvMasFactura` parameter from `getOrderItems` function
    - Remove `id_nro_ov_mas_factura` from document count queries (use only pc, oc)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 10.1.4 Update checkOrderReception.service.js to remove id_nro_ov_mas_factura
    - Remove `h.IDNroOvMasFactura` from SELECT query
    - Remove `id_nro_ov_mas_factura` from order data mapping
    - Remove `idNroOvMasFactura` parameter from `getReceptionFile` function
    - Update file queries to use only `(pc, oc)` for ORN documents
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 10.1.5 Update checkShipmentNotice.service.js to remove id_nro_ov_mas_factura
    - Remove `f.IDNroOvMasFactura` from SELECT query
    - Remove `id_nro_ov_mas_factura` from invoice data mapping
    - Update file queries to use only `(pc, oc, factura)` for Shipment documents
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 10.1.6 Update checkOrderDeliveryNotice.service.js to remove id_nro_ov_mas_factura
    - Remove `f.IDNroOvMasFactura` from SELECT query
    - Remove `id_nro_ov_mas_factura` from invoice data mapping
    - Remove `idNroOvMasFactura` filter parameter from function signature
    - Update file queries to use only `(pc, oc, factura)` for Delivery documents
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 10.1.7 Update checkAvailabilityNotice.service.js to remove id_nro_ov_mas_factura
    - Remove `f.IDNroOvMasFactura` from SELECT query
    - Remove `id_nro_ov_mas_factura` from invoice data mapping
    - Update file queries to use only `(pc, oc, factura)` for Availability documents
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 10.1.8 Update documentFile.service.js to remove id_nro_ov_mas_factura
    - Remove `h.IDNroOvMasFactura` from all SELECT queries
    - Remove `resolveIdNroOvMasFactura` function completely
    - Remove `id_nro_ov_mas_factura` from all function parameters
    - Update all file queries to use only `(pc, oc, factura)` pattern
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 10.1.9 Update folder.service.js to remove id_nro_ov_mas_factura
    - Remove `hdr.IDNroOvMasFactura` from SELECT query
    - Remove `id_nro_ov_mas_factura` from folder data mapping
    - Update file count GROUP BY to use only `(pc, oc)` without id_nro_ov_mas_factura
    - _Requirements: 13.1, 13.2_

  - [x] 10.1.10 Update file.service.js to remove id_nro_ov_mas_factura
    - Remove `id_nro_ov_mas_factura` parameter from `createOrderFile` function
    - Remove `id_nro_ov_mas_factura` from INSERT INTO order_files queries
    - Remove `id_nro_ov_mas_factura` from `getFilesByPcOc` function
    - Remove `id_nro_ov_mas_factura` from `getFilesByPc` function
    - Remove all WHERE clauses that filter by id_nro_ov_mas_factura
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 10.1.11 Update documentEvent.service.js to remove id_nro_ov_mas_factura
    - Remove `id_nro_ov_mas_factura` column from INSERT INTO document_events
    - Remove `id_nro_ov_mas_factura` from function parameters
    - _Requirements: 8.1_

  - [x] 10.1.12 Update backfill-order-files.js script
    - Remove `h.IDNroOvMasFactura` from SELECT query
    - Remove `id_nro_ov_mas_factura` from backfill logic
    - Remove UPDATE statements that set id_nro_ov_mas_factura
    - _Requirements: 8.1_

  - [ ] 10.1.13 Create MySQL migration to drop id_nro_ov_mas_factura column
    - Create migration: `ALTER TABLE order_files DROP COLUMN id_nro_ov_mas_factura;`
    - Create migration: `ALTER TABLE document_events DROP COLUMN id_nro_ov_mas_factura;`
    - Document that PC is now the sole identifier for orders
    - _Requirements: 8.1, 16.1, 16.2_

  - [x] 10.1.14 Update Frontend to remove id_nro_ov_mas_factura references
    - Remove `idov` query parameter from URLs in orders.js
    - Remove `idov` query parameter from URLs in folders.js
    - Remove `idNroOvMasFactura` from API calls in files.js
    - Update all document URLs to use only `(pc, oc, factura)` pattern
    - _Requirements: 8.1_

- [x] 11. Refactor documentFile.service.js
  - Update queries that fetch order + invoice data to use LEFT JOIN between Vista_HDR and Vista_FACT
  - Update file validation queries to support both order-level and invoice-level files
  - Maintain same public interface (functions accept PC and optional Factura)
  - Preserve all file access control logic
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 12. Refactor customer.service.js
  - [x] 12.1 Update getCustomerOrders query
    - LEFT JOIN Vista_HDR with Vista_FACT
    - Use `COUNT(DISTINCT f.Factura)` to get invoice count per order
    - GROUP BY order fields
    - _Requirements: 9.1, 9.2_

  - [x] 12.2 Update getCustomerInvoices query
    - Query Vista_FACT as primary table
    - INNER JOIN with Vista_HDR to get order data
    - Filter: `f.Factura IS NOT NULL AND LTRIM(RTRIM(f.Factura)) <> ''`
    - _Requirements: 9.1, 9.3_

- [x] 13. Refactor projection.service.js
  - [x] 13.1 Update order-level projection queries
    - Query Vista_HDR as base table
    - LEFT JOIN with Vista_ITEM to aggregate all items
    - Calculate totals across all invoices per order
    - _Requirements: 10.1, 10.2_

  - [x] 13.2 Update invoice-level projection queries
    - Query Vista_FACT as base table
    - INNER JOIN with Vista_ITEM matching on Nro and Factura
    - Calculate totals per invoice
    - _Requirements: 10.1, 10.3_

- [x] 14. Refactor orderDetail.service.js
  - Update `getOrderDetail` to use separate queries for order, invoices, and items
  - Query Vista_HDR for order data (single row)
  - Query Vista_FACT for invoices filtering by PC (multiple rows)
  - Query Vista_ITEM for items of each invoice
  - Return structure: `{ order, invoices: [{ ...invoice, items: [...] }] }`
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 15. Refactor item.service.js
  - [x] 15.1 Update getItemsByOrder function
    - Query Vista_ITEM as base table
    - LEFT JOIN with Vista_FACT to enrich with invoice dates
    - Filter by Nro
    - _Requirements: 12.1, 12.2_

  - [x] 15.2 Update getItemsByInvoice function
    - Query Vista_ITEM as base table
    - INNER JOIN with Vista_FACT to validate invoice exists
    - Filter by Nro and Factura
    - _Requirements: 12.1, 12.3_

- [x] 16. Refactor folder.service.js
  - [x] 16.1 Update getFoldersByOrder function
    - LEFT JOIN Vista_HDR with Vista_FACT and Vista_ITEM
    - GROUP BY order and invoice fields
    - Build folder structure: Order → Invoices → Items
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 16.2 Update getFoldersByInvoice function
    - Query Vista_FACT as base table
    - LEFT JOIN with Vista_ITEM
    - GROUP BY invoice fields
    - _Requirements: 13.1, 13.3_

- [ ] 17. Checkpoint - Verify all service refactorings
  - Run tests for all refactored services
  - Verify no compilation or linting errors
  - Ask the user if questions arise

- [ ]* 18. Write property test for query result equivalence
  - **Property 11: Query Result Equivalence**
  - **Validates: Requirements 3.6, 10.5, 14.2, 14.3, 14.4**
  - Compare results from refactored queries with expected structure
  - Verify same field names, data types, and business logic

- [ ]* 19. Write property test for Incoterm validation preservation
  - **Property 12: Incoterm Validation Preservation**
  - **Validates: Requirements 15.1**
  - Verify Shipment and Availability documents use correct Incoterm sets
  - Test with various Incoterm values

- [ ]* 20. Write property test for date validation preservation
  - **Property 13: Date Validation Preservation**
  - **Validates: Requirements 15.3**
  - Verify date validation logic is consistent across all services
  - Test with valid dates, invalid dates, empty strings, and null values

- [ ]* 21. Write property test for JOIN key correctness
  - **Property 14: JOIN Key Correctness**
  - **Validates: Requirements 16.1, 16.2**
  - Verify all JOINs use correct keys (Nro for HDR↔FACT, Nro+Factura for FACT↔ITEM)
  - Test referential integrity

- [ ]* 22. Write property test for JOIN type selection
  - **Property 15: JOIN Type Selection**
  - **Validates: Requirements 14.5, 16.3, 16.4, 16.5**
  - Verify LEFT JOIN is used when invoices are optional
  - Verify INNER JOIN is used when invoices are required
  - Test with various data scenarios

- [ ] 23. Add inline documentation to all refactored queries
  - Add comments explaining the change from old structure to new structure
  - Document the relationship between Vista_HDR, Vista_FACT, and Vista_ITEM
  - Include examples of common query patterns
  - Add REFACTORING NOTE comments to all modified queries
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 24. Create Backend/docs/VISTA_REFACTORING.md documentation
  - Document the overview of changes (Before vs After)
  - Include common query patterns with examples
  - Document JOIN strategies (LEFT vs INNER)
  - Provide migration guide for developers
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 25. Add JSDoc comments to all refactored service functions
  - Document REFACTORING CHANGES section in each function
  - Explain OLD vs NEW approach
  - Document parameters and return types
  - _Requirements: 17.1, 17.2, 17.5_

- [ ]* 26. Create integration tests for data integrity
  - Create `Backend/tests/integration/vista-refactoring.integration.test.js`
  - Test referential integrity across all JOINs
  - Test that no orders, invoices, or items are lost in refactoring
  - Verify counts match before and after refactoring
  - _Requirements: 16.3, 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ]* 27. Create unit tests for all refactored services
  - Create/update test files for all 11 refactored services
  - Test specific scenarios: orders with 0, 1, and multiple invoices
  - Test edge cases: empty strings, null values, '0' as Factura
  - Test error handling: connection failures, invalid inputs
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 28. Final checkpoint - Run all tests and verify functionality
  - Run complete test suite with coverage report
  - Verify all property-based tests pass (minimum 100 iterations each)
  - Verify all unit tests pass
  - Verify all integration tests pass
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at reasonable breaks
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The refactoring maintains backward compatibility and functional equivalence
- All business rules (Incoterms, date validations, document generation) are preserved
- JavaScript is used as the implementation language with Node.js and SQL Server
