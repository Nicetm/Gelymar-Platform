const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const winston = require('winston');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const Docker = require('dockerode');
const { Client } = require('ssh2');

// Importar rutas
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const auditRoutes = require('./routes/audit');
const testingRoutes = require('./routes/testing');
const integrationRoutes = require('./routes/integration');

// Importar middleware
const AuditMiddleware = require('./middleware/audit.middleware');
const RoleMiddleware = require('./middleware/role.middleware');

// Configurar logger
const logger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/app/logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/app/logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 8083;

// Inicializar Docker
const docker = new Docker();

// Inicializar middleware
const auditMiddleware = new AuditMiddleware();
const roleMiddleware = new RoleMiddleware();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
      scriptSrcElem: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "http://localhost:7682", "http://172.20.10.151:7682"],
    },
  },
}));

app.use(cors());
app.use(morgan('combined', { stream: { write: message => logger.warn(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configurar sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || 'gelymar-config-manager-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Cambiar a true en producción con HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de autenticación
app.use('/auth', authRoutes);

// Rutas API (protegidas)
app.use('/api', apiRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/testing', testingRoutes);
app.use('/api/integration', integrationRoutes);

// Ruta principal - redirigir a login o dashboard
app.get('/', (req, res) => {
  console.log('🔍 Sesión actual:', req.session);
  if (req.session && req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/auth/login');
  }
});

// Ruta del dashboard (protegida)
app.get('/dashboard', (req, res) => {
  if (req.session && req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    res.redirect('/auth/login');
  }
});


// Favicon
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// WebSocket para logs en tiempo real y terminal SSH
io.on('connection', (socket) => {
  logger.info('Cliente conectado para logs en tiempo real');
  
  // Variables para conexión SSH
  let sshConn = null;
  let sshStream = null;
  
  // Terminal SSH remoto
  socket.on('ssh-connect', ({ host, port, username, password }) => {
    try {
      sshConn = new Client();
      
      sshConn.on('ready', () => {
        logger.info(`SSH conectado a ${host}:${port}`);
        socket.emit('ssh-connected', { message: 'SSH conectado exitosamente' });
        
        sshConn.shell((err, stream) => {
          if (err) {
            socket.emit('ssh-error', { message: 'Error abriendo shell: ' + err.message });
            return;
          }
          
          sshStream = stream;
          
          stream.on('data', (data) => {
            socket.emit('ssh-output', data.toString());
          });
          
          stream.on('close', () => {
            sshConn.end();
            socket.emit('ssh-disconnected', { message: 'Conexión SSH cerrada' });
          });
          
          stream.on('error', (err) => {
            socket.emit('ssh-error', { message: 'Error en stream: ' + err.message });
          });
        });
      });
      
      sshConn.on('error', (err) => {
        socket.emit('ssh-error', { message: 'Error de conexión SSH: ' + err.message });
      });
      
      sshConn.connect({
        host: host,
        port: port || 22,
        username: username,
        password: password
      });
      
    } catch (error) {
      socket.emit('ssh-error', { message: 'Error iniciando conexión SSH: ' + error.message });
    }
  });
  
  socket.on('ssh-input', (data) => {
    if (sshStream) {
      sshStream.write(data);
    }
  });
  
  socket.on('ssh-disconnect', () => {
    if (sshStream) {
      sshStream.close();
    }
    if (sshConn) {
      sshConn.end();
    }
  });
  
  // Terminal por contenedor
  let containerStream = null;
  
  socket.on('container-command', async ({ containerName, command }) => {
    try {
      const container = docker.getContainer(containerName);
      
      // Crear ejecución en el contenedor
      const exec = await container.exec({
        Cmd: ['/bin/bash', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: true,
        Tty: true
      });
      
      // Iniciar stream
      containerStream = await exec.start({
        hijack: true,
        stdin: true
      });
      
      // Enviar salida al cliente
      containerStream.on('data', (data) => {
        socket.emit('container-output', data.toString());
      });
      
      containerStream.on('end', () => {
        socket.emit('container-end');
      });
      
    } catch (error) {
      socket.emit('container-error', { message: error.message });
    }
  });
  
  socket.on('subscribe-logs', async (containerName) => {
    try {
      const container = docker.getContainer(containerName);
      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        timestamps: true
      });
      
      stream.on('data', (chunk) => {
        socket.emit('log-data', {
          container: containerName,
          data: chunk.toString(),
          timestamp: new Date().toISOString()
        });
      });
      
      stream.on('end', () => {
        socket.emit('log-end', { container: containerName });
      });
      
      socket.on('disconnect', () => {
        stream.destroy();
        logger.info(`Cliente desconectado, deteniendo logs para ${containerName}`);
      });
    } catch (error) {
      socket.emit('log-error', { 
        container: containerName, 
        error: error.message 
      });
    }
  });
  
  socket.on('get-metrics', async () => {
    try {
      const containers = await docker.listContainers();
      const metrics = [];
      
      for (const containerInfo of containers) {
        if (containerInfo.Names.some(name => name.includes('gelymar-platform'))) {
          const container = docker.getContainer(containerInfo.Id);
          const stats = await container.stats({ stream: false });
          
          const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
          const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
          const cpuPercent = (cpuDelta / systemDelta) * 100;
          
          const memoryUsage = stats.memory_stats.usage;
          const memoryLimit = stats.memory_stats.limit;
          const memoryPercent = (memoryUsage / memoryLimit) * 100;
          
          metrics.push({
            name: containerInfo.Names[0].replace('/', ''),
            cpu: Math.round(cpuPercent * 100) / 100,
            memory: Math.round(memoryPercent * 100) / 100,
            memoryUsage: Math.round(memoryUsage / 1024 / 1024), // MB
            memoryLimit: Math.round(memoryLimit / 1024 / 1024), // MB
            status: containerInfo.State,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      socket.emit('metrics-data', metrics);
    } catch (error) {
      socket.emit('metrics-error', { error: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    // Limpiar conexión SSH si existe
    if (sshStream) {
      sshStream.close();
    }
    if (sshConn) {
      sshConn.end();
    }
    logger.info('Cliente desconectado');
  });
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Config Manager iniciado en puerto ${PORT}`);
  logger.info(`📁 Proyecto: ${process.env.PROJECT_PATH}`);
  logger.info(`🐳 Docker Compose: ${process.env.DOCKER_COMPOSE_FILE}`);
  logger.info(`🔌 WebSocket habilitado para logs en tiempo real`);
});

// Manejo de señales para cierre graceful
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT recibido, cerrando servidor...');
  process.exit(0);
});

module.exports = app;
