// Función para detectar la URL de la API automáticamente
function getDefaultApiUrl(): string {
  if (typeof window !== 'undefined') {
    // En el cliente, usar la misma URL base pero con puerto 3000
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3000`;
  }
  
  // En el servidor, detectar si estamos en producción
  if (process.env.NODE_ENV === 'production') {
    return 'http://172.20.10.151:3000';
  }
  
  return 'http://localhost:3000';
}

// Función para detectar la URL del frontend automáticamente
function getDefaultFrontendUrl(): string {
  if (typeof window !== 'undefined') {
    // En el cliente, usar la URL actual
    const { protocol, hostname, port } = window.location;
    return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
  }
  
  // En el servidor, detectar si estamos en producción
  if (process.env.NODE_ENV === 'production') {
    return 'http://172.20.10.151:2121';
  }
  
  return 'http://localhost:2121';
}

// Configuración dinámica basada en el entorno
export const config = {
  // URLs de la API - se detectan automáticamente
  apiUrl: process.env.NEXT_PUBLIC_API_URL || getDefaultApiUrl(),
  frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_BASE_URL || getDefaultFrontendUrl(),
  
  // Información de la aplicación
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Gelymar Management Platform',
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
  
  // Configuración de desarrollo vs producción
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Configuración de la API
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    timeout: 30000, // 30 segundos
    retries: 3,
  },
  
  // Configuración de autenticación
  auth: {
    tokenKey: 'token',
    userRoleKey: 'userRole',
    userEmailKey: 'userEmail',
    tokenExpiryWarning: 5, // minutos antes de expirar
  },
  
  // Configuración de UI
  ui: {
    defaultTheme: 'light',
    enableDarkMode: true,
    enableAnimations: true,
  },
  
  // Configuración de seguridad
  security: {
    enableCSP: true,
    enableHSTS: process.env.NODE_ENV === 'production',
    enableXSSProtection: true,
  },
} as const;

// Función para obtener la URL completa de la API
export const getApiUrl = (endpoint: string = '') => {
  const baseUrl = config.api.baseUrl.endsWith('/') 
    ? config.api.baseUrl.slice(0, -1) 
    : config.api.baseUrl;
  
  const cleanEndpoint = endpoint.startsWith('/') 
    ? endpoint 
    : `/${endpoint}`;
    
  return `${baseUrl}${cleanEndpoint}`;
};

// Función para detectar si estamos en el servidor de producción
export const isProductionServer = () => {
  if (typeof window === 'undefined') {
    // En el servidor
    return process.env.NODE_ENV === 'production';
  }
  
  // En el cliente, detectar por hostname
  const hostname = window.location.hostname;
  return hostname === '172.20.10.151' || 
         hostname.includes('172.20.10.151') ||
         hostname !== 'localhost' && hostname !== '127.0.0.1';
};

// Función para obtener la configuración según el entorno
export const getEnvironmentConfig = () => {
  const isProd = isProductionServer();
  
  return {
    ...config,
    environment: isProd ? 'production' : 'development',
  };
};
