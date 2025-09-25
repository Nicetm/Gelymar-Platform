import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LoginCredentials, TwoFACredentials, AuthState } from '@/types/auth';
import { getApiUrl } from '@/lib/config';

interface AuthStore extends AuthState {
  // Actions
  login: (credentials: LoginCredentials) => Promise<any>;
  login2FA: (credentials: TwoFACredentials) => Promise<any>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  check2FAStatus: (username: string) => Promise<any>;
  setup2FA: (username: string) => Promise<any>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(getApiUrl('/api/auth/login'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
              otp: credentials.otp || ''
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            // Verificar si requiere 2FA
            if ((data.message?.toLowerCase().includes('2fa') || data.message?.toLowerCase().includes('código 2fa')) && !credentials.otp) {
              set({ 
                isLoading: false, 
                error: null,
                user: { ...data.user, twoFAEnabled: true } as User
              });
              return { requires2FA: true, message: data.message };
            }
            throw new Error(data.message || 'Error de autenticación');
          }

          // Login exitoso - guardar token
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', data.token);
            document.cookie = `token=${data.token}; path=/; SameSite=Strict`;
          }

          // Obtener información del usuario
          const meResponse = await fetch(getApiUrl('/api/auth/me'), {
            headers: { Authorization: `Bearer ${data.token}` }
          });

          if (meResponse.ok) {
            const user = await meResponse.json();
            const userRole = user.role || (user.role_id === 1 ? 'admin' : 'client');
            
            set({
              user: { ...user, role: userRole },
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            return { user, token: data.token, requiresPasswordChange: user.change_pw === 0 };
          } else {
            throw new Error('Error validando usuario');
          }

        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Error de conexión',
            isLoading: false,
          });
          throw error;
        }
      },

      login2FA: async (credentials: TwoFACredentials) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(getApiUrl('/api/auth/login'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
              otp: credentials.otp
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Código 2FA inválido');
          }

          // Login exitoso con 2FA - guardar token
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', data.token);
            document.cookie = `token=${data.token}; path=/; SameSite=Strict`;
          }

          // Obtener información del usuario
          const meResponse = await fetch(getApiUrl('/api/auth/me'), {
            headers: { Authorization: `Bearer ${data.token}` }
          });

          if (meResponse.ok) {
            const user = await meResponse.json();
            const userRole = user.role || (user.role_id === 1 ? 'admin' : 'client');
            
            set({
              user: { ...user, role: userRole },
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            return { user, token: data.token, requiresPasswordChange: user.change_pw === 0 };
          } else {
            throw new Error('Error validando usuario');
          }

        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Error de autenticación 2FA',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });

        // Limpiar localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userEmail');
        }
      },

      refreshToken: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const response = await fetch(getApiUrl('/api/auth/refresh'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            set({ token: data.token });
            
            if (typeof window !== 'undefined') {
              localStorage.setItem('token', data.token);
            }
          } else {
            // Token inválido, hacer logout
            get().logout();
          }
        } catch (error) {
          console.error('Error refreshing token:', error);
          get().logout();
        }
      },

      setUser: (user: User | null) => set({ user }),
      setToken: (token: string | null) => set({ token }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
      setError: (error: string | null) => set({ error }),
      clearError: () => set({ error: null }),

      // Funciones para 2FA
      check2FAStatus: async (username: string) => {
        try {
          const response = await fetch(getApiUrl(`/api/auth/2fa/status?username=${encodeURIComponent(username)}`));
          const data = await response.json();
          return data;
        } catch (error) {
          console.error('Error checking 2FA status:', error);
          throw error;
        }
      },

      setup2FA: async (username: string) => {
        try {
          const response = await fetch(getApiUrl(`/api/auth/2fa/setup?username=${encodeURIComponent(username)}`));
          const data = await response.json();
          return data;
        } catch (error) {
          console.error('Error setting up 2FA:', error);
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
