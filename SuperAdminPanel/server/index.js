const express = require('express');
const path = require('path');
const db = require('./config/database');

function createServer(userDataPath) {
  db.init(userDataPath);

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // CORS for localhost
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Static files
  app.use(express.static(path.join(__dirname, '..', 'renderer')));

  // API routes
  app.use('/api/auth', require('./routes/auth.routes'));
  app.use('/api/orders', require('./routes/orders.routes'));
  app.use('/api/orphans', require('./routes/orphans.routes'));
  app.use('/api/broadcast', require('./routes/broadcast.routes'));
  app.use('/api/docker', require('./routes/docker.routes'));
  app.use('/api/pm2', require('./routes/pm2.routes'));
  app.use('/api/database', require('./routes/database.routes'));
  app.use('/api/environment', require('./routes/environment.routes'));

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  });

  return app;
}

module.exports = { createServer };
