import { qs } from './utils.js';

function buildInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function buildFallbackAvatar(name = '') {
  const initials = buildInitials(name);
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(initials)}&backgroundColor=4b5563&fontColor=ffffff`;
}

export async function initAdminPresence({ apiBase, fileServer, labels } = {}) {
  const container = qs('admin-presence');
  if (!container) return;
  if (!localStorage.getItem('token')) return;
  const apiRoot = apiBase || window.apiBase || '';

  const onlineLabel = labels?.online || 'Online';
  const offlineLabel = labels?.offline || 'Offline';

  const fetchPresence = async () => {
    const freshToken = localStorage.getItem('token');
    if (!freshToken) {
      clearInterval(window.__adminPresenceInterval);
      return;
    }
    try {
      const [presenceResponse, meResponse] = await Promise.all([
        fetch(`${apiRoot}/api/users/admins/presence`, {
          headers: { Authorization: `Bearer ${freshToken}` }
        }),
        fetch(`${apiRoot}/api/auth/me`, {
          headers: { Authorization: `Bearer ${freshToken}` }
        })
      ]);

      if (!presenceResponse.ok) return;
      const admins = await presenceResponse.json();
      const meData = meResponse.ok ? await meResponse.json() : null;
      const currentUserId = Number(meData?.id ?? meData?.user?.id ?? null);
      if (!Array.isArray(admins) || admins.length === 0) return;

      const html = admins
        .filter((admin) => {
          if (!currentUserId || Number.isNaN(currentUserId)) return true;
          return Number(admin.id) !== currentUserId;
        })
        .map((admin) => {
        const name = admin.full_name || admin.name || admin.email || 'Admin';
        const isOnline = admin.online === true || admin.online === 1 || admin.online === '1';
        const statusLabel = isOnline ? onlineLabel : offlineLabel;
        const statusClass = isOnline ? 'bg-green-500' : 'bg-red-500';
        const avatarPath = admin.avatar_path
          ? `${apiRoot}/api/assets?path=${encodeURIComponent(admin.avatar_path.replace(/^\/+/, ''))}&token=${encodeURIComponent(freshToken)}`
          : '';

        const avatarMarkup = avatarPath
          ? `<img src="${avatarPath}" alt="${name}" class="w-7 h-7 rounded-full object-cover">`
          : `<div class="w-7 h-7 rounded-full bg-gray-200 text-gray-900 dark:bg-gray-600 dark:text-white flex items-center justify-center text-xs font-semibold">${buildInitials(name)}</div>`;

        return `
          <div class="relative" title="${name} · ${statusLabel}" aria-label="${name} · ${statusLabel}">
            ${avatarMarkup}
            <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full ${statusClass} shadow-sm"></span>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div class="flex items-center -space-x-3">
          ${html}
        </div>
      `;
    } catch (error) {
      // no-op
    }
  };

  await fetchPresence();

  if (window.__adminPresenceInterval) {
    clearInterval(window.__adminPresenceInterval);
  }
  window.__adminPresenceInterval = setInterval(fetchPresence, 10000);
}
