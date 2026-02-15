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
  const token = localStorage.getItem('token');
  if (!token) return;

  const onlineLabel = labels?.online || 'Online';
  const offlineLabel = labels?.offline || 'Offline';

  try {
    const [presenceResponse, meResponse] = await Promise.all([
      fetch(`${apiBase}/api/users/admins/presence`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`${apiBase}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
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
        ? `${fileServer.replace(/\/$/, '')}/${admin.avatar_path.replace(/^\/+/, '')}`
        : '';

      const avatarMarkup = avatarPath
        ? `<img src="${avatarPath}" alt="${name}" class="w-10 h-10 rounded-full object-cover">`
        : `<div class="w-10 h-10 rounded-full bg-gray-200 text-gray-900 dark:bg-gray-600 dark:text-white flex items-center justify-center text-xs font-semibold">${buildInitials(name)}</div>`;

      return `
        <div class="relative" title="${name} · ${statusLabel}" aria-label="${name} · ${statusLabel}">
          ${avatarMarkup}
          <span class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${statusClass} shadow-sm"></span>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="flex items-center gap-2">
        ${html}
      </div>
    `;
  } catch (error) {
    // no-op
  }
}
