const { container } = require('../config/container');
const vendedorService = container.resolve('vendedorService');
const { logger } = require('../utils/logger');
const bcrypt = require('bcrypt');

/**
 * Obtiene todos los vendedores (usuarios con role_id = 3)
 */
exports.getVendedores = async (req, res) => {
  try {
    if (!req.user || Number(req.user.roleId) !== 1) {
      return res.status(403).json({ message: 'Acceso no autorizado - Solo administradores' });
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    logger.info(`[getVendedores] request userId=${req.user?.id || 'N/A'} search=${search}`);
    const vendedores = await vendedorService.getVendedores({ search });
    res.json(vendedores);
  } catch (error) {
    logger.error(`Error al obtener vendedores: ${error.message}`);
    res.status(500).json({ message: 'Error al obtener la lista de vendedores' });
  }
};

exports.updateVendedor = async (req, res) => {
  try {
    if (!req.user || Number(req.user.roleId) !== 1) {
      return res.status(403).json({ message: 'Acceso no autorizado - Solo administradores' });
    }

    const rut = String(req.params.rut || '').trim();
    const {
      rut: nextRut,
      email,
      phone,
      activo,
      bloqueado
    } = req.body || {};

    if (!rut) {
      return res.status(400).json({ message: 'RUT requerido' });
    }

    if (!nextRut || String(nextRut).trim() === '') {
      return res.status(400).json({ message: 'RUT requerido' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    if (phone && String(phone).trim().length > 0) {
      const phoneLen = String(phone).trim().length;
      if (phoneLen < 8 || phoneLen > 20) {
        return res.status(400).json({ message: 'Teléfono debe tener entre 8 y 20 caracteres' });
      }
    }

    const normalizedActivo = Number(activo) === 1 ? 1 : 0;
    const normalizedBloqueado = Number(bloqueado) === 1 ? 1 : 0;

    const updated = await vendedorService.updateSellerByRut(rut, {
      rut: String(nextRut).trim(),
      email: email ? String(email).trim() : null,
      phone: phone ? String(phone).trim() : null,
      activo: normalizedActivo,
      bloqueado: normalizedBloqueado
    });

    if (!updated) {
      return res.status(404).json({ message: 'Vendedor no encontrado' });
    }

    res.json({
      message: 'Vendedor actualizado correctamente',
      seller: updated
    });
  } catch (error) {
    if (error.code === 'RUT_EXISTS') {
      return res.status(409).json({ message: 'RUT ya existe' });
    }
    logger.error(`Error al actualizar vendedor: ${error.message}`);
    res.status(500).json({ message: 'Error al actualizar vendedor' });
  }
};

exports.changeVendedorPassword = async (req, res) => {
  try {
    if (!req.user || Number(req.user.roleId) !== 1) {
      return res.status(403).json({ message: 'Acceso no autorizado - Solo administradores' });
    }

    const rut = String(req.params.rut || '').trim();
    const { password } = req.body || {};

    if (!rut) {
      return res.status(400).json({ message: 'RUT requerido' });
    }
    if (!password) {
      return res.status(400).json({ message: 'La contraseña es requerida' });
    }

    const isStrongPassword =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password);
    if (!isStrongPassword) {
      return res.status(400).json({
        message: 'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número'
      });
    }

    const userId = await vendedorService.changeSellerPassword(rut, password);
    if (!userId) {
      return res.status(404).json({ message: 'Usuario vendedor no encontrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { poolPromise } = require('../config/db');
    const pool = await poolPromise;
    await pool.query(
      'UPDATE users SET password = ?, change_pw = 1 WHERE id = ?',
      [hashedPassword, userId]
    );

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    logger.error(`Error al cambiar contraseña vendedor: ${error.message}`);
    res.status(500).json({ message: 'Error al cambiar contraseña' });
  }
};
