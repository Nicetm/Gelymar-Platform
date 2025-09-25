const express = require('express');
const router = express.Router();
const TestingService = require('../services/testing.service');
const RoleMiddleware = require('../middleware/role.middleware');
const AuditMiddleware = require('../middleware/audit.middleware');

const testingService = new TestingService();
const roleMiddleware = new RoleMiddleware();
const auditMiddleware = new AuditMiddleware();

// Aplicar middleware de autenticación a todas las rutas
router.use(require('../middleware/auth').requireAuth);

// Crear entorno de testing
router.post('/environment/create',
  roleMiddleware.requirePermission('testing.create'),
  auditMiddleware.logAction('test_environment_create', 'testing'),
  async (req, res) => {
    try {
      const {
        name,
        services = ['backend', 'frontend', 'mysql'],
        environment = 'test',
        cleanup = true
      } = req.body;

      const testEnv = await testingService.createTestEnvironment({
        name,
        services,
        environment,
        cleanup
      });

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'test_environment_create', 'testing', testEnv.name, {
        services,
        environment
      });

      res.json({
        success: true,
        data: testEnv,
        message: 'Entorno de testing creado exitosamente'
      });
    } catch (error) {
      console.error('Error creando entorno de testing:', error);
      res.status(500).json({
        success: false,
        message: 'Error creando entorno de testing',
        error: error.message
      });
    }
  }
);

// Ejecutar tests
router.post('/run',
  roleMiddleware.requirePermission('testing.execute'),
  auditMiddleware.logAction('test_execute', 'testing'),
  async (req, res) => {
    try {
      const {
        testSuite = 'all',
        environment = 'test'
      } = req.body;

      const testResults = await testingService.runTests(testSuite, environment);

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'test_execute', 'testing', testSuite, {
        environment,
        results: testResults.summary
      });

      res.json({
        success: true,
        data: testResults,
        message: 'Tests ejecutados exitosamente'
      });
    } catch (error) {
      console.error('Error ejecutando tests:', error);
      res.status(500).json({
        success: false,
        message: 'Error ejecutando tests',
        error: error.message
      });
    }
  }
);

// Limpiar entorno de testing
router.delete('/environment/:name',
  roleMiddleware.requirePermission('testing.cleanup'),
  auditMiddleware.logAction('test_environment_cleanup', 'testing'),
  async (req, res) => {
    try {
      const { name } = req.params;

      const result = await testingService.cleanupTestEnvironment(name);

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'test_environment_cleanup', 'testing', name);

      res.json({
        success: true,
        data: result,
        message: 'Entorno de testing limpiado exitosamente'
      });
    } catch (error) {
      console.error('Error limpiando entorno de testing:', error);
      res.status(500).json({
        success: false,
        message: 'Error limpiando entorno de testing',
        error: error.message
      });
    }
  }
);

// Obtener resultados de tests
router.get('/results/:testSuite/:environment',
  roleMiddleware.requirePermission('testing.read'),
  async (req, res) => {
    try {
      const { testSuite, environment } = req.params;

      const results = testingService.getTestResults(testSuite, environment);

      if (!results) {
        return res.status(404).json({
          success: false,
          message: 'Resultados de tests no encontrados'
        });
      }

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Error obteniendo resultados de tests:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo resultados de tests',
        error: error.message
      });
    }
  }
);

// Obtener todos los resultados de tests
router.get('/results',
  roleMiddleware.requirePermission('testing.read'),
  async (req, res) => {
    try {
      const results = testingService.getAllTestResults();

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Error obteniendo todos los resultados de tests:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo resultados de tests',
        error: error.message
      });
    }
  }
);

// Generar reporte de tests
router.get('/report/:testSuite/:environment',
  roleMiddleware.requirePermission('testing.read'),
  async (req, res) => {
    try {
      const { testSuite, environment } = req.params;

      const results = testingService.getTestResults(testSuite, environment);

      if (!results) {
        return res.status(404).json({
          success: false,
          message: 'Resultados de tests no encontrados'
        });
      }

      const report = testingService.generateTestReport(results);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generando reporte de tests:', error);
      res.status(500).json({
        success: false,
        message: 'Error generando reporte de tests',
        error: error.message
      });
    }
  }
);

// Ejecutar pipeline de CI/CD
router.post('/pipeline/run',
  roleMiddleware.requireRole('admin'),
  auditMiddleware.logAction('ci_pipeline_run', 'testing'),
  async (req, res) => {
    try {
      const {
        services = ['backend', 'frontend', 'mysql'],
        testSuite = 'all'
      } = req.body;

      const pipeline = await testingService.runCIPipeline({
        services,
        testSuite
      });

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'ci_pipeline_run', 'testing', pipeline.id, {
        services,
        testSuite,
        status: pipeline.status
      });

      res.json({
        success: true,
        data: pipeline,
        message: 'Pipeline de CI/CD ejecutado exitosamente'
      });
    } catch (error) {
      console.error('Error ejecutando pipeline de CI/CD:', error);
      res.status(500).json({
        success: false,
        message: 'Error ejecutando pipeline de CI/CD',
        error: error.message
      });
    }
  }
);

// Obtener estado de entornos de testing
router.get('/environments/status',
  roleMiddleware.requirePermission('testing.read'),
  async (req, res) => {
    try {
      const Docker = require('dockerode');
      const docker = new Docker();

      const containers = await docker.listContainers({ all: true });
      const testContainers = containers.filter(container => 
        container.Names.some(name => name.includes('test') || name.includes('ci'))
      );

      const environments = {};
      testContainers.forEach(container => {
        const name = container.Names[0].replace('/', '');
        const envMatch = name.match(/(test|ci|staging)/);
        const env = envMatch ? envMatch[1] : 'unknown';
        
        if (!environments[env]) {
          environments[env] = {
            name: env,
            containers: [],
            status: 'unknown'
          };
        }

        environments[env].containers.push({
          name,
          status: container.State,
          image: container.Image,
          ports: container.Ports
        });
      });

      // Determinar estado general de cada entorno
      Object.values(environments).forEach(env => {
        const runningContainers = env.containers.filter(c => c.status === 'running');
        if (runningContainers.length === env.containers.length) {
          env.status = 'healthy';
        } else if (runningContainers.length > 0) {
          env.status = 'partial';
        } else {
          env.status = 'stopped';
        }
      });

      res.json({
        success: true,
        data: environments
      });
    } catch (error) {
      console.error('Error obteniendo estado de entornos:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estado de entornos',
        error: error.message
      });
    }
  }
);

// Limpiar todos los entornos de testing
router.delete('/environments/cleanup-all',
  roleMiddleware.requireRole('admin'),
  auditMiddleware.logAction('test_environments_cleanup_all', 'testing'),
  async (req, res) => {
    try {
      const Docker = require('dockerode');
      const docker = new Docker();

      const containers = await docker.listContainers({ all: true });
      const testContainers = containers.filter(container => 
        container.Names.some(name => name.includes('test') || name.includes('ci'))
      );

      const results = {
        stopped: 0,
        removed: 0,
        errors: []
      };

      for (const container of testContainers) {
        try {
          const containerObj = docker.getContainer(container.Id);
          
          if (container.State === 'running') {
            await containerObj.stop();
            results.stopped++;
          }
          
          await containerObj.remove();
          results.removed++;
        } catch (error) {
          results.errors.push({
            container: container.Names[0],
            error: error.message
          });
        }
      }

      // Limpiar volúmenes y redes
      const { execSync } = require('child_process');
      try {
        execSync('docker volume prune -f', { stdio: 'inherit' });
        execSync('docker network prune -f', { stdio: 'inherit' });
      } catch (error) {
        console.error('Error limpiando volúmenes/redes:', error);
      }

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'test_environments_cleanup_all', 'testing', null, results);

      res.json({
        success: true,
        data: results,
        message: 'Todos los entornos de testing limpiados'
      });
    } catch (error) {
      console.error('Error limpiando todos los entornos:', error);
      res.status(500).json({
        success: false,
        message: 'Error limpiando entornos de testing',
        error: error.message
      });
    }
  }
);

// Obtener logs de tests
router.get('/logs/:testSuite/:environment',
  roleMiddleware.requirePermission('testing.read'),
  async (req, res) => {
    try {
      const { testSuite, environment } = req.params;
      const { lines = 100 } = req.query;

      const Docker = require('dockerode');
      const docker = new Docker();

      const containers = await docker.listContainers();
      const testContainer = containers.find(container => 
        container.Names.some(name => 
          name.includes(environment) && 
          (name.includes('backend') || name.includes('frontend'))
        )
      );

      if (!testContainer) {
        return res.status(404).json({
          success: false,
          message: 'Contenedor de testing no encontrado'
        });
      }

      const container = docker.getContainer(testContainer.Id);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        timestamps: true,
        tail: lines
      });

      res.json({
        success: true,
        data: {
          container: testContainer.Names[0],
          logs: logs.toString(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error obteniendo logs de tests:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo logs de tests',
        error: error.message
      });
    }
  }
);

module.exports = router;
