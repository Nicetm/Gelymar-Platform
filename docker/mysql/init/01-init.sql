-- MySQL Initialization Script for Gelymar Platform
-- This script runs when the MySQL container starts for the first time

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS gelymar_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE gelymar_db;

-- Create additional user with limited privileges (optional)
CREATE USER IF NOT EXISTS 'gelymar_app'@'%' IDENTIFIED BY 'app123456';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER ON gelymar_db.* TO 'gelymar_app'@'%';

-- Grant all privileges to the main user
GRANT ALL PRIVILEGES ON gelymar_db.* TO 'gelymar_user'@'%';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Show databases
SHOW DATABASES;

-- Show users
SELECT User, Host FROM mysql.user WHERE User LIKE 'gelymar%'; 