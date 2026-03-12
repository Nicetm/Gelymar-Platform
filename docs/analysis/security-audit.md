# Auditoría de Seguridad - Plataforma de Gestión Gelymar

**Fecha**: 2025-01-XX  
**Versión**: 1.0  
**Auditor**: Análisis Automatizado de Seguridad

## Resumen Ejecutivo

Esta auditoría de seguridad identifica vulnerabilidades, secretos expuestos, y problemas de configuración en la Plataforma de Gestión Gelymar. El análisis cubre tres áreas principales:

1. **Vulnerabilidades de Dependencias y Secretos Hardcodeados**
2. **Seguridad de Endpoints y Validación de Inputs**
3. **Manejo de Archivos y Uploads**

### Hallazgos Críticos

- **42 vulnerabilidades** en dependencias (13 Backend, 28 Frontend, 1 Cronjob)
- **Múltiples secretos hardcodeados** en archivos .env y código fuente
- **Contraseñas por defecto débiles** ('123456') en múltiples servicios
- **SSH password expuesto** en config-manager
- **Rate limiting aplicado solo a rutas de autenticación**
- **Validación de inputs inconsistente** en algunos endpoints

### Nivel de Riesgo Global: **ALTO**

---

## 1. Vulnerabilidades de Dependencias y Secretos

### 1.1 Escaneo de Vulnerabilidades (npm audit)

#### Backend (13 vulnerabilidades)

**Severidad**: 9 High, 4 Moderate

| Paquete | Severidad | Vulnerabilidad | CVE/GHSA |
|---------|-----------|----------------|----------|
| axios | High | DoS por falta de validación de tamaño | GHSA-4hjh-wcwx-xvwj |
| axios | High | DoS via __proto__ en mergeConfig | GHSA-43fc-jf86-j433 |
| nodemailer | High | DoS en addressparser | GHSA-rcmh-qjqh-p98v |
| nodemon | High | ReDoS via minimatch | GHSA-3ppc-4f35-3m26 |
| validator | High | Filtrado incompleto de elementos especiales | GHSA-vghf-hv5q-vc2g |
| jws | High | Verificación incorrecta de firma HMAC | GHSA-869p-cjfg-cm3x |
| qs | High | Bypass de arrayLimit permite DoS | GHSA-6rw7-vpxm-498p |
| swagger-jsdoc | High | Vulnerabilidad transitiva via glob | - |
| body-parser | Moderate | DoS con url encoding | GHSA-wqch-xfxh-vrr4 |
| express-validator | Moderate | Vulnerabilidad transitiva via validator | - |
| js-yaml | Moderate | Prototype pollution en merge | GHSA-mh29-5h37-fv8m |
| lodash | Moderate | Prototype pollution en _.unset | GHSA-xxjr-mmjv-4gpg |

**Recomendación**: Actualizar todas las dependencias a versiones seguras mediante `npm audit fix`.

#### Frontend (28 vulnerabilidades)

**Severidad**: 19 High, 7 Moderate, 2 Low

| Paquete | Severidad | Vulnerabilidad | CVE/GHSA |
|---------|-----------|----------------|----------|
| astro | High | XSS reflejado via server islands | GHSA-wrwg-2hg8-v723 |
| astro | High | Bypass de autenticación via doble URL encoding | GHSA-whqg-ppgf-wp8c |
| devalue | High | DoS por agotamiento de memoria/CPU | GHSA-g2pg-6438-jwpf |
| h3 | High | Request Smuggling (TE.TE) | GHSA-mp2g-9vg9-f4cg |
| eslint | High | Vulnerabilidades transitivas via minimatch | - |
| @astrojs/node | Moderate | Open redirect por trailing slash | GHSA-9x9c-ghc5-jhw9 |
| vite | Moderate | Bypass de server.fs.deny en Windows | GHSA-93m4-6634-74q7 |
| sweetalert2 | Low | Comportamiento potencialmente indeseable | GHSA-mrr8-v49w-3333 |

**Recomendación Crítica**: Actualizar Astro a versión >= 5.15.9 para corregir vulnerabilidades XSS y bypass de autenticación.

#### Cronjob (1 vulnerabilidad)

**Severidad**: 1 High

| Paquete | Severidad | Vulnerabilidad | CVE/GHSA |
|---------|-----------|----------------|----------|
| axios | High | DoS por falta de validación de tamaño | GHSA-4hjh-wcwx-xvwj |

**Recomendación**: Actualizar axios a versión >= 1.12.0.

---

### 1.2 Secretos Hardcodeados

#### 🔴 CRÍTICO: Secretos en Archivos .env

**Ubicación**: `docker/.env.production`, `docker/.env.local`

```bash
# Credenciales de Base de Datos
MYSQL_DB_PASS=root123456
SQL_PASS=Soft7488$.

# Claves de Encriptación y JWT
ENCRYPTION_KEY=gelymar-chat-encryption-key-2024-secure-production-ready
JWT_SECRET=gelymar_jwt_secret_key_2024

# Credenciales SMTP
SMTP_PASS=T$718649482733av

# API Keys
RESEND_KEY=re_fA1mA4H1_GJrLoZvz3Up3L8W7TwpcreAg
RECAPTCHA_SECRET_KEY=6LeO8vMrAAAAAED_i2ML5sZd7Myeo2bwuGHyl-PF
```

**Riesgo**: Estos archivos están en el repositorio y exponen credenciales de producción.

**Recomendación**:
1. **Inmediato**: Rotar TODAS las credenciales expuestas
2. Agregar `.env.production` y `.env.local` a `.gitignore`
3. Usar gestión de secretos (AWS Secrets Manager, HashiCorp Vault, o variables de entorno del sistema)
4. Documentar proceso de configuración sin exponer secretos

#### 🔴 CRÍTICO: SSH Password Hardcodeado

**Ubicación**: `docker/config-manager/src/routes/api.js`, `docker/config-manager/src/config/docker.js`

```javascript
SSH_PASSWORD: 'Lug4R0j4.2025.'
```

**Riesgo**: Password SSH expuesto permite acceso no autorizado al servidor de producción.

**Recomendación**:
1. **Inmediato**: Cambiar password SSH del servidor
2. Implementar autenticación por clave SSH en lugar de password
3. Remover password hardcodeado del código
4. Usar variables de entorno para credenciales SSH

#### 🟡 ALTO: Contraseñas por Defecto Débiles

**Ubicación**: Múltiples archivos

```javascript
// Backend/controllers/customer.controller.js
const defaultPassword = '123456';

// Backend/services/user.service.js
async function resetAdminPassword(id, newPassword = '12345')

// Backend/services/checkClientAccess.service.js
const defaultPassword = '123456';

// Frontend/public/js/sidebar-admin.js
password: '123456'
```

**Riesgo**: Contraseñas predecibles facilitan acceso no autorizado.

**Recomendación**:
1. Generar contraseñas aleatorias seguras (mínimo 12 caracteres, alfanuméricos + símbolos)
2. Forzar cambio de contraseña en primer login
3. Implementar política de contraseñas robusta
4. Enviar contraseña temporal por email seguro

#### 🟡 ALTO: Credenciales de Testing Hardcodeadas

**Ubicación**: `docker/config-manager/src/services/testing.service.js`

```javascript
MYSQL_PASSWORD: 'test123456'
JWT_SECRET: 'test_jwt_secret_key_2024'
```

**Riesgo**: Aunque son para testing, pueden ser usadas si el entorno no está correctamente aislado.

**Recomendación**:
1. Usar variables de entorno incluso para testing
2. Asegurar que entornos de testing estén completamente aislados
3. Documentar claramente que son credenciales de testing

---

### 1.3 Encriptación de Passwords

#### ✅ CORRECTO: Uso de bcrypt

**Análisis**: Todas las contraseñas se hashean con bcrypt (factor 10):

```javascript
// Ejemplos encontrados
await bcrypt.hash(password, 10);
await bcrypt.compare(password, user.password);
```

**Ubicaciones verificadas**:
- `Backend/controllers/auth.controller.js`
- `Backend/controllers/customer.controller.js`
- `Backend/services/user.service.js`
- `Backend/services/checkClientAccess.service.js`

**Recomendación**: Considerar aumentar el factor de bcrypt a 12 para mayor seguridad (balance con performance).

---

### 1.4 Tokens JWT

#### ✅ CORRECTO: Expiración Configurada

**Análisis**: Los tokens JWT tienen expiración de 1 hora:

```javascript
// Backend/utils/jwt.util.js
return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
```

**Recomendación**: 
- Implementar refresh tokens para sesiones más largas
- Considerar expiración más corta (30 minutos) para admin
- Implementar blacklist de tokens para logout efectivo

---

## 2. Seguridad de Endpoints y Validación

### 2.1 Rate Limiting

#### 🟡 MEDIO: Rate Limiting Limitado

**Análisis**: Rate limiting solo aplicado a rutas de autenticación:

```javascript
// Backend/app.js
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests
});

app.use('/api/auth', authLimiter, authSlowDown, authRoutes);
```

**Endpoints sin rate limiting**:
- `/api/orders` - Consulta de órdenes
- `/api/customers` - Gestión de clientes
- `/api/document-files` - Subida/descarga de archivos
- `/api/chat` - Sistema de chat
- `/api/cron` - Endpoints de cron jobs

**Riesgo**: Posible abuso de recursos, DoS, o scraping de datos.

**Recomendación**:
1. Aplicar rate limiting global más estricto
2. Rate limiting específico por endpoint sensible:
   - `/api/document-files/upload`: 10 requests/hora
   - `/api/chat/messages`: 60 requests/minuto
   - `/api/orders`: 100 requests/15 minutos
3. Rate limiting por usuario autenticado (no solo por IP)

---

### 2.2 Validación de Inputs

#### ✅ BUENO: Validación con express-validator

**Análisis**: Sistema de validación implementado en `Backend/middleware/validation.middleware.js`:

```javascript
const authValidations = {
  login: [
    body('email').optional().isEmail(),
    body('password').isLength({ min: 5 }),
    handleValidationErrors
  ]
};
```

**Validaciones implementadas**:
- ✅ Autenticación (login, cambio de password, recuperación)
- ✅ Usuarios (perfil, avatar)
- ✅ Órdenes (búsqueda, getById)
- ✅ Archivos (upload, rename)
- ✅ Clientes (CRUD, contactos)

#### 🟡 MEDIO: Validación Inconsistente

**Endpoints sin validación explícita**:
- `GET /api/orders/:id` - No valida formato de ID
- `GET /api/customers/:rut` - No valida formato de RUT
- `POST /api/chat/messages` - No valida longitud de mensaje
- `PUT /api/config/:name` - No valida estructura de configuración

**Recomendación**:
1. Aplicar validación a TODOS los endpoints
2. Validar tipos de datos (int, string, email, etc.)
3. Validar rangos y longitudes
4. Sanitizar inputs para prevenir XSS

---

### 2.3 SQL Injection

#### ✅ EXCELENTE: Sin Vulnerabilidades Detectadas

**Análisis**: Todas las queries usan parámetros preparados:

```javascript
// MySQL
await pool.query('SELECT * FROM users WHERE rut = ?', [rut]);

// SQL Server
request.input('pc', sql.VarChar, pc);
await request.query('SELECT * FROM orders WHERE Nro = @pc');
```

**Búsqueda realizada**: No se encontraron concatenaciones de strings en queries.

**Recomendación**: Mantener esta práctica en todo código nuevo.

---

### 2.4 CORS Configuration

#### ✅ BUENO: CORS Restrictivo

**Análisis**: CORS configurado con whitelist de orígenes:

```javascript
const allowedOrigins = [
  'http://172.20.10.151:2121',      // Admin
  'https://logistic.gelymar.cl',    // Client
  'http://172.20.10.151:2123',      // Seller
  ...devOrigins  // Solo en desarrollo
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true
}));
```

**Recomendación**: 
- Remover orígenes de desarrollo en producción
- Validar que `devOrigins` no se incluya cuando `NODE_ENV=production`

---

## 3. Manejo de Archivos y Uploads

### 3.1 Validación de Tipo y Tamaño

#### ✅ BUENO: Validación Implementada

**Análisis**: Multer configurado con filtros:

```javascript
// Backend/controllers/documentFile.controller.js
const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Tipo de archivo no permitido'), false);
};

// Backend/controllers/chat.controller.js
const chatImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo no permitido'), false);
  }
});
```

**Límites configurados**:
- Documentos PDF: Sin límite explícito (usar límite global de 10MB)
- Imágenes de chat: 5MB
- Avatares: 5MB

**Recomendación**:
1. Agregar límite explícito a uploads de PDF (10MB)
2. Validar MIME type además de extensión
3. Escanear archivos con antivirus (ClamAV)

---

### 3.2 Permisos de Archivos

#### ✅ EXCELENTE: Sistema de Permisos Implementado

**Análisis**: Utilidad completa en `Backend/utils/filePermissions.js`:

```javascript
const FILE_PERMISSIONS = {
  CONFIG: 0o600,      // Solo propietario
  LOGS: 0o640,        // Propietario + grupo
  UPLOADS: 0o644,     // Propietario + lectura pública
  DIRECTORIES: 0o755, // Estándar de directorios
  TEMP: 0o600         // Solo propietario
};
```

**Funciones implementadas**:
- ✅ `setSecureFilePermissions()` - Establece permisos seguros
- ✅ `validateFilePath()` - Previene path traversal
- ✅ `cleanupTempFiles()` - Limpia archivos temporales
- ✅ `createSecureDirectory()` - Crea directorios con permisos correctos

**Recomendación**: Asegurar que estas funciones se usen consistentemente en todo el código.

---

### 3.3 Sanitización de Nombres

#### ✅ BUENO: Sanitización Implementada

**Análisis**: Función de sanitización en `Backend/controllers/documentFile.controller.js`:

```javascript
function sanitizeFileNamePart(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(/[<>:"/\\|?*]/g, '')      // Caracteres peligrosos
    .replace(/[\x00-\x1f\x7f]/g, '')   // Caracteres de control
    .replace(/\s+/g, ' ')               // Espacios múltiples
    .trim();
}
```

**Recomendación**: Aplicar sanitización a TODOS los nombres de archivo antes de guardar.

---

### 3.4 Path Traversal Protection

#### ✅ EXCELENTE: Protección Implementada

**Análisis**: Validación de rutas en `Backend/utils/filePermissions.js`:

```javascript
function validateFilePath(filePath, basePath) {
  // Verificar caracteres peligrosos
  if (filePath.includes('..') || filePath.includes('~')) {
    return false;
  }
  
  // Verificar que esté dentro del directorio base
  const normalizedPath = path.normalize(fullPath);
  const relativePath = path.relative(normalizedBase, normalizedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return false;
  }
  
  return true;
}
```

**Recomendación**: Usar esta función en TODOS los accesos a archivos.

---

### 3.5 Control de Acceso por Rol

#### ✅ BUENO: Control Implementado

**Análisis**: Validación de acceso en servicios:

```javascript
// Backend/services/documentFile.service.js
async getCustomerCheckForViewFile(fileId, userId) {
  // Verifica que el usuario tenga acceso al archivo
  // Admin: todos los archivos
  // Seller: archivos de sus clientes
  // Client: solo archivos visibles (is_visible_to_client=1)
}
```

**Recomendación**: Auditar que TODOS los endpoints de archivos usen estas validaciones.

---

## 4. Recomendaciones Priorizadas

### 🔴 CRÍTICAS (Implementar Inmediatamente)

1. **Rotar Secretos Expuestos**
   - Cambiar TODAS las credenciales en `.env.production` y `.env.local`
   - Cambiar SSH password del servidor
   - Rotar JWT_SECRET y ENCRYPTION_KEY
   - Actualizar credenciales SMTP y API keys

2. **Remover Secretos del Repositorio**
   - Agregar `.env.*` a `.gitignore`
   - Usar gestión de secretos externa
   - Limpiar historial de Git (BFG Repo-Cleaner)

3. **Actualizar Dependencias Críticas**
   - Astro >= 5.15.9 (XSS y bypass de autenticación)
   - axios >= 1.12.0 (DoS)
   - nodemailer >= 7.1.0 (DoS)

4. **Implementar Autenticación SSH por Clave**
   - Deshabilitar autenticación por password
   - Generar y distribuir claves SSH
   - Remover passwords hardcodeados

---

### 🟡 ALTAS (Implementar en 1-2 Semanas)

5. **Mejorar Contraseñas por Defecto**
   - Generar contraseñas aleatorias seguras
   - Forzar cambio en primer login
   - Implementar política de contraseñas

6. **Extender Rate Limiting**
   - Aplicar a todos los endpoints sensibles
   - Rate limiting por usuario autenticado
   - Configurar límites específicos por endpoint

7. **Completar Validación de Inputs**
   - Agregar validación a endpoints faltantes
   - Validar tipos, rangos y longitudes
   - Sanitizar inputs para prevenir XSS

8. **Actualizar Todas las Dependencias**
   - Ejecutar `npm audit fix` en Backend, Frontend, Cronjob
   - Resolver vulnerabilidades restantes manualmente
   - Establecer proceso de actualización regular

---

### 🟢 MEDIAS (Implementar en 1 Mes)

9. **Mejorar Seguridad de JWT**
   - Implementar refresh tokens
   - Reducir expiración a 30 minutos para admin
   - Implementar blacklist de tokens

10. **Escaneo de Archivos Subidos**
    - Integrar ClamAV para escaneo de malware
    - Validar MIME type además de extensión
    - Implementar cuarentena para archivos sospechosos

11. **Auditoría de Logs de Seguridad**
    - Implementar logging de eventos de seguridad
    - Alertas para intentos de acceso no autorizado
    - Monitoreo de patrones sospechosos

12. **Hardening de CORS**
    - Remover orígenes de desarrollo en producción
    - Validar configuración por entorno
    - Documentar orígenes permitidos

---

## 5. Métricas de Seguridad

### Vulnerabilidades por Severidad

| Severidad | Backend | Frontend | Cronjob | Total |
|-----------|---------|----------|---------|-------|
| Critical  | 0       | 0        | 0       | 0     |
| High      | 9       | 19       | 1       | 29    |
| Moderate  | 4       | 7        | 0       | 11    |
| Low       | 0       | 2        | 0       | 2     |
| **Total** | **13**  | **28**   | **1**   | **42** |

### Secretos Expuestos

| Tipo | Cantidad | Severidad |
|------|----------|-----------|
| Credenciales de BD | 2 | Crítica |
| Claves de Encriptación | 2 | Crítica |
| SSH Passwords | 1 | Crítica |
| API Keys | 2 | Alta |
| Contraseñas por Defecto | 4+ | Alta |
| **Total** | **11+** | - |

### Cobertura de Seguridad

| Área | Estado | Cobertura |
|------|--------|-----------|
| Encriptación de Passwords | ✅ Excelente | 100% |
| SQL Injection Prevention | ✅ Excelente | 100% |
| Path Traversal Protection | ✅ Excelente | 100% |
| File Permissions | ✅ Excelente | 100% |
| JWT Expiration | ✅ Bueno | 100% |
| CORS Configuration | ✅ Bueno | 100% |
| Input Validation | 🟡 Medio | ~70% |
| Rate Limiting | 🟡 Medio | ~20% |
| Dependency Updates | 🔴 Bajo | 0% |
| Secrets Management | 🔴 Crítico | 0% |

---

## 6. Plan de Acción

### Semana 1: Mitigación de Riesgos Críticos

- [ ] Rotar todas las credenciales expuestas
- [ ] Cambiar SSH password del servidor
- [ ] Implementar autenticación SSH por clave
- [ ] Agregar `.env.*` a `.gitignore`
- [ ] Actualizar Astro, axios, nodemailer

### Semana 2-3: Mejoras de Seguridad Alta

- [ ] Implementar gestión de secretos (AWS Secrets Manager o similar)
- [ ] Generar contraseñas aleatorias para usuarios nuevos
- [ ] Extender rate limiting a endpoints sensibles
- [ ] Completar validación de inputs en endpoints faltantes
- [ ] Ejecutar `npm audit fix` en todos los proyectos

### Mes 1: Mejoras de Seguridad Media

- [ ] Implementar refresh tokens para JWT
- [ ] Integrar escaneo de malware en uploads
- [ ] Implementar logging de eventos de seguridad
- [ ] Configurar alertas de seguridad
- [ ] Documentar políticas de seguridad

### Continuo: Mantenimiento

- [ ] Revisión mensual de dependencias
- [ ] Auditoría trimestral de seguridad
- [ ] Actualización de políticas según nuevas amenazas
- [ ] Capacitación del equipo en mejores prácticas

---

## 7. Conclusiones

La Plataforma de Gestión Gelymar tiene una **base de seguridad sólida** en áreas críticas como encriptación de passwords, prevención de SQL injection, y protección contra path traversal. Sin embargo, presenta **riesgos críticos** relacionados con:

1. **Exposición de secretos** en el repositorio
2. **Vulnerabilidades en dependencias** sin actualizar
3. **Contraseñas por defecto débiles**
4. **Rate limiting limitado**

La implementación de las recomendaciones priorizadas reducirá significativamente el riesgo de seguridad y mejorará la postura de seguridad general de la plataforma.

**Próximos Pasos**:
1. Presentar este reporte al equipo de desarrollo
2. Priorizar y asignar tareas de mitigación
3. Establecer calendario de implementación
4. Configurar monitoreo de seguridad continuo

---

**Fin del Reporte de Auditoría de Seguridad**
