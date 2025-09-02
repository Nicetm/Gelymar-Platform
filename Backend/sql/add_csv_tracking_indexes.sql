-- Agregar índices para CSV tracking en orders
CREATE INDEX idx_orders_csv_hash ON orders(csv_row_hash);
CREATE INDEX idx_orders_csv_timestamp ON orders(csv_file_timestamp);

-- Agregar índices para CSV tracking en order_detail
CREATE INDEX idx_order_detail_csv_hash ON order_detail(csv_row_hash);
CREATE INDEX idx_order_detail_csv_timestamp ON order_detail(csv_file_timestamp);

-- Índices compuestos para mejorar búsquedas por clave única
CREATE INDEX idx_orders_pc_oc_factura ON orders(pc, oc, factura);
CREATE INDEX idx_order_detail_order_id ON order_detail(order_id);

-- Índices para csv_processing_tracking
CREATE INDEX idx_csv_tracking_order_id ON csv_processing_tracking(order_id);
CREATE INDEX idx_csv_tracking_hash ON csv_processing_tracking(order_detail_hash);
CREATE INDEX idx_csv_tracking_timestamp ON csv_processing_tracking(csv_file_timestamp); 