const express = require('express');
const router = express.Router();
const controller = require('../controllers/cronConfig.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

/**
 * @swagger
 * /api/cron-config/cron-tasks-config:
 *   get:
 *     summary: Obtiene la configuración de todas las tareas de cron
 *     tags: [Configuración Cron]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   task_name:
 *                     type: string
 *                   task_description:
 *                     type: string
 *                   is_enabled:
 *                     type: boolean
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   updated_at:
 *                     type: string
 *                     format: date-time
 *       500:
 *         description: Error interno del servidor
 */
router.get('/cron-tasks-config', authMiddleware, authorizeRoles(['admin']), controller.getCronTasksConfig);

/**
 * @swagger
 * /api/cron-config/cron-tasks-config/{taskName}:
 *   put:
 *     summary: Actualiza el estado de una tarea de cron específica
 *     tags: [Configuración Cron]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskName
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre de la tarea de cron
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_enabled
 *             properties:
 *               is_enabled:
 *                 type: boolean
 *                 description: Estado de la tarea (habilitada/deshabilitada)
 *     responses:
 *       200:
 *         description: Configuración actualizada exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Tarea de cron no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.put('/cron-tasks-config/:taskName', authMiddleware, authorizeRoles(['admin']), controller.updateCronTaskConfig);

/**
 * @swagger
 * /api/cron-config/cron-tasks-config:
 *   put:
 *     summary: Actualiza múltiples configuraciones de tareas de cron
 *     tags: [Configuración Cron]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tasks
 *             properties:
 *               tasks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - task_name
 *                     - is_enabled
 *                   properties:
 *                     task_name:
 *                       type: string
 *                     is_enabled:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Configuraciones actualizadas exitosamente
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error interno del servidor
 */
router.put('/cron-tasks-config', authMiddleware, authorizeRoles(['admin']), controller.updateMultipleCronTasksConfig);

module.exports = router;
