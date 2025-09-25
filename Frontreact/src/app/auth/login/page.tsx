'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import '../../login.css';

// Esquema de validación para el login
const loginSchema = z.object({
  username: z.string().min(1, 'El usuario es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, login2FA, check2FAStatus, setup2FA, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [otp, setOtp] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      setMessage('');
      
      const result = await login(data);
      
      if (result && 'requires2FA' in result) {
        // Mostrar campo 2FA
        setShow2FA(true);
        setMessage('Please enter your 2FA code from the authenticator app.');
        setMessageType('success');
        
        // Verificar si 2FA está habilitado
        try {
          const status = await check2FAStatus(data.username);
          if (!status.twoFAEnabled) {
            // Mostrar QR para setup
            const qrData = await setup2FA(data.username);
            setQrCode(qrData.qr);
            setShowQR(true);
          }
        } catch (error) {
          console.error('Error checking 2FA status:', error);
        }
        return;
      }
      
      if (result && 'requiresPasswordChange' in result && result.requiresPasswordChange) {
        // Redirigir a cambio de contraseña
        router.push('/authentication/change-password');
        return;
      }
      
      // Redirigir según el rol del usuario
      const { user } = useAuthStore.getState();
      if (user?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/client');
      }
    } catch (error) {
      console.error('Error en login:', error);
      setMessage(error instanceof Error ? error.message : 'Error de conexión');
      setMessageType('error');
    }
  };

  const handle2FASubmit = async () => {
    try {
      const credentials = getValues();
      const result = await login2FA({
        ...credentials,
        otp,
      });
      
      if (result && 'requiresPasswordChange' in result && result.requiresPasswordChange) {
        // Redirigir a cambio de contraseña
        router.push('/authentication/change-password');
        return;
      }
      
      // Redirigir según el rol
      const { user } = useAuthStore.getState();
      if (user?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/client');
      }
    } catch (error) {
      console.error('Error en 2FA:', error);
      setMessage(error instanceof Error ? error.message : 'Error de autenticación 2FA');
      setMessageType('error');
    }
  };

  if (!mounted) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img
              className="login-logo"
              src="/gelymar.svg"
              alt="Gelymar"
            />
            <h2 className="login-title">
              Gelymar Platform
            </h2>
            <p className="login-subtitle">
              Sistema de gestión de documentos y logística
            </p>
          </div>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <img
            className="login-logo"
            src="/gelymar.svg"
            alt="Gelymar"
          />
          <h2 className="login-title">
            Gelymar Platform
          </h2>
          <p className="login-subtitle">
            Sistema de gestión de documentos y logística
          </p>
        </div>

        {/* Mensaje dinámico */}
        {message && (
          <div className={`form-message ${messageType === 'error' ? 'form-error-message' : 'form-success-message'}`}>
            {message}
          </div>
        )}

        {/* Formulario de Login */}
        {!show2FA ? (
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Campo Usuario */}
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Usuario
              </label>
              <input
                {...register('username')}
                type="text"
                autoComplete="username"
                className="form-input"
                placeholder="Ingresa tu usuario"
              />
              {errors.username && (
                <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Campo Contraseña */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>
              <div className="password-container">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="form-input"
                  placeholder="Ingresa tu contraseña"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {errors.password && (
                <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}

            {/* Botón de Login */}
            <button
              type="submit"
              disabled={isLoading}
              className="login-button"
            >
              {isLoading ? (
                <div className="loading-spinner"></div>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
        ) : (
          /* Formulario de 2FA */
          <div>
            <div className="login-header">
              <h3 className="login-title" style={{ fontSize: '1.5rem' }}>
                Autenticación de Dos Factores
              </h3>
              <p className="login-subtitle">
                Ingresa el código de tu aplicación autenticadora
              </p>
            </div>

            {qrCode && (
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <img src={qrCode} alt="QR Code" style={{ width: '8rem', height: '8rem', margin: '0 auto' }} />
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Escanea este código con tu aplicación autenticadora
                </p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="otp" className="form-label">
                Código de Verificación
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="form-input"
                style={{ textAlign: 'center', fontSize: '1.125rem', letterSpacing: '0.1em' }}
                placeholder="000000"
                maxLength={6}
              />
            </div>

            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShow2FA(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handle2FASubmit}
                disabled={isLoading || otp.length !== 6}
                className="login-button"
                style={{ flex: 1 }}
              >
                {isLoading ? (
                  <div className="loading-spinner"></div>
                ) : (
                  'Verificar'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
