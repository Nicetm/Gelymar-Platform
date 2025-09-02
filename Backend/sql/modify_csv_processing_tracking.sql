-- Modificar csv_processing_tracking para incluir order_items
ALTER TABLE csv_processing_tracking 
ADD COLUMN order_item_id INT NULL,
ADD COLUMN order_items_hash VARCHAR(32) NULL;

-- Agregar foreign key para order_items
ALTER TABLE csv_processing_tracking 
ADD CONSTRAINT fk_csv_tracking_order_item 
FOREIGN KEY (order_item_id) REFERENCES order_items(id);

-- Crear índices para los nuevos campos
CREATE INDEX idx_csv_tracking_order_item_id ON csv_processing_tracking(order_item_id);
CREATE INDEX idx_csv_tracking_order_items_hash ON csv_processing_tracking(order_items_hash); 