const db = require('../config/database');

exports.switchEnv = async (req, res) => {
  const { environment } = req.body;
  if (!environment || !['dev', 'prod'].includes(environment)) {
    return res.status(400).json({ message: 'Ambiente inválido' });
  }
  try {
    await db.switchEnvironment(environment);
    res.json({ environment: db.getCurrentEnv() });
  } catch (err) {
    res.status(500).json({ message: 'Error cambiando ambiente: ' + err.message });
  }
};

exports.current = (req, res) => {
  res.json({ environment: db.getCurrentEnv() });
};

exports.getConfig = (req, res) => {
  res.json(db.getConfig());
};

exports.saveConfig = (req, res) => {
  try {
    db.saveConfig(req.body);
    res.json({ message: 'Configuración guardada' });
  } catch (err) {
    res.status(500).json({ message: 'Error guardando configuración: ' + err.message });
  }
};

exports.status = (req, res) => {
  const config = db.getConfig();
  const env = db.getCurrentEnv();
  const envCfg = config.environments?.[env];
  const configured = !!(envCfg?.mysql?.host);
  const connected = !!db.getPool();
  res.json({ configured, connected, environment: env });
};

exports.getRemembered = (req, res) => {
  const config = db.getConfig();
  res.json(config.rememberedLogin || null);
};

exports.saveRemembered = (req, res) => {
  try {
    const config = db.getConfig();
    config.rememberedLogin = req.body || null;
    db.saveConfig(config);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
