# Sistema de Notificaciones con Colores

Este documento explica cómo usar el sistema de notificaciones con diferentes colores en la plataforma Gelymar.

## Tipos de Notificaciones Disponibles

### 1. Success (Verde)
- **Color**: `#10b981` (verde)
- **Uso**: Para operaciones exitosas
- **Función**: `showSuccessNotification(message, duration)`

```javascript
showSuccessNotification('¡Operación completada exitosamente!');
```

### 2. Error (Rojo)
- **Color**: `#ef4444` (rojo)
- **Uso**: Para errores del sistema
- **Función**: `showErrorNotification(message, duration)`

```javascript
showErrorNotification('Ha ocurrido un error en el sistema');
```

### 3. Warning (Amarillo/Naranja)
- **Color**: `#f59e0b` (amarillo/naranja)
- **Uso**: Para advertencias y alertas
- **Función**: `showWarningNotification(message, duration)`

```javascript
showWarningNotification('Atención: Los datos no se han guardado');
```

### 4. Info (Azul)
- **Color**: `#3b82f6` (azul)
- **Uso**: Para información general
- **Función**: `showInfoNotification(message, duration)`

```javascript
showInfoNotification('Nuevo mensaje recibido');
```

### 5. Danger (Rojo Oscuro)
- **Color**: `#dc2626` (rojo oscuro)
- **Uso**: Para errores críticos o peligros
- **Función**: `showDangerNotification(message, duration)`

```javascript
showDangerNotification('¡Acceso denegado!');
```

### 6. Primary (Azul Oscuro)
- **Color**: `#2563eb` (azul oscuro)
- **Uso**: Para acciones principales
- **Función**: `showPrimaryNotification(message, duration)`

```javascript
showPrimaryNotification('Configuración actualizada');
```

### 7. Secondary (Gris)
- **Color**: `#6b7280` (gris)
- **Uso**: Para acciones secundarias
- **Función**: `showSecondaryNotification(message, duration)`

```javascript
showSecondaryNotification('Proceso en segundo plano');
```

### 8. Dark (Negro)
- **Color**: `#1f2937` (negro)
- **Uso**: Para modo oscuro o temas especiales
- **Función**: `showDarkNotification(message, duration)`

```javascript
showDarkNotification('Modo oscuro activado');
```

### 9. Light (Gris Claro)
- **Color**: `#f3f4f6` (gris claro)
- **Uso**: Para modo claro o temas especiales
- **Función**: `showLightNotification(message, duration)`

```javascript
showLightNotification('Modo claro activado');
```

## Función General

También puedes usar la función general `showNotification` con cualquier tipo:

```javascript
showNotification(message, type, duration);
```

**Parámetros:**
- `message`: El mensaje a mostrar
- `type`: El tipo de notificación ('success', 'error', 'warning', 'info', 'danger', 'primary', 'secondary', 'dark', 'light')
- `duration`: Duración en milisegundos (opcional, por defecto 4000ms)

## Ejemplos de Uso por Contexto

### Formularios
```javascript
const handleFormSubmit = () => {
    try {
        // Procesar formulario
        showSuccessNotification('Formulario enviado correctamente');
    } catch (error) {
        showErrorNotification('Error al enviar el formulario');
    }
};
```

### Operaciones CRUD
```javascript
const handleCreateRecord = async () => {
    try {
        await createRecord(data);
        showSuccessNotification('Registro creado exitosamente');
    } catch (error) {
        showErrorNotification('Error al crear el registro');
    }
};
```

### Validaciones
```javascript
const validateEmail = (email) => {
    if (!email.includes('@')) {
        showWarningNotification('Por favor, ingrese un email válido');
        return false;
    }
    return true;
};
```

### Autenticación
```javascript
const handleLogin = async (credentials) => {
    try {
        const response = await login(credentials);
        if (response.success) {
            showSuccessNotification('Inicio de sesión exitoso');
        } else {
            showDangerNotification('Credenciales incorrectas');
        }
    } catch (error) {
        showErrorNotification('Error en el servidor');
    }
};
```

### Operaciones de Archivos
```javascript
const handleFileUpload = async (file) => {
    try {
        await uploadFile(file);
        showSuccessNotification('Archivo subido exitosamente');
    } catch (error) {
        showErrorNotification('Error al subir el archivo');
    }
};
```

## Características del Sistema

### 1. Cola de Notificaciones
- Máximo 3 notificaciones simultáneas
- Las notificaciones se procesan en cola
- No se muestran notificaciones duplicadas

### 2. Posicionamiento
- Aparecen en la esquina superior derecha
- Se apilan verticalmente
- Se reposicionan automáticamente

### 3. Animaciones
- Entrada suave desde la derecha
- Salida suave hacia la derecha
- Transiciones fluidas

### 4. Auto-eliminación
- Se eliminan automáticamente después del tiempo especificado
- Duración por defecto: 4000ms (4 segundos)

## Importación

Para usar las notificaciones, importa las funciones desde `utils.js`:

```javascript
import {
    showNotification,
    showSuccessNotification,
    showErrorNotification,
    showWarningNotification,
    showInfoNotification,
    showDangerNotification,
    showPrimaryNotification,
    showSecondaryNotification,
    showDarkNotification,
    showLightNotification
} from './utils.js';
```

## Personalización

Si necesitas agregar nuevos tipos de notificaciones, puedes modificar el objeto `colorMap` en `utils.js`:

```javascript
const colorMap = {
    // ... tipos existentes ...
    custom: { bg: '#your-color', text: '#your-text-color' }
};
```

Y agregar el icono correspondiente en el objeto `icons`. 