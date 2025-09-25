'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirigir según el rol del usuario
      if (user.role === 'admin') {
        router.push('/admin');
      } else if (user.role === 'client') {
        router.push('/client');
      }
    } else {
      // Si no está autenticado, redirigir al login
      router.push('/auth/login');
    }
  }, [isAuthenticated, user, router]);

  // Mostrar spinner mientras se verifica la autenticación
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent border-solid rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
      </div>
    </div>
  );
}
