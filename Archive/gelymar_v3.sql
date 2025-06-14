
-- ============================================================
-- ESQUEMA CORPORATIVO PROFESIONAL PARA SISTEMA MULTIDOMINIO
-- ============================================================

-- ========================
-- CORE: Clientes
-- ========================
CREATE TABLE `core_customers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(20),
  `mobile` VARCHAR(20),
  `address` VARCHAR(255),
  `city` VARCHAR(100),
  `country` VARCHAR(100),
  `status` TINYINT(1) DEFAULT 1,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` INT,
  `updated_by` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- ========================
-- CORE: Contactos
-- ========================
CREATE TABLE `core_customer_contacts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `name` VARCHAR(255),
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20),
  `role` VARCHAR(100),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `core_customers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ========================
-- SALES: Pedidos
-- ========================
CREATE TABLE `sales_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `product` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `core_customers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `sales_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `unit_price` DECIMAL(10,2),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sales_items_by_order` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` INT NOT NULL,
  `item_id` INT NOT NULL,
  `description` VARCHAR(255),
  `quantity` DECIMAL(10,2),
  `unit` VARCHAR(10),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `sales_items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ========================
-- FILES: Documentos y Archivos
-- ========================
CREATE TABLE `files_folders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `name` VARCHAR(255),
  `path` VARCHAR(500),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `core_customers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `files_documents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `folder_id` INT NOT NULL,
  `filename` VARCHAR(255),
  `document_type` VARCHAR(100),
  `status` VARCHAR(50),
  `was_sent` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `core_customers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`folder_id`) REFERENCES `files_folders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ========================
-- AUTH: Usuarios y Roles
-- ========================
CREATE TABLE `auth_users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `role` ENUM('admin','manager','client') DEFAULT 'client',
  `last_login` TIMESTAMP NULL,
  `password_updated_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `auth_roles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `auth_user_roles` (
  `user_id` INT NOT NULL,
  `role_id` INT NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `auth_roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ========================
-- AUDIT: Historial de cambios
-- ========================
CREATE TABLE `audit_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entity_name` VARCHAR(100),
  `entity_id` INT,
  `operation` ENUM('INSERT','UPDATE','DELETE'),
  `old_data` JSON,
  `new_data` JSON,
  `performed_by` INT,
  `performed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`performed_by`) REFERENCES `auth_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ========================
-- Configuración Global
-- ========================
CREATE TABLE `system_settings` (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT
) ENGINE=InnoDB;

-- ========================
-- Índices Clave
-- ========================
CREATE INDEX idx_orders_status ON sales_orders(status);
CREATE INDEX idx_documents_type ON files_documents(document_type);
CREATE INDEX idx_customers_email ON core_customers(email);

-- Final
COMMIT;
