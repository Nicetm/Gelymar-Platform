const API = {
  baseUrl: '',

  getToken() { return localStorage.getItem('token'); },
  setToken(t) { localStorage.setItem('token', t); },
  clearToken() { localStorage.removeItem('token'); },

  async request(url, options = {}) {
    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(this.baseUrl + url, { ...options, headers });
    const data = await res.json();

    // Only redirect to login on 401 for non-auth endpoints
    if (res.status === 401 && !url.includes('/api/auth/login')) {
      this.clearToken();
      window.location.hash = '#/login';
      throw new Error('Sesión expirada');
    }
    if (!res.ok) throw new Error(data.message || 'Error');
    return data;
  },

  get(url) { return this.request(url); },
  post(url, body) { return this.request(url, { method: 'POST', body: JSON.stringify(body) }); },
  put(url, body) { return this.request(url, { method: 'PUT', body: JSON.stringify(body) }); },
  del(url) { return this.request(url, { method: 'DELETE' }); }
};
