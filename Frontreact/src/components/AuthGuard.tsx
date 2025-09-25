'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'client';
  fallback?: React.ReactNode;
}

export default function AuthGuard({ 
  children, 
  requiredRole, 
  fallback 
}: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.push('/auth/login');
        return;
      }

      if (requiredRole && user.role !== requiredRole) {
        // Redirigir según el rol del usuario
        if (user.role === 'admin') {
          router.push('/admin');
        } else if (user.role === 'client') {
          router.push('/client');
        }
        return;
      }

      // Verificar si debe cambiar contraseña
      if (user.change_pw === 0) {
        router.push('/auth/change-password');
        return;
      }
    }
  }, [isAuthenticated, user, isLoading, requiredRole, router]);

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, mostrar fallback o redirigir
  if (!isAuthenticated || !user) {
    return fallback || null;
  }

  // Si el rol no coincide, mostrar fallback
  if (requiredRole && user.role !== requiredRole) {
    return fallback || null;
  }

  // Si debe cambiar contraseña, mostrar fallback
  if (user.change_pw === 0) {
    return fallback || null;
  }

  return <>{children}</>;
}
