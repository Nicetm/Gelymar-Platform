const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

class ConfigManager {
  constructor() {
    this.projectPath = process.env.PROJECT_PATH || '/app/project';
    // Usar /app/project/docker para que coincida con la estructura del proyecto
    this.dockerPath = path.join(this.projectPath, 'docker');
    // Usar la variable de entorno ENV_FILE si está definida, sino usar .env.production por defecto
    this.envFile = process.env.ENV_FILE || path.join(this.dockerPath, '.env.production');
    this.backupPath = path.join(this.dockerPath, 'backups');
    
      
    // Asegurar que el directorio de backups existe
    fs.ensureDirSync(this.backupPath);
  }

  /**
   * Obtener archivo .env según el entorno
   */
  getEnvFile(environment) {
    
    if (environment === 'dev') {
      const devFile = path.join(this.dockerPath, '.env.local');
      return devFile;
    } else {
      const prodFile = path.join(this.dockerPath, '.env.production');
      return prodFile;
    }
  }

  /**
   * Obtener configuración actual
   */
  async getCurrentConfig(environment = 'prod') {
    try {
      const targetEnvFile = this.getEnvFile(environment);
      
      // Verificar si el archivo existe
      const fileExists = await fs.pathExists(targetEnvFile);
       
      if (!fileExists) {
        throw new Error(`Archivo de configuración no encontrado: ${targetEnvFile}`);
      }
      
      const envContent = await fs.readFile(targetEnvFile, 'utf8');
          
      const config = this.parseEnvFile(envContent);
      
      return config;
    } catch (error) {
      console.error(`❌ Error en getCurrentConfig:`, error);
      throw new Error(`Error leyendo configuración: ${error.message}`);
    }
  }

  /**
   * Obtener contenido del archivo .env
   */
  async getFileContent(environment = 'prod') {
    try {
      const targetEnvFile = this.getEnvFile(environment);
      
      // Verificar si el archivo existe
      const fileExists = await fs.pathExists(targetEnvFile);
      
      if (!fileExists) {
        return `# Archivo no encontrado: ${targetEnvFile}\n# Crea el archivo para ver su contenido aquí`;
      }
      
      const envContent = await fs.readFile(targetEnvFile, 'utf8');
      
      return envContent;
    } catch (error) {
      console.error('❌ Error leyendo contenido del archivo:', error);
      return `# Error leyendo archivo: ${error.message}`;
    }
  }

  /**
   * Actualizar IP del servidor
   */
  async updateIP(newIP) {
    try {
      // 1. Crear backup
      await this.createBackup(`ip-update-${Date.now()}`);
      
      // 2. Leer configuración actual
      const envContent = await fs.readFile(this.envFile, 'utf8');
      const config = this.parseEnvFile(envContent);
      
      // 3. Actualizar IP
      config.HOST_IP = newIP;
      
      // 4. Actualizar todas las URLs que contengan la IP anterior
      const oldIP = this.extractCurrentIP(envContent);
      const updatedConfig = this.updateURLsInConfig(config, oldIP, newIP);
      
      // 5. Escribir nueva configuración
      const newEnvContent = this.generateEnvFile(updatedConfig);
      await fs.writeFile(this.envFile, newEnvContent);
      
      return {
        oldIP,
        newIP,
        updatedURLs: this.extractURLs(updatedConfig),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error actualizando IP: ${error.message}`);
    }
  }

  /**
   * Agregar dominio
   */
  async addDomain(domain) {
    try {
      // 1. Crear backup
      await this.createBackup(`domain-add-${Date.now()}`);
      
      // 2. Leer configuración actual
      const envContent = await fs.readFile(this.envFile, 'utf8');
      const config = this.parseEnvFile(envContent);
      
      // 3. Agregar dominio
      config.DOMAIN = domain;
      
      // 4. Actualizar URLs para usar dominio si está disponible
      const updatedConfig = this.updateURLsWithDomain(config, domain);
      
      // 5. Escribir nueva configuración
      const newEnvContent = this.generateEnvFile(updatedConfig);
      await fs.writeFile(this.envFile, newEnvContent);
      
      return {
        domain,
        updatedURLs: this.extractURLs(updatedConfig),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error agregando dominio: ${error.message}`);
    }
  }

  /**
   * Cambiar protocolo (HTTP/HTTPS)
   */
  async switchProtocol(protocol) {
    try {
      // 1. Crear backup
      await this.createBackup(`protocol-switch-${Date.now()}`);
      
      // 2. Leer configuración actual
      const envContent = await fs.readFile(this.envFile, 'utf8');
      const config = this.parseEnvFile(envContent);
      
      // 3. Actualizar protocolo en todas las URLs
      const updatedConfig = this.updateProtocolInConfig(config, protocol);
      
      // 4. Escribir nueva configuración
      const newEnvContent = this.generateEnvFile(updatedConfig);
      await fs.writeFile(this.envFile, newEnvContent);
      
      return {
        protocol,
        updatedURLs: this.extractURLs(updatedConfig),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error cambiando protocolo: ${error.message}`);
    }
  }

  /**
   * Crear backup de configuración
   */
  async createBackup(description = 'manual') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${description}-${timestamp}.env`;
      const backupFile = path.join(this.backupPath, backupName);
      
      // Copiar archivo actual
      await fs.copy(this.envFile, backupFile);
      
      // Crear archivo de metadatos
      const metadata = {
        timestamp: new Date().toISOString(),
        description,
        originalFile: this.envFile,
        backupFile
      };
      
      const metadataFile = backupFile.replace('.env', '.json');
      await fs.writeJson(metadataFile, metadata, { spaces: 2 });
      
      return {
        backupName,
        backupFile,
        metadata
      };
    } catch (error) {
      throw new Error(`Error creando backup: ${error.message}`);
    }
  }

  /**
   * Restaurar desde backup
   */
  async restoreFromBackup(backupId) {
    try {
      const backupFile = path.join(this.backupPath, `${backupId}.env`);
      const metadataFile = path.join(this.backupPath, `${backupId}.json`);
      
      // Verificar que el backup existe
      if (!await fs.pathExists(backupFile)) {
        throw new Error(`Backup ${backupId} no encontrado`);
      }
      
      // Crear backup antes de restaurar
      await this.createBackup(`pre-restore-${Date.now()}`);
      
      // Restaurar archivo
      await fs.copy(backupFile, this.envFile);
      
      // Leer metadatos
      const metadata = await fs.readJson(metadataFile);
      
      return {
        backupId,
        restoredFrom: metadata,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error restaurando backup: ${error.message}`);
    }
  }

  /**
   * Listar backups disponibles
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupPath);
      const backups = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const metadataFile = path.join(this.backupPath, file);
          const metadata = await fs.readJson(metadataFile);
          backups.push({
            id: file.replace('.json', ''),
            ...metadata
          });
        }
      }
      
      // Ordenar por timestamp descendente
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return backups;
    } catch (error) {
      throw new Error(`Error listando backups: ${error.message}`);
    }
  }

  // Métodos auxiliares

  parseEnvFile(content) {
    const config = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          config[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    
    return config;
  }

  generateEnvFile(config) {
    let content = '# ===========================================\n';
    content += '# CONFIGURACIÓN PARA PRODUCCIÓN\n';
    content += '# ===========================================\n\n';
    
    // Agrupar por categorías
    const categories = {
      'Base de datos': ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'],
      'API y servidor': ['PORT', 'NODE_ENV', 'DOCKER_ENV', 'JWT_SECRET'],
      'URLs de servicios': ['HOST_IP', 'FRONTEND_BASE_URL', 'PUBLIC_API_URL', 'PUBLIC_FILE_SERVER_URL', 'PUBLIC_API_BASE_URL', 'PUBLIC_FRONTEND_BASE_URL', 'SERVER_API_URL', 'SITE', 'BACKEND_BASE_URL'],
      'File server': ['FILE_SERVER_URL', 'FILE_SERVER_ROOT'],
      'Red compartida': ['NETWORK_SERVER', 'NETWORK_SHARE_PATH', 'NETWORK_USER', 'NETWORK_PASSWORD'],
      'SMTP y email': ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'RESEND_KEY'],
      'Configuración de seguridad': ['RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_REQUESTS', 'SLOW_DOWN_DELAY_AFTER', 'SLOW_DOWN_DELAY_MS'],
      'Cron': ['BACKEND_API_URL'],
      'Frontend': ['PUBLIC_LANG', 'BASE_URL', 'REMOTE_ASSETS_BASE_URL', 'CI'],
      'Terminal': ['TERMINAL_USER', 'TERMINAL_PASS'],
      'Fileserver': ['FILESERVER_USER', 'FILESERVER_PASS'],
      'Dominio': ['DOMAIN']
    };
    
    for (const [category, keys] of Object.entries(categories)) {
      content += `# ${category}\n`;
      for (const key of keys) {
        if (config[key] !== undefined) {
          content += `${key}=${config[key]}\n`;
        }
      }
      content += '\n';
    }
    
    return content;
  }

  detectProtocol(config) {
    const urls = Object.values(config).filter(value => 
      typeof value === 'string' && value.startsWith('http')
    );
    
    return urls.some(url => url.startsWith('https')) ? 'https' : 'http';
  }

  extractURLs(config) {
    const urlKeys = [
      'FRONTEND_BASE_URL',
      'PUBLIC_API_URL', 
      'PUBLIC_FILE_SERVER_URL',
      'PUBLIC_API_BASE_URL',
      'PUBLIC_FRONTEND_BASE_URL',
      'BACKEND_BASE_URL',
      'SITE'
    ];
    
    const urls = {};
    for (const key of urlKeys) {
      if (config[key]) {
        urls[key] = config[key];
      }
    }
    
    return urls;
  }

  extractCurrentIP(content) {
    const match = content.match(/HOST_IP=(.+)/);
    return match ? match[1] : '172.20.10.151';
  }

  updateURLsInConfig(config, oldIP, newIP) {
    const updatedConfig = { ...config };
    
    for (const [key, value] of Object.entries(updatedConfig)) {
      if (typeof value === 'string' && value.includes(oldIP)) {
        updatedConfig[key] = value.replace(new RegExp(oldIP, 'g'), newIP);
      }
    }
    
    return updatedConfig;
  }

  updateURLsWithDomain(config, domain) {
    const updatedConfig = { ...config };
    const protocol = this.detectProtocol(config);
    
    // Si hay dominio, usar dominio en lugar de IP para URLs públicas
    if (domain) {
      const urlMappings = {
        'FRONTEND_BASE_URL': `${protocol}://${domain}:2121`,
        'PUBLIC_API_URL': `${protocol}://${domain}:3000`,
        'PUBLIC_FILE_SERVER_URL': `${protocol}://${domain}:8080`,
        'PUBLIC_API_BASE_URL': `${protocol}://${domain}:3000/api`,
        'PUBLIC_FRONTEND_BASE_URL': `${protocol}://${domain}:2121`,
        'BACKEND_BASE_URL': `${protocol}://${domain}:3000`,
        'SITE': `${protocol}://${domain}:2121`
      };
      
      for (const [key, value] of Object.entries(urlMappings)) {
        updatedConfig[key] = value;
      }
    }
    
    return updatedConfig;
  }

  updateProtocolInConfig(config, protocol) {
    const updatedConfig = { ...config };
    
    for (const [key, value] of Object.entries(updatedConfig)) {
      if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
        const url = new URL(value);
        url.protocol = protocol + ':';
        updatedConfig[key] = url.toString();
      }
    }
    
    return updatedConfig;
  }

  /**
   * Actualizar configuración
   */
  async updateConfig(updates) {
    try {
      
      // Determinar el archivo .env según el entorno
      const environment = updates.environment || 'prod';
      const targetEnvFile = this.getEnvFile(environment);

      // Verificar si el archivo existe
      const fileExists = await fs.pathExists(targetEnvFile);
      
      if (!fileExists) {
        throw new Error(`Archivo de configuración no encontrado: ${targetEnvFile}`);
      }
      
      // Leer archivo actual
      const envContent = await fs.readFile(targetEnvFile, 'utf8');
      
      const config = this.parseEnvFile(envContent);
      
      // Aplicar TODAS las actualizaciones
      
      // Actualizar TODOS los parámetros que vengan en updates
      Object.keys(updates).forEach(key => {
        if (key !== 'environment' && updates[key] !== undefined && updates[key] !== '') {
          const oldValue = config[key] || 'undefined';
          const newValue = updates[key];
          config[key] = newValue;
        }
      });
      
      
      // Crear backup
      const backupFile = path.join(this.backupPath, `config-backup-${environment}-${Date.now()}.env`);
      await fs.writeFile(backupFile, envContent);
      
      // Escribir archivo actualizado
      const newContent = this.generateEnvContent(config);
      
      await fs.writeFile(targetEnvFile, newContent);
      
      // Verificar que se escribió correctamente
      const verifyContent = await fs.readFile(targetEnvFile, 'utf8');
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error actualizando configuración:', error);
      throw error;
    }
  }

  /**
   * Generar contenido del archivo .env organizado por secciones
   */
  generateEnvContent(config) {
    const sections = {
      'Base de Datos': ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'],
      'Servidor': ['PORT', 'NODE_ENV', 'DOCKER_ENV'],
      'Autenticación': ['JWT_SECRET'],
      'Red y URLs': ['HOST_IP', 'DOMAIN', 'FRONTEND_BASE_URL', 'PUBLIC_API_URL', 'PUBLIC_FILE_SERVER_URL', 'PUBLIC_API_BASE_URL', 'PUBLIC_FRONTEND_BASE_URL', 'SERVER_API_URL', 'SITE', 'BACKEND_BASE_URL', 'BACKEND_API_URL'],
      'File Server': ['FILE_SERVER_URL', 'FILE_SERVER_ROOT'],
      'Red Compartida': ['NETWORK_SERVER', 'NETWORK_SHARE_PATH', 'NETWORK_USER', 'NETWORK_PASSWORD'],
      'Email': ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'RESEND_KEY'],
      'Rate Limiting': ['RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_REQUESTS', 'SLOW_DOWN_DELAY_AFTER', 'SLOW_DOWN_DELAY_MS'],
      'Frontend': ['PUBLIC_LANG', 'BASE_URL', 'REMOTE_ASSETS_BASE_URL', 'CI'],
      'Usuarios del Sistema': ['TERMINAL_USER', 'TERMINAL_PASS', 'FILESERVER_USER', 'FILESERVER_PASS']
    };

    let content = '# ===========================================\n';
    content += '# CONFIGURACIÓN - GELYMAR PLATFORM\n';
    content += '# ===========================================\n\n';

    for (const [sectionName, keys] of Object.entries(sections)) {
      content += `# ${sectionName}\n`;
      for (const key of keys) {
        if (config[key] !== undefined) {
          content += `${key}=${config[key]}\n`;
        }
      }
      content += '\n';
    }

    // Agregar cualquier clave que no esté en las secciones
    const usedKeys = new Set(Object.values(sections).flat());
    const remainingKeys = Object.keys(config).filter(key => !usedKeys.has(key));
    
    if (remainingKeys.length > 0) {
      content += '# Otras configuraciones\n';
      for (const key of remainingKeys) {
        content += `${key}=${config[key]}\n`;
      }
    }

    return content;
  }
}

module.exports = ConfigManager;
