const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { container } = require('../config/container');
const monitoringService = container.resolve('monitoringService');

// Configuración de multer para subida de archivos
const upload = multer({ dest: '/tmp/' });

// Middleware para verificar token (usar el mismo sistema que monitoring)
const verifyToken = (req, res, next) => {
    const token =
        req.headers.authorization?.replace('Bearer ', '') ||
        req.query?.token ||
        null;
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token requerido' });
    }
    
    try {
        // Usar el mismo sistema de verificación que monitoring
        const user = monitoringService.verifySessionToken(token);
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Token inválido' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Token inválido' });
    }
};

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Usuario y contraseña requeridos' 
            });
        }

        // Usar el mismo sistema que monitoring
        const user = await monitoringService.authenticateUser(username, password);
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Usuario o contraseña incorrectos' 
            });
        }
        
        // Generar token de sesión
        const sessionToken = monitoringService.generateSessionToken(user);

        res.json({
            success: true,
            token: sessionToken,
            user: {
                id: user.id,
                username: user.username,
                appTypes: user.appTypes
            }
        });

    } catch (error) {
        console.error('[Fileserver] Error en login:', error.message);
        console.error('[Fileserver] Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Obtener archivos de un directorio
router.get('/files', verifyToken, async (req, res) => {
    try {
        const { path: dirPath } = req.query;
        const uploadDir = '/var/www/html/uploads';
        
        // Si no hay path, usar el directorio base
        let fullPath = uploadDir;
        if (dirPath && dirPath !== '') {
            // Remover '/' del inicio si está presente
            const cleanPath = dirPath.startsWith('/') ? dirPath.substring(1) : dirPath;
            fullPath = path.join(uploadDir, cleanPath);
        }
        
        // Validar que esté dentro del directorio permitido
        if (!fullPath.startsWith(uploadDir)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado'
            });
        }
        
        const files = await fs.readdir(fullPath, { withFileTypes: true });
        const fileList = [];
        
        for (const file of files) {
            if (file.name !== '.' && file.name !== '..') {
                const filePath = path.join(fullPath, file.name);
                const stats = await fs.stat(filePath);
                
                fileList.push({
                    name: file.name,
                    path: path.relative(uploadDir, filePath).replace(/\\/g, '/'),
                    isDirectory: file.isDirectory(),
                    size: stats.size,
                    modified: stats.mtime
                });
            }
        }
        
        // Ordenar: directorios primero, luego archivos
        fileList.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        res.json({
            success: true,
            files: fileList
        });
    } catch (error) {
        console.error('Error al obtener archivos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener archivos'
        });
    }
});

// Descargar archivo
router.get('/download', verifyToken, async (req, res) => {
    try {
        const filePath = req.query?.path;
        const uploadDir = '/var/www/html/uploads';
        if (!filePath) {
            return res.status(400).json({
                success: false,
                message: 'Ruta requerida'
            });
        }

        const cleanPath = String(filePath).replace(/^\/+/, '');
        const fullPath = path.join(uploadDir, cleanPath);

        if (!fullPath.startsWith(uploadDir)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado'
            });
        }

        await fs.stat(fullPath);
        return res.sendFile(fullPath);
    } catch (error) {
        console.error('Error al descargar archivo:', error);
        return res.status(404).json({
            success: false,
            message: 'Archivo no encontrado'
        });
    }
});

// Subir archivo
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
    try {
        const { path: dirPath } = req.body;
        const uploadDir = '/var/www/html/uploads';
        
        // Si no hay path, usar el directorio base
        let targetDir = uploadDir;
        if (dirPath && dirPath !== '') {
            // Remover '/' del inicio si está presente
            const cleanPath = dirPath.startsWith('/') ? dirPath.substring(1) : dirPath;
            targetDir = path.join(uploadDir, cleanPath);
        }
        
        // Validar que esté dentro del directorio permitido
        if (!targetDir.startsWith(uploadDir)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado'
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionó archivo'
            });
        }
        
        const targetPath = path.join(targetDir, req.file.originalname);
        
        // Crear directorio si no existe
        await fs.mkdir(targetDir, { recursive: true });
        
        // Mover archivo del temporal al destino
        await fs.rename(req.file.path, targetPath);
        
        res.json({
            success: true,
            message: 'Archivo subido correctamente'
        });
    } catch (error) {
        console.error('Error al subir archivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al subir archivo'
        });
    }
});

// Crear directorio
router.post('/mkdir', verifyToken, async (req, res) => {
    try {
        const { path: dirPath, name } = req.body;
        const uploadDir = '/var/www/html/uploads';
        
        // Si no hay path, usar el directorio base
        let targetDir = uploadDir;
        if (dirPath && dirPath !== '') {
            // Remover '/' del inicio si está presente
            const cleanPath = dirPath.startsWith('/') ? dirPath.substring(1) : dirPath;
            targetDir = path.join(uploadDir, cleanPath);
        }
        
        const newDirPath = path.join(targetDir, name);
        
        // Validar que esté dentro del directorio permitido
        if (!newDirPath.startsWith(uploadDir)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado'
            });
        }
        
        await fs.mkdir(newDirPath, { recursive: true });
        
        res.json({
            success: true,
            message: 'Directorio creado correctamente'
        });
    } catch (error) {
        console.error('Error al crear directorio:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear directorio'
        });
    }
});

// Eliminar archivo/directorio
router.delete('/delete', verifyToken, async (req, res) => {
    try {
        const { path: dirPath, name } = req.body;
        const uploadDir = '/var/www/html/uploads';
        
        // Si no hay path, usar el directorio base
        let targetDir = uploadDir;
        if (dirPath && dirPath !== '') {
            // Remover '/' del inicio si está presente
            const cleanPath = dirPath.startsWith('/') ? dirPath.substring(1) : dirPath;
            targetDir = path.join(uploadDir, cleanPath);
        }
        
        const targetPath = path.join(targetDir, name);
        
        // Validar que esté dentro del directorio permitido
        if (!targetPath.startsWith(uploadDir)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado'
            });
        }
        
        const stats = await fs.stat(targetPath);
        
        if (stats.isDirectory()) {
            await fs.rmdir(targetPath);
        } else {
            await fs.unlink(targetPath);
        }
        
        res.json({
            success: true,
            message: 'Archivo eliminado correctamente'
        });
    } catch (error) {
        console.error('Error al eliminar archivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar archivo'
        });
    }
});

module.exports = router;
