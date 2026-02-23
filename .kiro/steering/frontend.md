---
inclusion: always
---

# Frontend

## Stack Tecnológico

- **Framework**: Astro 5.x con SSR (Server-Side Rendering)
- **UI**: React 19.x components
- **Estilos**: Tailwind CSS 3.x
- **Librería de componentes**: Flowbite
- **Build tool**: Vite (integrado en Astro)
- **Lenguaje**: TypeScript con modo estricto
- **Tiempo real**: Socket.io client

## Arquitectura Multi-Contexto

La aplicación frontend se construye en 3 contextos separados usando la variable de entorno `APP_CONTEXT`:

### 1. Admin Portal (APP_CONTEXT=admin)
- **Puerto**: 2121
- **Usuarios**: Administradores
- **Funcionalidades**:
  - Gestión completa de usuarios
  - Visualización de todas las órdenes
  - Configuración del sistema
  - Gestión de cron jobs
  - Chat con todos los clientes
  - Generación manual de documentos
  - Reportes y estadísticas

### 2. Client Portal (APP_CONTEXT=client)
- **Puerto**: 2122 (dev) / 443 (prod con Cloudflare)
- **URL Producción**: https://logistic.gelymar.cl
- **Usuarios**: Clientes
- **Funcionalidades**:
  - Visualización de sus propias órdenes
  - Descarga de documentos visibles
  - Chat con administradores
  - Actualización de datos de contacto
  - Visualización de items de órdenes

### 3. Seller Portal (APP_CONTEXT=seller)
- **Puerto**: 2123
- **Usuarios**: Vendedores
- **Funcionalidades**:
  - Visualización de órdenes de sus clientes
  - Gestión de contactos de clientes
  - Reportes de ventas
  - Chat (si implementado)

## Estructura del Proyecto

```
Frontend/
├── src/
│   ├── app/                  # Lógica específica de la app
│   ├── components/           # Componentes React/Astro reutilizables
│   ├── layouts/              # Layouts de página
│   ├── pages/                # Páginas Astro (rutas)
│   │   ├── admin/           # Páginas del portal admin
│   │   ├── client/          # Páginas del portal cliente
│   │   └── seller/          # Páginas del portal vendedor
│   ├── modules/              # Módulos de funcionalidad
│   ├── services/             # Servicios cliente API
│   ├── lib/                  # Librerías compartidas
│   ├── utils/                # Funciones utilitarias
│   ├── types/                # Tipos TypeScript
│   ├── i18n/                 # Internacionalización
│   ├── styles/               # Estilos globales
│   ├── scripts/              # Scripts del lado del cliente
│   └── middleware.ts         # Middleware Astro
├── public/                   # Assets estáticos
└── dist/                     # Salida del build
```

## Comandos de Desarrollo

### Desarrollo (por contexto)
```bash
npm run dev:admin    # Puerto 2121
npm run dev:client   # Puerto 2122
npm run dev:seller   # Puerto 2123
```

### Build (por contexto)
```bash
npm run build:admin
npm run build:client
npm run build:seller
```

### Preview
```bash
npm run preview:admin
npm run preview:client
npm run preview:seller
```

## Configuración de Contexto

### astro.config.mjs
```javascript
const APP_CONTEXT = process.env.APP_CONTEXT || 'admin';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  // Configuración específica por contexto
  base: APP_CONTEXT === 'admin' ? '/admin/' : 
        APP_CONTEXT === 'client' ? '/client/' : '/seller/',
  // ...
});
```

### Variables de Entorno
```bash
# Contexto de la aplicación
APP_CONTEXT=admin|client|seller

# URLs
PUBLIC_API_URL=http://localhost:3000
PUBLIC_API_BASE_URL=http://localhost:3000/api
PUBLIC_FILE_SERVER_URL=http://localhost:8080

# Idioma
PUBLIC_LANG=en|es

# reCAPTCHA
PUBLIC_RECAPTCHA_SITE_KEY=6LeO8vMrAAAAAFJ65A9RTu-wmPYdg-2lSwTtrwXJ
```

## Autenticación en Frontend

### Login Flow
1. Usuario ingresa email/password
2. Frontend envía POST a `/api/auth/login`
3. Backend valida credenciales
4. Si 2FA habilitado, solicita código TOTP
5. Backend retorna JWT token
6. Frontend almacena token en cookie
7. Redirección según rol:
   - Admin → `/admin/dashboard`
   - Client → `/client/orders`
   - Seller → `/seller/customers`

### Middleware de Autenticación (middleware.ts)
```typescript
export const onRequest = async (context, next) => {
  const token = context.cookies.get('token');
  
  if (!token && isProtectedRoute(context.url.pathname)) {
    return context.redirect('/login');
  }
  
  // Validar token y adjuntar usuario a context
  const user = await validateToken(token);
  context.locals.user = user;
  
  return next();
};
```

### Protección de Rutas
```typescript
// En páginas protegidas
---
const user = Astro.locals.user;
if (!user) {
  return Astro.redirect('/login');
}

// Validar rol
if (user.role !== 'admin') {
  return Astro.redirect('/unauthorized');
}
---
```

## Servicios API (Frontend/src/services/)

### Patrón de Servicio
```typescript
// services/orderService.ts
import { apiClient } from './apiClient';

export const orderService = {
  async getOrders(filters?: { customerRut?: string; salesRut?: string }) {
    const response = await apiClient.get('/orders', { params: filters });
    return response.data;
  },
  
  async getOrderById(orderId: string) {
    const response = await apiClient.get(`/orders/${orderId}`);
    return response.data;
  },
  
  async getOrderItems(orderId: string) {
    const response = await apiClient.get(`/orders/${orderId}/items`);
    return response.data;
  }
};
```

### API Client (con interceptores)
```typescript
// services/apiClient.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.PUBLIC_API_BASE_URL,
  withCredentials: true
});

// Interceptor para adjuntar token
apiClient.interceptors.request.use((config) => {
  const token = getCookie('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirigir a login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## Socket.io en Frontend

### Conexión
```typescript
// lib/socket.ts
import { io } from 'socket.io-client';

const token = getCookie('token');

export const socket = io(import.meta.env.PUBLIC_API_URL, {
  auth: { token },
  autoConnect: false
});

// Conectar cuando sea necesario
socket.connect();
```

### Eventos (Admin)
```typescript
// Escuchar nuevos mensajes
socket.on('newMessage', (message) => {
  // Actualizar UI con nuevo mensaje
  updateChatUI(message);
});

// Escuchar actualizaciones de presencia
socket.on('userPresenceUpdated', ({ userId, online }) => {
  // Actualizar estado de usuario
  updateUserStatus(userId, online);
});

// Enviar mensaje
socket.emit('sendMessage', {
  customerId: '12345678-9',
  message: 'Hola, ¿en qué puedo ayudarte?',
  type: 'text'
});
```

### Eventos (Client)
```typescript
// Escuchar mensajes del admin
socket.on('newMessage', (message) => {
  if (message.senderType === 'admin') {
    updateChatUI(message);
    playNotificationSound();
  }
});

// Enviar mensaje
socket.emit('sendMessage', {
  customerId: currentUser.rut,
  message: 'Necesito ayuda con mi orden',
  type: 'text'
});
```

## Componentes Principales

### Componentes React
```typescript
// components/OrderList.tsx
interface OrderListProps {
  orders: Order[];
  onOrderClick: (orderId: string) => void;
}

export const OrderList: React.FC<OrderListProps> = ({ orders, onOrderClick }) => {
  return (
    <div className="space-y-4">
      {orders.map(order => (
        <OrderCard 
          key={order.pc} 
          order={order} 
          onClick={() => onOrderClick(order.pc)}
        />
      ))}
    </div>
  );
};
```

### Componentes Astro
```astro
---
// components/Layout.astro
interface Props {
  title: string;
  user?: User;
}

const { title, user } = Astro.props;
---

<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>{title}</title>
  </head>
  <body>
    <Header user={user} />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

## Internacionalización (i18n)

### Estructura
```
src/i18n/
├── en.json
├── es.json
└── index.ts
```

### Uso
```typescript
import { t } from '@i18n';

const greeting = t('common.greeting'); // "Hola" o "Hello"
```

## Estilos (Tailwind CSS)

### Configuración
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',
        secondary: '#64748b'
      }
    }
  },
  plugins: [require('flowbite/plugin')]
};
```

## Module Aliases

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@components/*": ["./src/components/*"],
      "@layouts/*": ["./src/layouts/*"],
      "@lib/*": ["./src/lib/*"],
      "@utils/*": ["./src/utils/*"],
      "@types/*": ["./src/types/*"],
      "@i18n/*": ["./src/i18n/*"],
      "@app/*": ["./src/app/*"]
    }
  }
}
```

## Build y Deployment

### Build para Producción
```bash
# Admin
APP_CONTEXT=admin npm run build

# Client
APP_CONTEXT=client npm run build

# Seller
APP_CONTEXT=seller npm run build
```

### Salida
```
dist/
├── client/          # Build del cliente
├── server/          # Código del servidor SSR
└── _astro/          # Assets optimizados
```

## Consideraciones de Performance

- **Code Splitting**: Automático por ruta
- **Image Optimization**: Astro optimiza imágenes automáticamente
- **Lazy Loading**: Componentes React con `React.lazy()`
- **Prefetching**: Links prefetch automático en viewport
- **Caching**: Assets con hash para cache infinito

## Accesibilidad

- Uso de etiquetas semánticas HTML5
- ARIA labels donde sea necesario
- Navegación por teclado
- Contraste de colores WCAG AA
- Textos alternativos en imágenes
