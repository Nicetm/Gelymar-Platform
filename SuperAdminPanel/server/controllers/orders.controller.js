const { getPool } = require('../config/database');

exports.search = async (req, res) => {
  const { pc, oc, factura, name } = req.query;
  if (!pc && !oc && !factura && !name) return res.status(400).json({ message: 'Al menos un filtro requerido' });

  try {
    const pool = getPool();
    if (!pool) return res.status(500).json({ message: 'BD no conectada' });

    const conditions = [];
    const values = [];
    if (pc) { conditions.push('pc = ?'); values.push(pc); }
    if (oc) { conditions.push('oc LIKE ?'); values.push(`%${oc}%`); }
    if (factura) { conditions.push('factura LIKE ?'); values.push(`%${factura}%`); }
    if (name) { conditions.push('name LIKE ?'); values.push(`%${name}%`); }

    const where = conditions.join(' AND ');
    const [rows] = await pool.query(`SELECT * FROM order_files WHERE ${where} ORDER BY id DESC LIMIT 100`, values);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getFiles = async (req, res) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(500).json({ message: 'BD no conectada' });

    const [rows] = await pool.query('SELECT * FROM order_files WHERE pc = ? ORDER BY id', [req.params.pc]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateFile = async (req, res) => {
  const { id } = req.params;
  const { status_id, path, is_visible_to_client, fecha_generacion, fecha_envio, fecha_reenvio } = req.body;

  try {
    const pool = getPool();
    if (!pool) return res.status(500).json({ message: 'BD no conectada' });

    const fields = [];
    const values = [];
    if (status_id !== undefined) { fields.push('status_id = ?'); values.push(status_id); }
    if (path !== undefined) { fields.push('path = ?'); values.push(path); }
    if (is_visible_to_client !== undefined) { fields.push('is_visible_to_client = ?'); values.push(is_visible_to_client); }
    if (fecha_generacion !== undefined) { fields.push('fecha_generacion = ?'); values.push(fecha_generacion); }
    if (fecha_envio !== undefined) { fields.push('fecha_envio = ?'); values.push(fecha_envio); }
    if (fecha_reenvio !== undefined) { fields.push('fecha_reenvio = ?'); values.push(fecha_reenvio); }

    if (!fields.length) return res.status(400).json({ message: 'Sin campos para actualizar' });

    values.push(id);
    await pool.query(`UPDATE order_files SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Actualizado' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
