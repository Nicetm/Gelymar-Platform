export function getToken(Astro) {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token') ?? '';
  }

  if (Astro?.cookies) {
    return Astro.cookies.get('token')?.value ?? '';
  }

  return '';
}
