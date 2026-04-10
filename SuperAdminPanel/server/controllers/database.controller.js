const { getPool } = require('../config/database');

const ALLOWED_TABLES = ['order_files', 'order_snapshots', 'param_config', 'users'];

exports.list = async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ message: 'Tabla no permitida' });

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 25, 100);
  const offset = (page - 1) * limit;

  try {
    const pool = getPool();
    if (!pool) return res.status(500).json({ message: 'BD no conectada' });

    // Build filter conditions
    let where = '';
    const values = [];
    const filters = req.query.filters ? JSON.parse(req.query.filters) : {};
    const conditions = Object.entries(filters).map(([col, val]) => {
      values.push(`%${val}%`);
      return `\`${col.replace(/[^a-zA-Z0-9_]/g, '')}\` LIKE ?`;
    });
    if (conditions.length) where = 'WHERE ' + conditions.join(' AND ');

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM \`${table}\` ${where}`, values);
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...values, limit, offset]);

    res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.includes(table)) return res.status(400).json({ message: 'Tabla no permitida' });

  const data = req.body;
  delete data.id; // Don't update ID

  const fields = Object.keys(data).map(k => `\`${k.replace(/[^a-zA-Z0-9_]/g, '')}\` = ?`);
  const values = Object.values(data);

  if (!fields.length) return res.status(400).json({ message: 'Sin campos para actualizar' });

  try {
    const pool = getPool();
    if (!pool) return res.status(500).json({ message: 'BD no conectada' });

    values.push(id);
    await pool.query(`UPDATE \`${table}\` SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Actualizado' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
