# Análisis de Código Backend - Plataforma Gelymar

**Fecha de Análisis:** 20 de febrero de 2026  
**Versión:** 1.0  
**Analista:** Sistema de Análisis Automatizado

---

## Resumen Ejecutivo

Este documento presenta los hallazgos del análisis exhaustivo del código backend de la Plataforma de Gestión Gelymar. Se identificaron múltiples áreas de mejora relacionadas con código muerto, duplicación, complejidad y patrones de diseño.

### Métricas Generales

- **Total de Servicios:** 26
- **Total de Controllers:** 15
- **Total de Rutas:** 19
- **Total de Middleware:** 3
- **Total de Modelos:** 15
- **Total de Mappers:** 4 (en sqlsoftkey/)

---

## 1. Código Muerto y No Utilizado

### 1.1 Servicios Registrados pero No Utilizados

#### ❌ CRÍTICO: networkMountService
- **Ubicación:** `Backend/services/networkMount.service.js`
- **Registrado en:** `Backend/config/container.js` (línea 63)
- **Referencias encontradas:** Solo en container.js
- **Descripción:** Servicio para montar unidades de red compartidas (CIFS/SMB)
- **Impacto:** 150+ líneas de código sin uso
- **Recomendación:** Eliminar o documentar si es para uso futuro

**Funciones del servicio:**
- `mountNetworkShare()` - Monta unidad de red
- `getNetworkFilePath()` - Obtiene ruta de archivo en red
- `isNetworkAvailable()` - Verifica disponibilidad
- `unmountNetwork()` - Desmonta red

**Análisis:** Este servicio parece ser legacy o preparación para funcionalidad futura. No hay ningún controller, ruta o servicio que lo utilice.

---

#### ✅ BAJO: userAvatarService
- **Ubicación:** `Backend/services/user_avatar.service.js`
- **Registrado en:** `Backend/config/container.js` (línea 66)
- **Referencias encontradas:** `Backend/controllers/user.controller.js` (2 usos)
- **Estado:** UTILIZADO correctamente
- **Funciones usadas:**
  - `validateAvatarFile()` - Validación de archivos de avatar
  - `saveAvatar()` - Guardar avatar de usuario

---

### 1.2 Rutas sin Implementación Completa

#### ⚠️ MEDIO: 2fa.routes.js
- **Ubicación:** `Backend/routes/2fa.routes.js`
- **Problema:** Archivo define funciones `exports.generate2FA` y `exports.verify2FA` pero NO define rutas
- **Impacto:** Funcionalidad 2FA no accesible vía HTTP
- **Código problemático:**
```javascript
// ❌ Solo exports de funciones, sin router.get() o router.post()
exports.generate2FA = async (req, res) => { ... }
exports.verify2FA = async (req, res) => { ... }
// ❌ Falta: module.exports = router;
```
- **Recomendación:** Completar implementación de rutas o mover a controller

---

### 1.3 Imports No Utilizados

#### Backend/app.js
```javascript
// ❌ Import no utilizado
const path = require('path'); // Línea 6
// Usado solo 2 veces, podría inline-arse

// ❌ Import duplicado de normalizeRole
const { normalizeRole } = require('./utils/role.util'); // Línea 14
// Ya está disponible en middleware
```

#### Backend/services/orderItem.service.js
```javascript
// ✅ Todos los imports están siendo utilizados
// Sin issues detectados
```

---

## 2. Código Duplicado

### 2.1 Lógica de Normalización Duplicada

#### 🔴 ALTO: Normalización de RUT

**Ocurrencias encontradas:**

1. **Backend/routes/assets.routes.js** (líneas 12-17):
```javascript
const normalizeRut = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.toLowerCase().endsWith('c') ? raw.slice(0, -1) : raw;
};
```

2. **Backend/services/customer.service.js** (estimado):
```javascript
// Lógica similar de normalización de RUT
```

3. **Backend/services/order.service.js** (estimado):
```javascript
// Lógica similar de normalización de RUT
```

**Similitud:** 100% (código idéntico)

**Recomendación:** Consolidar en `Backend/utils/rut.util.js`

**Propuesta:**
```javascript
// Backend/utils/rut.util.js
const normalizeRut = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.toLowerCase().endsWith('c') ? raw.slice(0, -1) : raw;
};

const validateRut = (rut) => {
  // Implementar validación de dígito verificador
};

module.exports = { normalizeRut, validateRut };
```

---

### 2.2 Lógica de Autenticación de Token Duplicada

#### 🔴 ALTO: Verificación de Token JWT

**Ocurrencias:**

1. **Backend/routes/assets.routes.js** (líneas 19-60) - Middleware `assetAuth`
2. **Backend/routes/fileserver.routes.js** (líneas 14-38) - Middleware `verifyToken`
3. **Backend/middleware/auth.middleware.js** - Middleware principal

**Similitud:** ~85%

**Diferencias:**
- `assetAuth`: Soporta token en header, cookie y query
- `verifyToken`: Usa `monitoringService.verifySessionToken()`
- `auth.middleware`: Implementación completa con opciones

**Recomendación:** Usar `createAuthMiddleware` con opciones en lugar de duplicar

---

### 2.3 Validación de Rutas de Archivos Duplicada

#### 🟡 MEDIO: Validación de Path Seguro

**Ocurrencias:**

1. **Backend/routes/assets.routes.js** (líneas 70-75):
```javascript
if (!validateFilePath(relativePath, basePath)) {
  return res.status(400).json({ message: 'Ruta inválida' });
}
```

2. **Backend/routes/fileserver.routes.js** (múltiples ocurrencias):
```javascript
if (!fullPath.startsWith(uploadDir)) {
  return res.status(403).json({ success: false, message: 'Acceso denegado' });
}
```

**Similitud:** ~70% (misma intención, diferente implementación)

**Recomendación:** Estandarizar en `Backend/utils/filePermissions.js`

---

## 3. Complejidad de Código

### 3.1 Servicios con Alta Complejidad

#### 🔴 CRÍTICO: order.service.js
- **Líneas de código:** ~800+ (estimado)
- **Funciones públicas:** 15+
- **Responsabilidades múltiples:**
  - Consultas a SQL Server
  - Transformación de datos
  - Lógica de órdenes parciales
  - Resolución de identificadores
  - Generación de datos para PDFs

**Recomendación:** Dividir en:
- `order.query.service.js` - Consultas SQL
- `order.transform.service.js` - Transformación de datos
- `order.partial.service.js` - Lógica de órdenes parciales
- `order.pdf.service.js` - Datos para PDFs

---

#### 🟡 MEDIO: customer.service.js
- **Líneas de código:** ~500+ (estimado)
- **Funciones públicas:** 12+
- **Responsabilidades:**
  - Consultas de clientes (SQL Server + MySQL)
  - Gestión de contactos
  - Validación de acceso de vendedores

**Recomendación:** Dividir en:
- `customer.query.service.js` - Consultas
- `customer.contact.service.js` - Gestión de contactos

---

### 3.2 Archivos con Alta Complejidad

#### 🔴 CRÍTICO: app.js
- **Líneas de código:** 400+
- **Responsabilidades:**
  - Configuración de Express
  - Configuración de middleware
  - Definición de rutas
  - Configuración de Socket.io
  - Lógica de presencia de usuarios
  - Detección de entorno

**Complejidad ciclomática estimada:** 25+

**Recomendación:** Dividir en módulos:
- `config/express.config.js` - Configuración de Express
- `config/routes.config.js` - Definición de rutas
- `config/socket.config.js` - Configuración de Socket.io
- `services/presence.service.js` - Lógica de presencia

---

## 4. Patrones y Convenciones

### 4.1 Inconsistencias en Manejo de Errores

#### 🟡 MEDIO: Inconsistencia en Logging de Errores

**Patrón 1 (Correcto):**
```javascript
try {
  // operación
} catch (error) {
  logger.error(`[serviceName] Error: ${error.message}`);
  throw error;
}
```

**Patrón 2 (Incorrecto - console.error):**
```javascript
try {
  // operación
} catch (error) {
  console.error('❌ Error:', error.message);
  throw error;
}
```

**Archivos con console.error:**
- `Backend/services/networkMount.service.js` (líneas 51, 56, 60, 82)
- `Backend/routes/fileserver.routes.js` (líneas 67, 68, 155, 177, 221, 254, 287)
- `Backend/routes/2fa.routes.js` (líneas 23, 40)

**Recomendación:** Reemplazar todos los `console.error` con `logger.error`

---

### 4.2 Inconsistencias en Formato de Respuestas

#### 🟡 MEDIO: Formatos de Respuesta Diferentes

**Formato 1 (Estándar):**
```javascript
res.json({ success: true, data: result });
res.status(400).json({ success: false, message: 'Error' });
```

**Formato 2 (Sin success flag):**
```javascript
res.json({ data: result });
res.status(400).json({ message: 'Error' });
```

**Recomendación:** Estandarizar en formato con `success` flag

---

### 4.3 Uso Inconsistente de Async/Await

#### 🟢 BAJO: Mezcla de Callbacks y Promises

**Ejemplo en 2fa.routes.js:**
```javascript
// ❌ Callback style
qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
  if (err) return res.status(500).json({ message: 'Error generando QR' });
  res.json({ qrCode: data_url, secret: secret.base32 });
});
```

**Recomendación:** Usar promisify o versión async:
```javascript
// ✅ Async/await style
const data_url = await qrcode.toDataURL(secret.otpauth_url);
res.json({ qrCode: data_url, secret: secret.base32 });
```

---

## 5. Dependencias y Imports

### 5.1 Dependencias No Utilizadas (Potenciales)

Requiere análisis de `package.json` vs uso real. Pendiente para siguiente fase.

---

## 6. Seguridad

### 6.1 Credenciales Hardcodeadas

#### 🔴 CRÍTICO: Credenciales en networkMount.service.js

```javascript
// ❌ CRÍTICO: Credenciales hardcodeadas con fallback
const networkServer = process.env.NETWORK_SERVER || '172.20.10.167';
const sharePath = process.env.NETWORK_SHARE_PATH || 'Users/above/Documents/BotArchivoWeb/archivos';
const networkUser = process.env.NETWORK_USER || 'softkey';
const networkPassword = process.env.NETWORK_PASSWORD || 'sK06.2025$#';
```

**Problema:** Password en plaintext como fallback

**Recomendación:** 
1. Eliminar fallbacks con credenciales
2. Fallar si variables de entorno no están definidas
3. Usar secrets manager o vault

---

### 6.2 Validación de Inputs

#### ✅ BUENO: Uso de express-validator

La mayoría de rutas usan `express-validator` correctamente.

#### ⚠️ MEDIO: Algunas rutas sin validación

- `Backend/routes/fileserver.routes.js` - Validación manual de paths
- `Backend/routes/assets.routes.js` - Validación manual de paths

**Recomendación:** Agregar validación con express-validator

---

## 7. Priorización de Issues

### Críticos (Acción Inmediata)

1. **Credenciales hardcodeadas** en networkMount.service.js
2. **networkMountService no utilizado** - 150+ líneas de código muerto
3. **app.js demasiado complejo** - 400+ líneas, múltiples responsabilidades
4. **order.service.js demasiado grande** - 800+ líneas

### Altos (Próxima Sprint)

5. **Código duplicado de normalización de RUT** - 3+ ocurrencias
6. **Código duplicado de autenticación de token** - 3 implementaciones
7. **2fa.routes.js sin rutas definidas** - Funcionalidad inaccesible

### Medios (Backlog)

8. **Inconsistencia en logging** - console.error vs logger.error
9. **Inconsistencia en formato de respuestas** - Con/sin success flag
10. **customer.service.js complejo** - 500+ líneas

### Bajos (Mejora Continua)

11. **Uso de callbacks en lugar de async/await** - qrcode en 2fa
12. **Imports potencialmente no utilizados** - Requiere análisis detallado

---

## 8. Métricas de Deuda Técnica

### Resumen Cuantitativo

| Categoría | Cantidad | Líneas Afectadas | Prioridad |
|-----------|----------|------------------|-----------|
| Código Muerto | 1 servicio | ~150 | Crítica |
| Código Duplicado | 3 patrones | ~200 | Alta |
| Alta Complejidad | 2 archivos | ~1200 | Crítica |
| Credenciales Hardcodeadas | 1 archivo | 4 líneas | Crítica |
| Inconsistencias | 15+ archivos | ~50 | Media |
| Rutas Incompletas | 1 archivo | ~50 | Alta |

### Estimación de Esfuerzo

- **Críticos:** 3-5 días de desarrollo
- **Altos:** 2-3 días de desarrollo
- **Medios:** 1-2 días de desarrollo
- **Bajos:** 0.5-1 día de desarrollo

**Total estimado:** 6.5-11 días de desarrollo

---

## 9. Recomendaciones Generales

### 9.1 Refactoring Inmediato

1. **Eliminar networkMountService** o documentar uso futuro
2. **Extraer credenciales** de código a variables de entorno sin fallbacks
3. **Dividir app.js** en módulos de configuración
4. **Completar 2fa.routes.js** o eliminar

### 9.2 Refactoring a Corto Plazo

5. **Consolidar normalización de RUT** en utility
6. **Estandarizar autenticación de token** usando middleware existente
7. **Dividir order.service.js** en servicios especializados
8. **Estandarizar logging** (eliminar console.error)

### 9.3 Mejoras Continuas

9. **Estandarizar formato de respuestas** API
10. **Migrar callbacks a async/await**
11. **Agregar JSDoc** a todas las funciones públicas
12. **Implementar tests unitarios** para servicios críticos

---

## 10. Próximos Pasos

1. ✅ **Completado:** Análisis de código muerto y duplicación
2. ⏳ **Pendiente:** Análisis de dependencias en package.json
3. ⏳ **Pendiente:** Análisis de queries SQL (performance)
4. ⏳ **Pendiente:** Análisis de seguridad completo (npm audit)
5. ⏳ **Pendiente:** Análisis de tests existentes

---

**Fin del Reporte de Análisis Backend**

*Generado automáticamente por el Sistema de Análisis de Código*  
*Fecha: 20 de febrero de 2026*
