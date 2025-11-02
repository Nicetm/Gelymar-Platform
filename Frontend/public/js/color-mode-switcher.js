export function initColorModeSwitcher() {
  if (typeof window === 'undefined') {
    return;
  }

  const toggleBtn = document.getElementById('theme-toggle');
  const darkIcon = document.getElementById('theme-toggle-dark-icon');
  const lightIcon = document.getElementById('theme-toggle-light-icon');

  if (!toggleBtn || !darkIcon || !lightIcon) {
    return;
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem('color-theme');
  const shouldUseDark = storedTheme === 'dark' || (!storedTheme && prefersDark);

  document.documentElement.classList.toggle('dark', shouldUseDark);
  if (shouldUseDark) {
    lightIcon.classList.remove('hidden');
  } else {
    darkIcon.classList.remove('hidden');
  }

  toggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    darkIcon.classList.toggle('hidden');
    lightIcon.classList.toggle('hidden');
    localStorage.setItem('color-theme', isDark ? 'dark' : 'light');
    document.dispatchEvent(new Event('dark-mode'));
  });
}
