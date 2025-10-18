const express = require('express');
const router = express.Router();
const ConfigManager = require('../config/manager');
const DockerManager = require('../config/docker');
const { requireAuth } = require('../middleware/auth');
const Docker = require('dockerode');

const configManager = new ConfigManager();
const dockerManager = new DockerManager();
const docker = new Docker();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Middleware de logging
router.use((req, res, next) => {
  next();
});

// Obtener configuración actual
router.get('/config/current', async (req, res) => {
  try {
    const environment = req.query.environment || 'prod';
    const config = await configManager.getCurrentConfig(environment);
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('❌ API: Error obteniendo configuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo configuración actual',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtener contenido del archivo .env
router.get('/config/file', async (req, res) => {
  try {
    const environment = req.query.environment || 'prod';
    const content = await configManager.getFileContent(environment);
    res.json({
      success: true,
      content: content
    });
  } catch (error) {
    console.error('❌ API: Error obteniendo contenido del archivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo contenido del archivo',
      error: error.message
    });
  }
});

// Actualizar configuración general
router.post('/config/update', async (req, res) => {
  try {
    const { 
      // Red y URLs
      HOST_IP, DOMAIN, FRONTEND_BASE_URL, PUBLIC_API_URL, PUBLIC_FILE_SERVER_URL,
      PUBLIC_API_BASE_URL, PUBLIC_FRONTEND_BASE_URL, SERVER_API_URL, SITE,
      BACKEND_BASE_URL, BACKEND_API_URL,
      // Base de Datos
      DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS,
      // Servidor
      PORT, NODE_ENV, DOCKER_ENV,
      // Autenticación
      JWT_SECRET,
      // File Server
      FILE_SERVER_URL, FILE_SERVER_ROOT,
      // Red Compartida
      NETWORK_SERVER, NETWORK_SHARE_PATH, NETWORK_USER, NETWORK_PASSWORD,
      // Email
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, RESEND_KEY,
      // Rate Limiting
      RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, SLOW_DOWN_DELAY_AFTER, SLOW_DOWN_DELAY_MS,
      // Frontend
      PUBLIC_LANG, BASE_URL, REMOTE_ASSETS_BASE_URL, CI,
      // Usuarios del Sistema
      TERMINAL_USER, TERMINAL_PASS, FILESERVER_USER, FILESERVER_PASS,
      environment
    } = req.body;
    
    
    // Actualizar el archivo .env
    await configManager.updateConfig({ 
      // Red y URLs
      HOST_IP, DOMAIN, FRONTEND_BASE_URL, PUBLIC_API_URL, PUBLIC_FILE_SERVER_URL,
      PUBLIC_API_BASE_URL, PUBLIC_FRONTEND_BASE_URL, SERVER_API_URL, SITE,
      BACKEND_BASE_URL, BACKEND_API_URL,
      // Base de Datos
      DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS,
      // Servidor
      PORT, NODE_ENV, DOCKER_ENV,
      // Autenticación
      JWT_SECRET,
      // File Server
      FILE_SERVER_URL, FILE_SERVER_ROOT,
      // Red Compartida
      NETWORK_SERVER, NETWORK_SHARE_PATH, NETWORK_USER, NETWORK_PASSWORD,
      // Email
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, RESEND_KEY,
      // Rate Limiting
      RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, SLOW_DOWN_DELAY_AFTER, SLOW_DOWN_DELAY_MS,
      // Frontend
      PUBLIC_LANG, BASE_URL, REMOTE_ASSETS_BASE_URL, CI,
      // Usuarios del Sistema
      TERMINAL_USER, TERMINAL_PASS, FILESERVER_USER, FILESERVER_PASS,
      environment
    });
    
    res.json({
      success: true,
      message: `Configuración ${environment} actualizada exitosamente`
    });
  } catch (error) {
    console.error('❌ API: Error actualizando configuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando configuración',
      error: error.message
    });
  }
});

// Actualizar IP del servidor
router.post('/config/ip', async (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP es requerida'
      });
    }

    // Validar formato de IP
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de IP inválido'
      });
    }

    const result = await configManager.updateIP(ip);
    
    res.json({
      success: true,
      message: `IP actualizada a ${ip}`,
      data: result
    });
  } catch (error) {
    console.error('Error actualizando IP:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando IP',
      error: error.message
    });
  }
});

// Agregar dominio
router.post('/config/domain', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Dominio es requerido'
      });
    }

    const result = await configManager.addDomain(domain);
    
    res.json({
      success: true,
      message: `Dominio ${domain} agregado`,
      data: result
    });
  } catch (error) {
    console.error('Error agregando dominio:', error);
    res.status(500).json({
      success: false,
      message: 'Error agregando dominio',
      error: error.message
    });
  }
});

// Cambiar protocolo (HTTP/HTTPS)
router.post('/config/protocol', async (req, res) => {
  try {
    const { protocol } = req.body;
    
    if (!protocol || !['http', 'https'].includes(protocol)) {
      return res.status(400).json({
        success: false,
        message: 'Protocolo debe ser http o https'
      });
    }

    const result = await configManager.switchProtocol(protocol);
    
    res.json({
      success: true,
      message: `Protocolo cambiado a ${protocol.toUpperCase()}`,
      data: result
    });
  } catch (error) {
    console.error('Error cambiando protocolo:', error);
    res.status(500).json({
      success: false,
      message: 'Error cambiando protocolo',
      error: error.message
    });
  }
});

// Reiniciar servicios
router.post('/services/restart', async (req, res) => {
  try {
    const { services } = req.body;
    
    const result = await dockerManager.restartServices(services);
    
    res.json({
      success: true,
      message: 'Servicios reiniciados',
      data: result
    });
  } catch (error) {
    console.error('Error reiniciando servicios:', error);
    res.status(500).json({
      success: false,
      message: 'Error reiniciando servicios',
      error: error.message
    });
  }
});

// Obtener estado de servicios
router.get('/services/status', async (req, res) => {
  try {
    const status = await dockerManager.getServicesStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ API: Error obteniendo estado de servicios:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estado de servicios',
      error: error.message
    });
  }
});

// Hacer backup de configuración
router.post('/config/backup', async (req, res) => {
  try {
    const result = await configManager.createBackup();
    
    res.json({
      success: true,
      message: 'Backup creado exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error creando backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando backup',
      error: error.message
    });
  }
});

// Restaurar configuración desde backup
router.post('/config/restore', async (req, res) => {
  try {
    const { backupId } = req.body;
    
    if (!backupId) {
      return res.status(400).json({
        success: false,
        message: 'ID de backup es requerido'
      });
    }

    const result = await configManager.restoreFromBackup(backupId);
    
    res.json({
      success: true,
      message: 'Configuración restaurada exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error restaurando configuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error restaurando configuración',
      error: error.message
    });
  }
});

// Listar backups disponibles
router.get('/config/backups', async (req, res) => {
  try {
    const backups = await configManager.listBackups();
    
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('Error listando backups:', error);
    res.status(500).json({
      success: false,
      message: 'Error listando backups',
      error: error.message
    });
  }
});

// Obtener lista de contenedores
router.get('/containers/list', async (req, res) => {
  try {
    const containers = await dockerManager.getContainersList();
    res.json({
      success: true,
      data: containers
    });
  } catch (error) {
    console.error('❌ API: Error obteniendo lista de contenedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo lista de contenedores',
      error: error.message
    });
  }
});

// Acción individual en contenedor
router.post('/containers/action', async (req, res) => {
  try {
    const { action, containerName } = req.body;
    
    const result = await dockerManager.containerAction(action, containerName);
    
    res.json({
      success: true,
      message: `${action} ${containerName} ejecutado exitosamente`,
      data: result
    });
  } catch (error) {
    console.error('❌ API: Error ejecutando acción en contenedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando acción en contenedor',
      error: error.message
    });
  }
});

// Acción global en contenedores
router.post('/containers/global-action', async (req, res) => {
  try {
    const { action, config } = req.body;
    
    const result = await dockerManager.globalContainerAction(action, config);
    
    res.json({
      success: true,
      message: `${action} global ejecutado exitosamente`,
      data: result
    });
  } catch (error) {
    console.error('❌ API: Error ejecutando acción global:', error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando acción global',
      error: error.message
    });
  }
});

// Probar conexión a base de datos
router.post('/test/database', async (req, res) => {
  try {
    const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, environment } = req.body;
    
    
    // Crear conexión de prueba
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: DB_HOST,
      port: parseInt(DB_PORT),
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      connectTimeout: 5000
    });
    
    // Probar la conexión
    await connection.execute('SELECT 1 as test');
    await connection.end();
    
    
    res.json({
      success: true,
      message: `Conexión a base de datos ${environment} exitosa`,
      details: {
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER
      }
    });
  } catch (error) {
    console.error('❌ API: Error probando conexión a base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error de conexión a base de datos',
      error: error.message
    });
  }
});

// Probar configuración de email
router.post('/test/email', async (req, res) => {
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, environment } = req.body;
    
    
    // Crear transporter de nodemailer
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT),
      secure: parseInt(SMTP_PORT) === 465, // true para 465, false para otros puertos
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    // Verificar la conexión
    await transporter.verify();
    
    
    res.json({
      success: true,
      message: `Configuración de email ${environment} exitosa`,
      details: {
        host: SMTP_HOST,
        port: SMTP_PORT,
        user: SMTP_USER
      }
    });
  } catch (error) {
    console.error('❌ API: Error probando configuración de email:', error);
    res.status(500).json({
      success: false,
      message: 'Error de configuración de email',
      error: error.message
    });
  }
});

// ===== NUEVAS RUTAS PARA FUNCIONALIDADES AVANZADAS =====

// Obtener métricas de contenedores
router.get('/metrics/containers', async (req, res) => {
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
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('❌ API: Error obteniendo métricas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo métricas de contenedores',
      error: error.message
    });
  }
});

// Obtener logs de un contenedor específico
router.get('/logs/:containerName', async (req, res) => {
  try {
    const { containerName } = req.params;
    const { lines = 100, since } = req.query;
    
    const container = docker.getContainer(containerName);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      timestamps: true,
      tail: lines,
      since: since
    });
    
    res.json({
      success: true,
      data: {
        container: containerName,
        logs: logs.toString(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ API: Error obteniendo logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo logs del contenedor',
      error: error.message
    });
  }
});

// Obtener lista de volúmenes Docker
router.get('/volumes', async (req, res) => {
  try {
    const volumes = await docker.listVolumes();
    const gelymarVolumes = volumes.Volumes.filter(volume => 
      volume.Name.includes('gelymar') || volume.Name.includes('gelymar-platform')
    );
    
    res.json({
      success: true,
      data: gelymarVolumes
    });
  } catch (error) {
    console.error('❌ API: Error obteniendo volúmenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo volúmenes',
      error: error.message
    });
  }
});

// Crear nuevo volumen
router.post('/volumes/create', async (req, res) => {
  try {
    const { name, driver = 'local', driverOpts = {} } = req.body;
    
    const volume = await docker.createVolume({
      Name: name,
      Driver: driver,
      DriverOpts: driverOpts
    });
    
    res.json({
      success: true,
      data: volume,
      message: `Volumen ${name} creado exitosamente`
    });
  } catch (error) {
    console.error('❌ API: Error creando volumen:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando volumen',
      error: error.message
    });
  }
});

// Eliminar volumen
router.delete('/volumes/:volumeName', async (req, res) => {
  try {
    const { volumeName } = req.params;
    const volume = docker.getVolume(volumeName);
    await volume.remove();
    
    res.json({
      success: true,
      message: `Volumen ${volumeName} eliminado exitosamente`
    });
  } catch (error) {
    console.error('❌ API: Error eliminando volumen:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando volumen',
      error: error.message
    });
  }
});

// Obtener información del sistema Docker
router.get('/system/info', async (req, res) => {
  try {
    const info = await docker.info();
    const version = await docker.version();
    
    res.json({
      success: true,
      data: {
        info: info,
        version: version,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ API: Error obteniendo información del sistema:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información del sistema',
      error: error.message
    });
  }
});

// Limpiar recursos Docker (contenedores parados, imágenes no utilizadas, etc.)
router.post('/system/cleanup', async (req, res) => {
  try {
    const { type = 'all' } = req.body;
    const results = {};
    
    if (type === 'all' || type === 'containers') {
      // Eliminar contenedores parados
      const containers = await docker.listContainers({ all: true });
      const stoppedContainers = containers.filter(c => c.State === 'exited');
      
      for (const container of stoppedContainers) {
        if (container.Names.some(name => name.includes('gelymar-platform'))) {
          const containerObj = docker.getContainer(container.Id);
          await containerObj.remove();
        }
      }
      
      results.containers = stoppedContainers.length;
    }
    
    if (type === 'all' || type === 'images') {
      // Eliminar imágenes no utilizadas
      const images = await docker.listImages({ dangling: true });
      for (const image of images) {
        if (image.RepoTags && image.RepoTags.some(tag => tag.includes('gelymar-platform'))) {
          await docker.getImage(image.Id).remove();
        }
      }
      
      results.images = images.length;
    }
    
    if (type === 'all' || type === 'volumes') {
      // Eliminar volúmenes no utilizados
      const volumes = await docker.listVolumes();
      const unusedVolumes = volumes.Volumes.filter(volume => 
        volume.Name.includes('gelymar') && !volume.Mountpoint
      );
      
      for (const volume of unusedVolumes) {
        const volumeObj = docker.getVolume(volume.Name);
        await volumeObj.remove();
      }
      
      results.volumes = unusedVolumes.length;
    }
    
    res.json({
      success: true,
      data: results,
      message: 'Limpieza completada exitosamente'
    });
  } catch (error) {
    console.error('❌ API: Error en limpieza del sistema:', error);
    res.status(500).json({
      success: false,
      message: 'Error en limpieza del sistema',
      error: error.message
    });
  }
});

// Obtener redes Docker
router.get('/networks', async (req, res) => {
  try {
    const networks = await docker.listNetworks();
    const gelymarNetworks = networks.filter(network => 
      network.Name.includes('gelymar') || network.Name.includes('gelymar-platform')
    );
    
    res.json({
      success: true,
      data: gelymarNetworks
    });
  } catch (error) {
    console.error('❌ API: Error obteniendo redes:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo redes',
      error: error.message
    });
  }
});

// Crear nueva red
router.post('/networks/create', async (req, res) => {
  try {
    const { name, driver = 'bridge', subnet, gateway } = req.body;
    
    const networkConfig = {
      Name: name,
      Driver: driver
    };
    
    if (subnet && gateway) {
      networkConfig.IPAM = {
        Config: [{
          Subnet: subnet,
          Gateway: gateway
        }]
      };
    }
    
    const network = await docker.createNetwork(networkConfig);
    
    res.json({
      success: true,
      data: network,
      message: `Red ${name} creada exitosamente`
    });
  } catch (error) {
    console.error('❌ API: Error creando red:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando red',
      error: error.message
    });
  }
});

// Eliminar red
router.delete('/networks/:networkId', async (req, res) => {
  try {
    const { networkId } = req.params;
    const network = docker.getNetwork(networkId);
    await network.remove();
    
    res.json({
      success: true,
      message: `Red ${networkId} eliminada exitosamente`
    });
  } catch (error) {
    console.error('❌ API: Error eliminando red:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando red',
      error: error.message
    });
  }
});

// ===== RUTAS PARA GESTIÓN DE CONTEXTOS DOCKER =====

// Obtener contexto actual
router.get('/docker/context/current', async (req, res) => {
  try {
    const currentContext = dockerManager.getCurrentContext();
    res.json({
      success: true,
      data: {
        current: currentContext
      }
    });
  } catch (error) {
    console.error('Error obteniendo contexto actual:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo contexto actual',
      error: error.message
    });
  }
});

// Listar contextos disponibles
router.get('/docker/context/list', async (req, res) => {
  try {
    const contexts = dockerManager.listContexts();
    res.json({
      success: true,
      data: contexts
    });
  } catch (error) {
    console.error('Error listando contextos:', error);
    res.status(500).json({
      success: false,
      message: 'Error listando contextos',
      error: error.message
    });
  }
});

// Cambiar contexto
router.post('/docker/context/switch', async (req, res) => {
  try {
    const { context } = req.body;
    
    if (!context) {
      return res.status(400).json({
        success: false,
        message: 'Contexto requerido'
      });
    }

    const success = dockerManager.switchContext(context);
    
    if (success) {
      res.json({
        success: true,
        message: `Contexto cambiado a: ${context}`,
        data: {
          current: context
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error cambiando contexto'
      });
    }
  } catch (error) {
    console.error('Error cambiando contexto:', error);
    res.status(500).json({
      success: false,
      message: 'Error cambiando contexto',
      error: error.message
    });
  }
});

// Probar conexión SSH
router.post('/docker/context/test-ssh', async (req, res) => {
  try {
    const { user, serverIp, sshPort = 22 } = req.body;
    
    if (!user || !serverIp) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y IP del servidor requeridos'
      });
    }

    const success = dockerManager.testSSHConnection(user, serverIp, sshPort);
    
    if (success) {
      res.json({
        success: true,
        message: 'Conexión SSH exitosa',
        data: {
          user,
          serverIp,
          sshPort
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error en conexión SSH'
      });
    }
  } catch (error) {
    console.error('Error probando conexión SSH:', error);
    res.status(500).json({
      success: false,
      message: 'Error probando conexión SSH',
      error: error.message
    });
  }
});

// Crear contexto remoto
router.post('/docker/context/create-remote', async (req, res) => {
  try {
    const { user, serverIp, sshPort = 22 } = req.body;
    
    if (!user || !serverIp) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y IP del servidor requeridos'
      });
    }

    const success = dockerManager.createRemoteContext(user, serverIp, sshPort);
    
    if (success) {
      res.json({
        success: true,
        message: 'Contexto remoto creado exitosamente',
        data: {
          context: 'remote-server',
          user,
          serverIp,
          sshPort
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error creando contexto remoto'
      });
    }
  } catch (error) {
    console.error('Error creando contexto remoto:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando contexto remoto',
      error: error.message
    });
  }
});

// Endpoint para ejecutar comandos en contenedores
router.post('/containers/exec', async (req, res) => {
  try {
    const { containerName, command } = req.body;
    
    if (!containerName || !command) {
      return res.status(400).json({
        success: false,
        message: 'containerName y command son requeridos'
      });
    }

    // Usar execSync para ejecutar el comando en el contenedor
    try {
      // Verificar que el contenedor existe y está corriendo
      const checkOutput = execSync(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, { 
        encoding: 'utf8',
        stdio: 'pipe',
        env: {
          ...process.env,
          SSH_PASSWORD: 'Lug4R0j4.2025.'
        }
      });
      
      if (!checkOutput.trim()) {
        return res.status(404).json({
          success: false,
          message: `Contenedor '${containerName}' no encontrado o no está corriendo`
        });
      }

      // Ejecutar el comando en el contenedor
      const execCommand = `docker exec -it ${containerName} ${command}`;
      const output = execSync(execCommand, { 
        encoding: 'utf8',
        stdio: 'pipe',
        env: {
          ...process.env,
          SSH_PASSWORD: 'Lug4R0j4.2025.'
        }
      });

      res.json({
        success: true,
        message: 'Comando ejecutado exitosamente',
        output: output
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error ejecutando comando en contenedor',
        error: error.message
      });
    }

  } catch (error) {
    console.error('Error ejecutando comando en contenedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando comando en contenedor',
      error: error.message
    });
  }
});


module.exports = router;
