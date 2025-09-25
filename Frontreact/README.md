# Gelymar Management Platform - Frontend React

Sistema de gestión de documentos y logística para operaciones de exportación, desarrollado con React 19 y Next.js 15.

## 🚀 Características

- **React 19** con las últimas funcionalidades
- **Next.js 15** con App Router
- **TypeScript** para tipado estático
- **Tailwind CSS 4** para estilos
- **Zustand** para gestión de estado
- **Autenticación 2FA** completa
- **Detección automática de entorno** (desarrollo/producción)

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Desarrollo local
npm run dev

# Build para producción
npm run build

# Iniciar en producción
npm start
```

## 🔧 Configuración

### Variables de Entorno

El sistema detecta automáticamente el entorno y configura las URLs correspondientes:

- **Desarrollo**: `localhost:3000` → API en `localhost:3001`
- **Producción**: `172.20.10.151:3000` → API en `172.20.10.151:3001`

### Archivos de Configuración

- `.env.local` - Configuración local de desarrollo
- `.env.development` - Configuración de desarrollo
- `.env.production` - Configuración de producción

## 🐳 Docker

### Build y Deploy

```bash
# Build de la imagen
npm run docker:build

# Ejecutar contenedor
npm run docker:run

# Deploy completo con docker-compose
npm run docker:deploy
```

### Docker Compose

El archivo `docker-compose.yml` está configurado para:
- Puerto 3000
- Red `gelymar-network`
- Variables de entorno de producción
- Restart automático

## 🌐 Despliegue en Producción

### Opción 1: Docker (Recomendado)

```bash
# 1. Clonar el repositorio en el servidor
git clone <repository-url>
cd Frontreact

# 2. Deploy con Docker Compose
npm run docker:deploy
```

### Opción 2: Build Manual

```bash
# 1. Build para producción
npm run build

# 2. Iniciar servidor
npm start
```

## 🔒 Seguridad

- Headers de seguridad configurados
- Validación de tokens JWT
- Protección de rutas por roles
- Autenticación de dos factores
- CSP (Content Security Policy)

## 📱 Funcionalidades

- ✅ Sistema de login con 2FA
- ✅ Rutas protegidas por roles (Admin/Cliente)
- ✅ Detección automática de entorno
- ✅ Modo oscuro/claro
- ✅ Responsive design
- ✅ Gestión de estado con Zustand
- ✅ Validación de formularios con Zod

## 🛠️ Tecnologías

- **React 19.1.1**
- **Next.js 15.5.4**
- **TypeScript 5.9.2**
- **Tailwind CSS 4.1.13**
- **Zustand 5.0.8**
- **React Hook Form 7.63.0**
- **Zod 4.1.11**
- **Socket.io Client 4.8.1**

## 📂 Estructura del Proyecto

```
src/
├── app/                 # App Router de Next.js
│   ├── auth/login/     # Página de login
│   ├── admin/          # Panel de administración
│   ├── client/         # Panel de cliente
│   └── globals.css     # Estilos globales
├── components/         # Componentes reutilizables
├── lib/               # Utilidades y configuración
├── store/             # Estado global (Zustand)
└── types/             # Tipos TypeScript
```

## 🔄 Detección Automática de Entorno

El sistema detecta automáticamente si está ejecutándose en:
- **Desarrollo**: `localhost` o `127.0.0.1`
- **Producción**: `172.20.10.151` o cualquier otro hostname

No es necesario configurar manualmente las URLs de la API.

## 📞 Soporte

Para soporte técnico, contactar a:
- **Sebastián Allende**
- **Pablo Santibañez**
- **Softkey**
