-- Agregar columnas de tracking CSV a order_items
ALTER TABLE order_items 
ADD COLUMN csv_row_hash VARCHAR(32) NULL COMMENT 'Hash MD5 de la fila CSV para detectar cambios',
ADD COLUMN csv_file_timestamp TIMESTAMP NULL COMMENT 'Timestamp del archivo CSV cuando se procesó';

-- Crear índice para mejorar performance en búsquedas por hash
CREATE INDEX idx_order_items_csv_hash ON order_items(csv_row_hash);
CREATE INDEX idx_order_items_csv_timestamp ON order_items(csv_file_timestamp); 