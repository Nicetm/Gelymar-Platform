-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 15-06-2025 a las 03:11:10
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `gelymar`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `files`
--

CREATE TABLE `files` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `folder_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `path` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `eta` date DEFAULT NULL,
  `etd` date DEFAULT NULL,
  `was_sent` tinyint(1) DEFAULT 0,
  `document_type` varchar(100) DEFAULT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `status_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Volcado de datos para la tabla `files`
--

INSERT INTO `files` (`id`, `customer_id`, `folder_id`, `name`, `path`, `created_at`, `updated_at`, `eta`, `etd`, `was_sent`, `document_type`, `file_type`, `status_id`) VALUES
(112, 1, 43, 'Recepcion de orden', 'Oceanic Freight Ltd\\000561\\Recepcion de orden.pdf', '2025-06-14 06:00:21', '2025-06-14 06:04:46', NULL, NULL, NULL, NULL, 'PDF', 3),
(113, 1, 43, 'Aviso de Embarque', NULL, '2025-06-14 06:00:21', '2025-06-14 06:00:21', NULL, NULL, NULL, NULL, NULL, 1),
(114, 1, 43, 'Aviso de Recepcion de orden', NULL, '2025-06-14 06:00:21', '2025-06-14 06:00:21', NULL, NULL, NULL, NULL, NULL, 1),
(115, 1, 43, 'Recepcion de orden', 'Oceanic Freight Ltd\\000561\\Recepcion de orden.pdf', '2025-06-14 06:05:16', '2025-06-14 06:05:16', NULL, NULL, 1, NULL, 'PDF', 4);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `files`
--
ALTER TABLE `files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `folder_id` (`folder_id`),
  ADD KEY `fk_files_status` (`status_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `files`
--
ALTER TABLE `files`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=116;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `files`
--
ALTER TABLE `files`
  ADD CONSTRAINT `files_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `files_ibfk_2` FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_files_status` FOREIGN KEY (`status_id`) REFERENCES `order_status` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
