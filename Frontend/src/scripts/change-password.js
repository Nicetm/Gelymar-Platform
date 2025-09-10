import { validateForm, showFormErrors, clearFormErrors } from '../lib/validation.js';
import { logSuspiciousActivity } from '../lib/security.js';
import { checkRateLimit, recordFailedAttempt } from '../lib/rateLimiter.js';

export async function initChangePasswordScript() {
  const passwordChangeValidationRules = {
    currentPassword: {
      required: true,
      requiredMessage: 'La contraseña actual es requerida',
      minLength: 6
    },
    newPassword: {
      required: true,
      requiredMessage: 'La nueva contraseña es requerida',
      type: 'password',
      passwordOptions: {
        minLength: 5,
        requireUppercase: false,
        requireLowercase: false,
        requireNumbers: false,
        requireSpecialChars: false
      }
    },
    confirmPassword: {
      required: true,
      requiredMessage: 'Debe confirmar la nueva contraseña',
      minLength: 5
    }
  };

  const form = document.getElementById('changePasswordForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    clearFormErrors(e.target);

    const rateLimitCheck = checkRateLimit('PASSWORD_CHANGE');
    const msg = document.getElementById('changePasswordMessage');

    if (!rateLimitCheck.allowed) {
      if (msg) {
        msg.textContent = rateLimitCheck.message;
        msg.classList.remove('hidden', 'text-green-600');
        msg.classList.add('text-red-500');
      }
      return;
    }

    const validation = validateForm(e.target, passwordChangeValidationRules);
    if (!validation.isValid) {
      showFormErrors(e.target, validation.errors);
      return;
    }

    const currentPassword = validation.data.currentPassword;
    const newPassword = validation.data.newPassword;
    const confirmPassword = validation.data.confirmPassword;

    if (newPassword !== confirmPassword) {
      showFormErrors(e.target, { confirmPassword: 'Las contraseñas no coinciden' });
      return;
    }

    if (currentPassword === newPassword) {
      showFormErrors(e.target, { newPassword: 'La nueva contraseña no puede ser igual a la actual' });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiBase = window.apiBase;
      
      console.log('🔍 [Change Password] apiBase:', apiBase);
      console.log('🔍 [Change Password] token:', token ? 'present' : 'missing');
      
      const res = await fetch(`${apiBase}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      console.log('🔍 [Change Password] response status:', res.status);

      const data = await res.json();

      if (!res.ok) {
        recordFailedAttempt('PASSWORD_CHANGE');

        const msgLower = (data.message || '').toLowerCase();
        if (msgLower.includes('contraseña') || msgLower.includes('password')) {
          logSuspiciousActivity('password_change_failed', {
            reason: data.message,
            currentPasswordLength: currentPassword.length
          });
        }

        if (msg) {
          msg.textContent = data.message || 'Error al cambiar contraseña';
          msg.classList.remove('hidden', 'text-green-600');
          msg.classList.add('text-red-500');
        }
        return;
      }

      if (msg) {
        msg.textContent = 'Contraseña actualizada correctamente';
        msg.classList.remove('hidden', 'text-red-500');
        msg.classList.add('text-green-600');
      }

      setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        window.location.href = '/authentication/sign-in';
      }, 2000);

    } catch (err) {
      if (msg) {
        msg.textContent = 'Error de conexión';
        msg.classList.remove('hidden', 'text-green-600');
        msg.classList.add('text-red-500');
      }
    }
  });
}

