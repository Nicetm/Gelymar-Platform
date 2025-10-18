const Docker = require('dockerode');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DockerManager {
  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
    this.currentContext = 'default'; // Contexto actual (default = local, remote-server = remoto)
    // Las rutas ahora son completamente configurables, no hay valores por defecto hardcodeados
  }

  /**
   * Cambiar contexto Docker (local o remoto)
   */
  switchContext(context) {
    try {
      execSync(`docker context use ${context}`, { stdio: 'pipe' });
      this.currentContext = context;
      return true;
    } catch (error) {
      console.error(`❌ Error cambiando contexto a ${context}:`, error.message);
      return false;
    }
  }

  /**
   * Probar conexión SSH básica
   */
  testSSHConnection(user, serverIp, sshPort = 22) {
    try {
      // Probar conexión SSH básica usando sshpass directamente
      const sshTest = execSync(`sshpass -p 'Lug4R0j4.2025.' ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${user}@${serverIp} -p ${sshPort} "echo 'SSH connection successful'"`, { 
        stdio: 'pipe',
        timeout: 15000
      });
      
      return true;
    } catch (error) {
      console.error(`❌ Error en conexión SSH:`, error.message);
      console.error(`❌ Error completo:`, error);
      
      // Intentar con más verbosidad para diagnosticar
      try {
        const verboseTest = execSync(`ssh -v -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${user}@${serverIp} -p ${sshPort} "echo 'SSH connection successful'"`, { 
          stdio: 'pipe',
          timeout: 15000
        });
        return true;
      } catch (verboseError) {
        console.error(`❌ Error en conexión SSH con verbosidad:`, verboseError.message);
        return false;
      }
    }
  }


  /**
   * Crear contexto Docker remoto
   */
  createRemoteContext(user, serverIp, sshPort = 22) {
    try {
      const contextName = 'remote-server';
      
      // Verificar si el contexto ya existe
      try {
        execSync(`docker context inspect ${contextName}`, { stdio: 'pipe' });
        return true;
      } catch (e) {
        // El contexto no existe, crearlo
      }

      // Crear un script SSH personalizado que use sshpass
      const sshScriptPath = '/tmp/ssh-with-password.sh';
      const sshScript = `#!/bin/bash
sshpass -p 'Lug4R0j4.2025' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=QUIET "$@"
`;
      
      // Escribir el script
      require('fs').writeFileSync(sshScriptPath, sshScript);
      execSync(`chmod +x ${sshScriptPath}`, { stdio: 'pipe' });
      
      // Crear el contexto con el script SSH personalizado
      execSync(`docker context create ${contextName} --docker "host=ssh://${user}@${serverIp}:${sshPort}"`, { 
        stdio: 'pipe',
        env: {
          ...process.env,
          DOCKER_HOST: `ssh://${user}@${serverIp}:${sshPort}`,
          SSH_PASSWORD: 'Lug4R0j4.2025.',
          SSH_COMMAND: sshScriptPath
        }
      });
      return true;
    } catch (error) {
      console.error(`❌ Error creando contexto remoto:`, error.message);
      return false;
    }
  }

  /**
   * Obtener contexto actual
   */
  getCurrentContext() {
    try {
      const output = execSync('docker context show', { encoding: 'utf8' });
      this.currentContext = output.trim();
      return this.currentContext;
    } catch (error) {
      console.error('❌ Error obteniendo contexto actual:', error.message);
      return 'default';
    }
  }

  /**
   * Listar contextos disponibles
   */
  listContexts() {
    try {
      const output = execSync('docker context ls --format "{{.Name}}\t{{.DockerEndpoint}}\t{{.Current}}"', { encoding: 'utf8' });
      const contexts = output.trim().split('\n').map(line => {
        const [name, endpoint, current] = line.split('\t');
        return { name, endpoint, current: current === '*' };
      });
      return contexts;
    } catch (error) {
      console.error('❌ Error listando contextos:', error.message);
      return [];
    }
  }

  /**
   * Leer y parsear archivo .env
   */
  readEnvFile(envFilePath) {
    try {
      
      if (!fs.existsSync(envFilePath)) {
        console.warn(`⚠️ Archivo .env no encontrado: ${envFilePath}`);
        return {};
      }

      const envContent = fs.readFileSync(envFilePath, 'utf8');
      const envVars = {};
      
      const lines = envContent.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim();
          }
        }
      }
      
      return envVars;
    } catch (error) {
      console.error(`❌ Error leyendo archivo .env: ${error.message}`);
      return {};
    }
  }

  /**
   * Obtener estado de todos los servicios
   */
  async getServicesStatus() {
    try {
      const containers = await this.docker.listContainers({ all: true });
      
      const gelymarContainers = containers.filter(container => 
        container.Names.some(name => name.includes('gelymar-platform'))
      );

      const status = {};
      
      for (const container of gelymarContainers) {
        const name = container.Names[0].replace('/', '');
        const serviceName = name.replace('gelymar-platform-', '');
        
        status[serviceName] = {
          id: container.Id,
          name: name,
          status: container.State,
          image: container.Image,
          ports: container.Ports,
          created: new Date(container.Created * 1000).toISOString(),
          uptime: this.calculateUptime(container.Status)
        };
      }

      return status;
    } catch (error) {
      throw new Error(`Error obteniendo estado de servicios: ${error.message}`);
    }
  }

  /**
   * Reiniciar servicios específicos o todos
   */
  async restartServices(services = null) {
    try {
      const results = [];
      
      if (services && Array.isArray(services)) {
        // Reiniciar servicios específicos
        for (const serviceName of services) {
          const result = await this.restartService(serviceName);
          results.push(result);
        }
      } else {
        // Reiniciar todos los servicios usando docker-compose
        const result = await this.restartAllServices();
        results.push(result);
      }
      
      return {
        restarted: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error reiniciando servicios: ${error.message}`);
    }
  }

  /**
   * Reiniciar un servicio específico
   */
  async restartService(serviceName) {
    try {
      const containerName = `gelymar-platform-${serviceName}`;
      
      // Buscar contenedor
      const containers = await this.docker.listContainers({ all: true });
      const container = containers.find(c => 
        c.Names.some(name => name.includes(containerName))
      );

      if (!container) {
        throw new Error(`Contenedor ${containerName} no encontrado`);
      }

      // Reiniciar contenedor
      const dockerContainer = this.docker.getContainer(container.Id);
      await dockerContainer.restart();

      return {
        service: serviceName,
        containerId: container.Id,
        status: 'restarted',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error reiniciando servicio ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Reiniciar todos los servicios usando docker-compose
   */
  async restartAllServices(config = {}) {
    try {
      // Usar configuración personalizada o valores por defecto
      const projectPath = config.PROJECT_PATH || '/app/docker';
      const composeFile = config.DOCKER_COMPOSE_FILE || 'docker-compose-dev.yml';
      const dockerCommand = config.DOCKER_COMMAND || 'docker-compose';
      
      // Cambiar al directorio del proyecto
      process.chdir(projectPath);
      
      // Ejecutar docker compose restart
      const command = `${dockerCommand} -f ${composeFile} restart`;
      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: projectPath,
        timeout: 60000 // 60 segundos timeout
      });

      return {
        action: 'restart_all',
        output: output,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error reiniciando todos los servicios: ${error.message}`);
    }
  }

  /**
   * Detener servicios
   */
  async stopServices(services = null) {
    try {
      const results = [];
      
      if (services && Array.isArray(services)) {
        // Detener servicios específicos
        for (const serviceName of services) {
          const result = await this.stopService(serviceName);
          results.push(result);
        }
      } else {
        // Detener todos los servicios
        const result = await this.stopAllServices();
        results.push(result);
      }

      return {
        stopped: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error deteniendo servicios: ${error.message}`);
    }
  }

  /**
   * Iniciar servicios
   */
  async startServices(services = null) {
    try {
      const results = [];
      
      if (services && Array.isArray(services)) {
        // Iniciar servicios específicos
        for (const serviceName of services) {
          const result = await this.startService(serviceName);
          results.push(result);
        }
      } else {
        // Iniciar todos los servicios
        const result = await this.startAllServices();
        results.push(result);
      }

      return {
        started: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error iniciando servicios: ${error.message}`);
    }
  }

  /**
   * Obtener logs de un servicio
   */
  async getServiceLogs(serviceName, lines = 100) {
    try {
      const containerName = `gelymar-platform-${serviceName}`;
      
      // Buscar contenedor
      const containers = await this.docker.listContainers({ all: true });
      const container = containers.find(c => 
        c.Names.some(name => name.includes(containerName))
      );

      if (!container) {
        throw new Error(`Contenedor ${containerName} no encontrado`);
      }

      // Obtener logs
      const dockerContainer = this.docker.getContainer(container.Id);
      const logs = await dockerContainer.logs({
        stdout: true,
        stderr: true,
        tail: lines,
        timestamps: true
      });

      return {
        service: serviceName,
        logs: logs.toString(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error obteniendo logs de ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Verificar salud de los servicios
   */
  async checkServicesHealth() {
    try {
      const status = await this.getServicesStatus();
      const health = {};
      
      for (const [serviceName, serviceInfo] of Object.entries(status)) {
        health[serviceName] = {
          status: serviceInfo.status,
          healthy: serviceInfo.status === 'running',
          uptime: serviceInfo.uptime,
          ports: serviceInfo.ports
        };
      }

      const healthyServices = Object.values(health).filter(h => h.healthy).length;
      const totalServices = Object.keys(health).length;

      return {
        overall: {
          healthy: healthyServices,
          total: totalServices,
          percentage: Math.round((healthyServices / totalServices) * 100)
        },
        services: health,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error verificando salud de servicios: ${error.message}`);
    }
  }

  // Métodos auxiliares

  async stopService(serviceName) {
    const containerName = `gelymar-platform-${serviceName}`;
    const containers = await this.docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Names.some(name => name.includes(containerName))
    );

    if (!container) {
      throw new Error(`Contenedor ${containerName} no encontrado`);
    }

    const dockerContainer = this.docker.getContainer(container.Id);
    await dockerContainer.stop();

    return {
      service: serviceName,
      containerId: container.Id,
      status: 'stopped',
      timestamp: new Date().toISOString()
    };
  }

  async startService(serviceName) {
    const containerName = `gelymar-platform-${serviceName}`;
    const containers = await this.docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Names.some(name => name.includes(containerName))
    );

    if (!container) {
      throw new Error(`Contenedor ${containerName} no encontrado`);
    }

    const dockerContainer = this.docker.getContainer(container.Id);
    await dockerContainer.start();

    return {
      service: serviceName,
      containerId: container.Id,
      status: 'started',
      timestamp: new Date().toISOString()
    };
  }

  async stopAllServices(config = {}) {
    const isProduction = process.env.NODE_ENV === 'production';
    const projectPath = config.PROJECT_PATH || (isProduction ? '/home/administrator/gelymar-platform' : '/app/project');
    const composeFile = config.DOCKER_COMPOSE_FILE || (isProduction ? 'docker-compose-prod.yml' : 'docker/docker-compose-dev.yml');
    const dockerCommand = config.DOCKER_COMMAND || (isProduction ? 'docker compose' : 'docker-compose');
    
    process.chdir(projectPath);
    const command = `${dockerCommand} -f ${composeFile} stop`;
    const output = execSync(command, { 
      encoding: 'utf8',
      cwd: projectPath,
      timeout: 60000
    });

    return {
      action: 'stop_all',
      output: output,
      timestamp: new Date().toISOString()
    };
  }

  async startAllServices(config = {}) {
    const isProduction = process.env.NODE_ENV === 'production';
    const projectPath = config.PROJECT_PATH || (isProduction ? '/home/administrator/gelymar-platform' : '/app/project');
    const composeFile = config.DOCKER_COMPOSE_FILE || (isProduction ? 'docker-compose-prod.yml' : 'docker/docker-compose-dev.yml');
    const dockerCommand = config.DOCKER_COMMAND || (isProduction ? 'docker compose' : 'docker-compose');
    
    process.chdir(projectPath);
    const command = `${dockerCommand} -f ${composeFile} up -d`;
    const output = execSync(command, { 
      encoding: 'utf8',
      cwd: projectPath,
      timeout: 120000 // 2 minutos timeout
    });

    return {
      action: 'start_all',
      output: output,
      timestamp: new Date().toISOString()
    };
  }

  calculateUptime(statusString) {
    // Extraer tiempo de uptime del status string de Docker
    // Ejemplo: "Up 2 hours" o "Exited (0) 2 hours ago"
    const match = statusString.match(/Up\s+([^,]+)/);
    if (match) {
      return match[1];
    }
    return 'N/A';
  }

  /**
   * Obtener lista de contenedores para la interfaz
   */
  async getContainersList() {
    try {
      // Usar execSync para respetar el contexto Docker actual
      const output = execSync('docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}"', { 
        encoding: 'utf8',
        stdio: 'pipe',
        env: {
          ...process.env,
          SSH_PASSWORD: 'Lug4R0j4.2025.'
        }
      });

      const lines = output.trim().split('\n').filter(line => line.trim());
      const containers = [];

      for (const line of lines) {
        const [id, names, image, status, ports, createdAt] = line.split('\t');
        
        // Filtrar solo contenedores de Gelymar
        if (names && names.includes('gelymar-platform')) {
          containers.push({
            id: id,
            name: names.replace('/', ''),
            image: image,
            status: status.includes('Up') ? 'running' : 'stopped',
            ports: ports || 'N/A',
            created: createdAt,
            uptime: this.calculateUptime(status)
          });
        }
      }

      return containers;
    } catch (error) {
      throw new Error(`Error obteniendo lista de contenedores: ${error.message}`);
    }
  }

  /**
   * Acción individual en contenedor
   */
  async containerAction(action, containerName) {
    try {
      // Usar execSync para respetar el contexto Docker actual
      let command;
      
      switch (action) {
        case 'restart':
          command = `docker restart ${containerName}`;
          break;
        case 'stop':
          command = `docker stop ${containerName}`;
          break;
        case 'start':
          command = `docker start ${containerName}`;
          break;
        case 'rebuild':
          // Para rebuild necesitamos usar docker-compose
          return await this.rebuildContainer(containerName);
        default:
          throw new Error(`Acción ${action} no soportada`);
      }

      try {
        execSync(command, { 
          stdio: 'pipe',
          env: {
            ...process.env,
            SSH_PASSWORD: 'Lug4R0j4.2025.'
          }
        });
      } catch (execError) {
        // Manejar errores específicos de Docker
        if (execError.message.includes('already started') || execError.message.includes('304')) {
          return {
            containerName,
            action,
            status: 'already_started',
            message: 'El contenedor ya estaba iniciado',
            timestamp: new Date().toISOString()
          };
        }
        if (execError.message.includes('already stopped') || execError.message.includes('not running')) {
          return {
            containerName,
            action,
            status: 'already_stopped',
            message: 'El contenedor ya estaba detenido',
            timestamp: new Date().toISOString()
          };
        }
        throw execError;
      }

      return {
        containerName,
        action,
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error ejecutando ${action} en ${containerName}: ${error.message}`);
    }
  }

  /**
   * Acción global en contenedores
   */
  async globalContainerAction(action, config = {}) {
    try {
      // Detectar entorno
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Usar configuración personalizada o valores por defecto según entorno
      const projectPath = config.PROJECT_PATH || (isProduction ? '/home/administrator/gelymar-platform' : '/app/project');
      const composeFile = config.DOCKER_COMPOSE_FILE || (isProduction ? 'docker-compose-prod.yml' : 'docker/docker-compose-dev.yml');
      const envFile = config.ENV_FILE || (isProduction ? '.env.production' : 'docker/.env.local');
      const dockerCommand = config.DOCKER_COMMAND || (isProduction ? 'docker compose' : 'docker-compose');
      
      process.chdir(projectPath);
      
      // Leer variables del archivo .env
      const envVars = this.readEnvFile(envFile);
      let command;
      switch (action) {
        case 'restart':
          command = `${dockerCommand} -f ${composeFile} --env-file ${envFile} restart`;
          break;
        case 'stop':
          command = `${dockerCommand} -f ${composeFile} --env-file ${envFile} stop`;
          break;
        case 'start':
          command = `${dockerCommand} -f ${composeFile} --env-file ${envFile} up -d fileserver backend frontend cron phpmyadmin terminal`;
          break;
        case 'rebuild':
          command = `${dockerCommand} -f ${composeFile} --env-file ${envFile} up -d --build fileserver backend frontend cron phpmyadmin terminal`;
          break;
        default:
          throw new Error(`Acción global ${action} no soportada`);
      }

      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: projectPath,
        timeout: 600000, // 10 minutos timeout
        stdio: 'pipe', // Capturar output
        env: {
          ...process.env,
          // Variables del archivo .env (estas son las importantes)
          ...envVars,
          // Variables del Config Manager (para compatibilidad)
          ENV_FILE: process.env.ENV_FILE,
          DB_HOST: process.env.DB_HOST,
          DB_PORT: process.env.DB_PORT,
          DB_NAME: process.env.DB_NAME,
          DB_USER: process.env.DB_USER,
          DB_PASSWORD: process.env.DB_PASSWORD,
          SESSION_SECRET: process.env.SESSION_SECRET
        }
      });

      return {
        action: `${action}_all`,
        output: output,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error ejecutando acción global: ${action}`);
      console.error(`Error details: ${error.message}`);
      throw new Error(`Error ejecutando ${action} global: ${error.message}`);
    }
  }

  /**
   * Reconstruir un contenedor específico
   */
  async rebuildContainer(containerName, config = {}) {
    try {
      const projectPath = config.PROJECT_PATH || '/docker';
      const composeFile = config.DOCKER_COMPOSE_FILE || 'docker-compose-dev.yml';
      const dockerCommand = config.DOCKER_COMMAND || 'docker-compose';
      
      process.chdir(projectPath);
      
      // Extraer el nombre del servicio del nombre del contenedor
      const serviceName = containerName.replace('gelymar-platform-', '');
      
      const command = `${dockerCommand} -f ${composeFile} up -d --build ${serviceName}`;
      
      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: projectPath,
        timeout: 120000,
        env: {
          ...process.env,
          ENV_FILE: process.env.ENV_FILE,
          DB_HOST: process.env.DB_HOST,
          DB_PORT: process.env.DB_PORT,
          DB_NAME: process.env.DB_NAME,
          DB_USER: process.env.DB_USER,
          DB_PASSWORD: process.env.DB_PASSWORD,
          SESSION_SECRET: process.env.SESSION_SECRET
        }
      });

      return {
        containerName,
        action: 'rebuild',
        output: output,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error reconstruyendo ${containerName}: ${error.message}`);
      throw new Error(`Error reconstruyendo ${containerName}: ${error.message}`);
    }
  }
}

module.exports = DockerManager;
