'use client';

import AuthGuard from '@/components/AuthGuard';

export default function ClientPage() {
  return (
    <AuthGuard requiredRole="client">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 dark:border-gray-700 rounded-lg h-96 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Panel de Cliente
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Bienvenido al panel de cliente de Gelymar
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
