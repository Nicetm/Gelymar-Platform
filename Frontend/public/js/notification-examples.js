// ===== EJEMPLOS DE USO DE NOTIFICACIONES =====
// Este archivo muestra cómo usar las diferentes notificaciones con colores

// Importar las funciones de notificación
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

// ===== EJEMPLOS DE USO =====

// 1. Notificación de éxito (verde)
showSuccessNotification('¡Operación completada exitosamente!');

// 2. Notificación de error (rojo)
showErrorNotification('Ha ocurrido un error en el sistema');

// 3. Notificación de advertencia (amarillo/naranja)
showWarningNotification('Atención: Los datos no se han guardado');

// 4. Notificación de información (azul)
showInfoNotification('Nuevo mensaje recibido');

// 5. Notificación de peligro (rojo oscuro)
showDangerNotification('¡Acceso denegado!');

// 6. Notificación primaria (azul oscuro)
showPrimaryNotification('Configuración actualizada');

// 7. Notificación secundaria (gris)
showSecondaryNotification('Proceso en segundo plano');

// 8. Notificación oscura (negro)
showDarkNotification('Modo oscuro activado');

// 9. Notificación clara (gris claro)
showLightNotification('Modo claro activado');

// 10. Usando la función general con tipos específicos
showNotification('Mensaje personalizado', 'success', 5000);
showNotification('Error crítico', 'error', 6000);
showNotification('Advertencia importante', 'warning', 4000);
showNotification('Información del sistema', 'info', 3000);

// ===== EJEMPLOS EN CONTEXTOS ESPECÍFICOS =====

// En formularios
const handleFormSubmit = () => {
    try {
        // Procesar formulario
        showSuccessNotification('Formulario enviado correctamente');
    } catch (error) {
        showErrorNotification('Error al enviar el formulario');
    }
};

// En operaciones de archivos
const handleFileUpload = (success) => {
    if (success) {
        showSuccessNotification('Archivo subido exitosamente');
    } else {
        showErrorNotification('Error al subir el archivo');
    }
};

// En validaciones
const validateUserInput = (input) => {
    if (!input) {
        showWarningNotification('Por favor, complete todos los campos');
        return false;
    }
    return true;
};

// En operaciones de base de datos
const handleDatabaseOperation = (operation) => {
    switch (operation.status) {
        case 'success':
            showSuccessNotification('Datos guardados correctamente');
            break;
        case 'error':
            showErrorNotification('Error al guardar los datos');
            break;
        case 'warning':
            showWarningNotification('Algunos datos no se pudieron procesar');
            break;
        default:
            showInfoNotification('Operación completada');
    }
};

// En autenticación
const handleLogin = (success) => {
    if (success) {
        showSuccessNotification('Inicio de sesión exitoso');
    } else {
        showDangerNotification('Credenciales incorrectas');
    }
};

// En notificaciones del sistema
const showSystemNotification = (type, message) => {
    switch (type) {
        case 'update':
            showPrimaryNotification(message);
            break;
        case 'maintenance':
            showWarningNotification(message);
            break;
        case 'security':
            showDangerNotification(message);
            break;
        default:
            showInfoNotification(message);
    }
};

// ===== FUNCIONES DE CONVENIENCIA PARA CASOS COMUNES =====

// Para operaciones CRUD
const showCrudNotification = (operation, success) => {
    const messages = {
        create: { success: 'Registro creado exitosamente', error: 'Error al crear el registro' },
        read: { success: 'Datos cargados correctamente', error: 'Error al cargar los datos' },
        update: { success: 'Registro actualizado exitosamente', error: 'Error al actualizar el registro' },
        delete: { success: 'Registro eliminado exitosamente', error: 'Error al eliminar el registro' }
    };
    
    const message = messages[operation][success ? 'success' : 'error'];
    const type = success ? 'success' : 'error';
    
    showNotification(message, type);
};

// Para validaciones de formularios
const showValidationNotification = (field, isValid) => {
    if (isValid) {
        showSuccessNotification(`${field} es válido`);
    } else {
        showWarningNotification(`${field} no es válido`);
    }
};

// Para operaciones de archivos
const showFileNotification = (operation, success) => {
    const messages = {
        upload: { success: 'Archivo subido correctamente', error: 'Error al subir el archivo' },
        download: { success: 'Descarga iniciada', error: 'Error al descargar el archivo' },
        delete: { success: 'Archivo eliminado', error: 'Error al eliminar el archivo' },
        rename: { success: 'Archivo renombrado', error: 'Error al renombrar el archivo' }
    };
    
    const message = messages[operation][success ? 'success' : 'error'];
    const type = success ? 'success' : 'error';
    
    showNotification(message, type);
};

// Exportar funciones de conveniencia
export {
    showCrudNotification,
    showValidationNotification,
    showFileNotification,
    showSystemNotification
}; 