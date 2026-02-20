const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { container } = require('../config/container');
const { normalizeRole } = require('../utils/role.util');
const { validateFilePath } = require('../utils/filePermissions');

const router = express.Router();
const userService = container.resolve('userService');
const fileService = container.resolve('fileService');

const normalizeRut = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.toLowerCase().endsWith('c') ? raw.slice(0, -1) : raw;
};

const assetAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }
    if (!token && req.query?.token) {
      token = String(req.query.token);
    }

    if (!token) {
      return res.status(401).json({ message: 'Token requerido' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ message: 'Token inválido o expirado' });
    }

    const user = await userService.findUserForAuth(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    const normalizedRole = normalizeRole(user.role, user.role_id);
    req.user = {
      ...decoded,
      rut: decoded.rut || decoded.email,
      role: normalizedRole,
      roleName: user.role,
      roleId: user.role_id,
      customer_rut: user.rut
    };

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error interno de autenticación' });
  }
};

router.get('/', assetAuth, async (req, res) => {
  try {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const relativePath = String(req.query?.path || '').replace(/^\/+/, '');
    if (!relativePath) {
      return res.status(400).json({ message: 'path requerido' });
    }

    const basePath = process.env.FILE_SERVER_ROOT || '/var/www/html';
    if (!validateFilePath(relativePath, basePath)) {
      return res.status(400).json({ message: 'Ruta inválida' });
    }

    const fullPath = path.join(basePath, relativePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    const role = req.user?.role;
    if (role !== 'admin' && role !== 'seller') {
      const customerRut = normalizeRut(req.user?.customer_rut || req.user?.rut);
      const normalizedPath = relativePath.replace(/\\/g, '/');

      if (normalizedPath.startsWith('uploads/admins/')) {
        // Avatares de admin: permitidos para usuarios autenticados
      } else if (normalizedPath.startsWith('uploads/chat/')) {
        const parts = normalizedPath.split('/');
        const folderRut = normalizeRut(parts[2] || '');
        if (!customerRut || folderRut !== customerRut) {
          return res.status(403).json({ message: 'Acceso denegado' });
        }
      } else {
        const fileRecord = await fileService.getFileByPath(relativePath);
        const fileRut = normalizeRut(fileRecord?.customer_rut);
        if (!fileRut || !customerRut || fileRut !== customerRut) {
          return res.status(403).json({ message: 'Acceso denegado' });
        }
      }
    }

    return res.sendFile(fullPath);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
