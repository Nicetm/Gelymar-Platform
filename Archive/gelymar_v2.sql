-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 11-06-2025 a las 02:39:13
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
-- Estructura de tabla para la tabla `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `uuid` char(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `status` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Volcado de datos para la tabla `customers`
--

INSERT INTO `customers` (`id`, `name`, `uuid`, `email`, `phone`, `mobile`, `address`, `country`, `city`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Oceanic Freight Ltd', 'a3f0c4d8-72d9-4c4e-a6b1-28d0bdf9ae65', 'oceanicfreightltd@gelymar.cl', NULL, NULL, NULL, 'Canadá', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(2, 'Maritime Logistics Corp', '0cb70544-3e3f-4a2f-82e4-781c5f0a1215', 'maritimelogisticscorp@gelymar.cl', NULL, NULL, NULL, 'México', NULL, 0, '2025-06-08 18:25:05', '2025-06-08 18:48:44'),
(3, 'BlueWave Shipping', 'ab4b6a1d-5985-43f7-841f-56ad6dc0d4f6', 'bluewaveshipping@gelymar.cl', NULL, NULL, NULL, 'Perú', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(4, 'Atlantic Carriers', '6dc13c52-e4cc-4e2c-b3ce-c93b75fead87', 'atlanticcarriers@gelymar.cl', NULL, NULL, NULL, 'Brasil', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(5, 'Global Marine Express', '2d9eb1c0-c1b6-4046-8b7c-7e9e4c52b6f2', 'globalmarineexpress@gelymar.cl', NULL, NULL, NULL, 'Brasil', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(6, 'Neptune Cargo', 'b15f7135-d8d9-4ce7-952b-632f182dd208', 'neptunecargo@gelymar.cl', NULL, NULL, NULL, 'Ecuador', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(7, 'Pacific Horizon Lines', '27cddcdf-e78a-40e9-83f2-3e87b71b8650', 'pacifichorizonlines@gelymar.cl', NULL, NULL, NULL, 'Canadá', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(8, 'Titan Sea Transport', '263390ed-417f-47e0-a349-3060ed80f429', 'titanseatransport@gelymar.cl', NULL, NULL, NULL, 'Perú', NULL, 0, '2025-06-08 18:25:05', '2025-06-08 19:00:52'),
(9, 'Poseidon Freight', '94e0db38-d70d-4ec4-8cd3-708da509bdfb', 'poseidonfreight@gelymar.cl', NULL, NULL, NULL, 'Canadá', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(10, 'Horizon Maritime Ltd', 'bf4b366c-d119-417b-a121-5d8f25e84d30', 'horizonmaritimeltd@gelymar.cl', NULL, NULL, NULL, 'Colombia', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(11, 'Anchor Bay Shipping', '0cb8d688-bc5d-4d10-87ff-8f291a9eaf00', 'anchorbayshipping@gelymar.cl', NULL, NULL, NULL, 'Colombia', NULL, 0, '2025-06-08 18:25:05', '2025-06-08 19:00:56'),
(12, 'Seaway Global Logistics', 'e44305e0-bdf4-47b0-a398-38ad3b5df2d1', 'seawaygloballogistics@gelymar.cl', NULL, NULL, NULL, 'Chile', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(13, 'AquaVoyage Ltd', '77bc9c2a-307b-42ff-b4ce-0df3a6de71a8', 'aquavoyageltd@gelymar.cl', NULL, NULL, NULL, 'México', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(14, 'CoralLine Shipping', 'd4f7d48f-f5d6-40ce-bb0e-e9d31e77f3c0', 'corallineshipping@gelymar.cl', NULL, NULL, NULL, 'Brasil', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(15, 'DeepBlue Transport', 'abf198ae-0ecf-4aa5-8a0c-07ed0d6e1044', 'deepbluetransport@gelymar.cl', NULL, NULL, NULL, 'México', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(16, 'MarineGate Carriers', '0e8d3cf6-1e44-4f23-8862-03e14659d4e6', 'marinegatecarriers@gelymar.cl', NULL, NULL, NULL, 'Chile', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(17, 'OceanStar Freight', '25872b62-1cf8-4390-9b53-bd27b1e4a91e', 'oceanstarfreight@gelymar.cl', NULL, NULL, NULL, 'Argentina', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(18, 'Seaspan Cargo', 'ad646a88-f7e0-4f3b-b7a0-e34511fcb177', 'seaspancargo@gelymar.cl', NULL, NULL, NULL, 'Perú', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(19, 'Nautilus Maritime', 'b869dd7a-60c7-4f99-b8c5-4533d168d9b8', 'nautilusmaritime@gelymar.cl', NULL, NULL, NULL, 'Brasil', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(20, 'Trident Logistics', 'e0402da1-655e-40fd-83e7-2596e279a1e1', 'tridentlogistics@gelymar.cl', NULL, NULL, NULL, 'México', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(21, 'WaveRider Shipping', '2ed991c5-c367-4bfa-b536-258ccfc68ef3', 'waveridershipping@gelymar.cl', NULL, NULL, NULL, 'Uruguay', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(22, 'Meridian Oceanic', 'd2b2a0ff-30c0-44c3-a5f7-189c78d45a85', 'meridianoceanic@gelymar.cl', NULL, NULL, NULL, 'Argentina', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(23, 'SeaBridge Carriers', '47f28e38-29d6-46d4-9d4a-8b958dbf0f90', 'seabridgecarriers@gelymar.cl', NULL, NULL, NULL, 'Perú', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(24, 'Kraken Line Ltd', '3b9f9586-d87d-4c5f-b3c2-51ae101093e5', 'krakenlineltd@gelymar.cl', NULL, NULL, NULL, 'Brasil', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(25, 'OceanTrail Logistics', 'fe71703d-38b4-41a7-bf84-c7dd398fd325', 'oceantraillogistics@gelymar.cl', NULL, NULL, NULL, 'Ecuador', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(26, 'Marinex Global', 'd8c3a65d-3b3c-4c62-976f-74e2d3d6e0e2', 'marinexglobal@gelymar.cl', NULL, NULL, NULL, 'Uruguay', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(27, 'Suncoast Cargo', 'f4f1e114-ff06-4083-a948-02e3692a418f', 'suncoastcargo@gelymar.cl', NULL, NULL, NULL, 'Colombia', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(28, 'SeaWing Freight', '997c0a3a-bd1e-456e-b47e-4fcf816b92e3', 'seawingfreight@gelymar.cl', NULL, NULL, NULL, 'Perú', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(29, 'HarborLine Logistics', '9bc29b0c-989a-4af6-9004-3d3a891f55f5', 'harborlinelogistics@gelymar.cl', NULL, NULL, NULL, 'Brasil', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(30, 'Aqualink Maritime', '6e22a84e-139f-4061-9580-5c822b1b36db', 'aqualinkmaritime@gelymar.cl', NULL, NULL, NULL, 'Uruguay', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(31, 'MarineXpress', '5d2185f4-54d6-4f24-9154-e30f60f9d9d0', 'marinexpress@gelymar.cl', NULL, NULL, NULL, 'Uruguay', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(32, 'SilverWave Shipping', 'c5d36429-f946-4ec8-986a-e51b9ce20e6f', 'silverwaveshipping@gelymar.cl', NULL, NULL, NULL, 'Colombia', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(33, 'PoseiTrans Ltd', 'e5f60f68-6e49-4fa4-9f96-5d1e86f3838d', 'poseitransltd@gelymar.cl', NULL, NULL, NULL, 'Canadá', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(34, 'Atlantic Pulse Carriers', 'a26c8993-95df-476c-86a3-62ad548eae67', 'atlanticpulsecarriers@gelymar.cl', NULL, NULL, NULL, 'Chile', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(35, 'BlueAnchor Logistics', '39be9914-d364-4ddf-b92d-f9c7db60b74e', 'blueanchorlogistics@gelymar.cl', NULL, NULL, NULL, 'Colombia', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(36, 'SailNet Freight', 'b7a5b91d-7d0b-4f86-b5e0-74b80a7e90a6', 'sailnetfreight@gelymar.cl', NULL, NULL, NULL, 'México', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(37, 'Oceanreach Transport', '7ce27840-7b2d-4a38-95a8-25e3e5e9b6e3', 'oceanreachtransport@gelymar.cl', NULL, NULL, NULL, 'Chile', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(38, 'DeepRoute Maritime', '46b06c0d-d18b-4f40-b83d-f57e58fa5e69', 'deeproutemaritime@gelymar.cl', NULL, NULL, NULL, 'Argentina', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(39, 'StormRider Shipping', 'cf223290-4c36-49c8-9c2f-94f6d6f993eb', 'stormridershipping@gelymar.cl', NULL, NULL, NULL, 'Argentina', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(40, 'MarineFlow Ltd', 'd1a62332-f8f2-46a8-9859-99f3d3ff6a37', 'marineflowltd@gelymar.cl', NULL, NULL, NULL, 'Canadá', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(41, 'OceanRoute Express', '43b3b88a-6804-41bb-90d3-98f14e8a0fa4', 'oceanrouteexpress@gelymar.cl', NULL, NULL, NULL, 'Chile', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(42, 'GlobalSails Ltd', '3d3ff640-7f1c-47b6-b99c-ecb48c5ac52f', 'globalsailsltd@gelymar.cl', NULL, NULL, NULL, 'Perú', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(43, 'Tideway Shipping', '0c182292-bad3-437f-a2a5-6b2bbcc3d122', 'tidewayshipping@gelymar.cl', NULL, NULL, NULL, 'Argentina', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(44, 'AquaStar Logistics', '740dfe2c-b08d-4b45-8ef2-746f227b31e9', 'aquastarlogistics@gelymar.cl', NULL, NULL, NULL, 'Ecuador', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(45, 'PacificStream Carriers', 'f8716a4a-c1e5-4cf7-8618-07e3f02bcb42', 'pacificstreamcarriers@gelymar.cl', NULL, NULL, NULL, 'Colombia', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(46, 'NaviGate Global', 'ff3b14de-f098-4a34-812e-1eb7ac06e3c0', 'navigateglobal@gelymar.cl', NULL, NULL, NULL, 'Canadá', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(47, 'Coastal Path Shipping', '1d4cc676-87aa-42db-b97d-0f2ef01a31f5', 'coastalpathshipping@gelymar.cl', NULL, NULL, NULL, 'Colombia', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(48, 'BlueTitan Freight', '7d17724b-6c95-4a77-bec5-e1e5856e7e65', 'bluetitanfreight@gelymar.cl', NULL, NULL, NULL, 'Estados Unidos', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(49, 'Neptune Lines', '857d9394-45a3-48be-9808-93dc6727a04c', 'neptunelines@gelymar.cl', NULL, NULL, NULL, 'Colombia', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19'),
(50, 'SailCore Logistics', '519ce083-0658-4f06-8668-3df0b620e8f1', 'sailcorelogistics@gelymar.cl', NULL, NULL, NULL, 'Canadá', NULL, 1, '2025-06-08 18:25:05', '2025-06-08 18:33:19');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `customer_contacts`
--

CREATE TABLE `customer_contacts` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `documents`
--

CREATE TABLE `documents` (
  `id` int(11) NOT NULL,
  `client_name` varchar(255) NOT NULL,
  `folder_name` varchar(255) NOT NULL,
  `filename` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `files`
--

CREATE TABLE `files` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `folder_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `path` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `eta` date DEFAULT NULL,
  `etd` date DEFAULT NULL,
  `was_sent` tinyint(1) DEFAULT 0,
  `status` enum('no_creado','creado','enviado','reenviado') DEFAULT 'no_creado',
  `document_type` varchar(100) DEFAULT NULL,
  `file_type` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Volcado de datos para la tabla `files`
--

INSERT INTO `files` (`id`, `customer_id`, `folder_id`, `name`, `path`, `created_at`, `updated_at`, `eta`, `etd`, `was_sent`, `status`, `document_type`, `file_type`) VALUES
(3, 1, 3, 'factura_1245.pdf', 'Oceanic Freight Ltd/PC000200/factura_1245.pdf', '2025-06-08 21:54:47', '2025-06-08 21:56:46', '2025-06-12', '2025-06-10', 0, 'creado', 'Factura', 'PDF'),
(4, 1, 3, 'packing_list_1245.xlsx', 'Oceanic Freight Ltd/PC000200/packing_list_1245.xlsx', '2025-06-08 21:54:47', '2025-06-08 21:56:50', '2025-06-12', '2025-06-09', 1, 'enviado', 'Packing List', 'PDF');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `folders`
--

CREATE TABLE `folders` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `path` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Volcado de datos para la tabla `folders`
--

INSERT INTO `folders` (`id`, `customer_id`, `name`, `path`, `created_at`) VALUES
(3, 1, 'PC000200', 'Oceanic Freight Ltd/PC000200', '2025-06-08 19:54:54'),
(5, 3, 'PC000201', 'BlueWave Shipping/PC000201', '2025-06-08 20:03:44'),
(6, 4, 'PC000202', 'Atlantic Carriers/PC000202', '2025-06-08 21:14:30'),
(7, 1, 'PC000560', 'Oceanic Freight Ltd/PC000560', '2025-06-08 21:18:22'),
(8, 1, 'PC000203', 'Oceanic Freight Ltd/PC000203', '2025-06-09 01:44:55'),
(9, 1, 'Varios', 'Oceanic Freight Ltd/Varios', '2025-06-09 01:57:24'),
(10, 3, 'Varios', 'BlueWave Shipping/Varios', '2025-06-09 16:30:48'),
(11, 5, 'PC000204', 'Global Marine Express/PC000204', '2025-06-09 16:37:57'),
(12, 6, 'PC000205', 'Neptune Cargo/PC000205', '2025-06-09 16:38:37'),
(17, 9, 'PC000207', 'Poseidon Freight/PC000207', '2025-06-09 16:59:41'),
(18, 9, 'Varios', 'Poseidon Freight/Varios', '2025-06-09 17:00:53'),
(19, 6, 'Varios', 'Neptune Cargo/Varios', '2025-06-09 17:30:44');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `items_by_order`
--

CREATE TABLE `items_by_order` (
  `id` int(11) NOT NULL,
  `order_id` varchar(50) NOT NULL,
  `item_id` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `unit` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `product` varchar(255) NOT NULL,
  `status` enum('pending','processing','completed','cancelled') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `order_details`
--

CREATE TABLE `order_details` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `product` varchar(255) NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unit` varchar(10) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL COMMENT 'Ej: admin, client'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Volcado de datos para la tabla `roles`
--

INSERT INTO `roles` (`id`, `name`) VALUES
(1, 'admin'),
(2, 'client');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `subfolders`
--

CREATE TABLE `subfolders` (
  `id` int(11) NOT NULL,
  `folder_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `path` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role_id` int(11) NOT NULL,
  `twoFASecret` varchar(64) DEFAULT NULL,
  `twoFAEnabled` tinyint(1) DEFAULT 0,
  `full_name` varchar(100) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `role_id`, `twoFASecret`, `twoFAEnabled`, `full_name`, `phone`, `country`, `city`, `created_at`, `updated_at`) VALUES
(1, 'admin@gelymar.com', '$2b$10$GKJWGfuHkAwyPuP/TYF1huZQTdWkjgpL6AVbR5w2yiv32XKn9dJ7S', 1, 'JRRHGXLPHZYECWBQMFVTWVKEERGFILDM', 1, 'Administrador Gelymar', '+56 9 1234 5678', 'Chile', 'Puerto Montt', '2025-06-09 16:24:23', '2025-06-09 16:24:23'),
(2, 'user@mail.com', '$2b$10$GLm7lzVln/kHez9rWxR1COEThJi9eHIOTJyUY/ncRIYUwppAhLANW', 2, 'LVGEMS22GARXUQSLO5IGKJKAEQZCCN3Z', 1, 'Usuario de Prueba', '+56 9 9999 9999', 'Chile', 'Santiago', '2025-06-09 16:25:29', '2025-06-09 16:25:29'),
(3, 'pcsm.cs@gmail.com', '$2b$10$eagMaswmRaPICyjVDQ64/ut.Qg0Kbf5CL3X0mXqrjAGRflbhcUBRy', 1, 'OBJT422CKQYXE4ROLJRT45LMIUYCI2B3', 0, 'Administrador Secundario', '+56 9 8888 8888', 'Chile', 'Valparaíso', '2025-06-09 16:25:40', '2025-06-09 21:51:50');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indices de la tabla `customer_contacts`
--
ALTER TABLE `customer_contacts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indices de la tabla `documents`
--
ALTER TABLE `documents`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `files`
--
ALTER TABLE `files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `folder_id` (`folder_id`);

--
-- Indices de la tabla `folders`
--
ALTER TABLE `folders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indices de la tabla `items_by_order`
--
ALTER TABLE `items_by_order`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `client_id` (`client_id`);

--
-- Indices de la tabla `order_details`
--
ALTER TABLE `order_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indices de la tabla `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indices de la tabla `subfolders`
--
ALTER TABLE `subfolders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `folder_id` (`folder_id`);

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `role_id` (`role_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT de la tabla `customer_contacts`
--
ALTER TABLE `customer_contacts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `documents`
--
ALTER TABLE `documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `files`
--
ALTER TABLE `files`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `folders`
--
ALTER TABLE `folders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT de la tabla `items_by_order`
--
ALTER TABLE `items_by_order`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `order_details`
--
ALTER TABLE `order_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `subfolders`
--
ALTER TABLE `subfolders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `customer_contacts`
--
ALTER TABLE `customer_contacts`
  ADD CONSTRAINT `customer_contacts_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `files`
--
ALTER TABLE `files`
  ADD CONSTRAINT `files_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `files_ibfk_2` FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `folders`
--
ALTER TABLE `folders`
  ADD CONSTRAINT `folders_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `order_details`
--
ALTER TABLE `order_details`
  ADD CONSTRAINT `order_details_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `subfolders`
--
ALTER TABLE `subfolders`
  ADD CONSTRAINT `subfolders_ibfk_1` FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
