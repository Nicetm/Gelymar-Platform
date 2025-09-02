DELIMITER //

CREATE PROCEDURE LimpiarOrderItems()
BEGIN
    -- Primero eliminar registros de csv_processing_tracking que referencien order_items
    DELETE FROM csv_processing_tracking WHERE order_item_id IS NOT NULL;
    
    -- Luego limpiar order_items
    DELETE FROM order_items;
    
    -- Resetear auto increment
    ALTER TABLE order_items AUTO_INCREMENT = 1;
    
    SELECT 'order_items y csv_processing_tracking (order_items) limpiadas correctamente' as resultado;
END //

DELIMITER ; 