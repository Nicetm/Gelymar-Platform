/**
 * Servicio global de Socket.IO
 * Se carga una vez en el layout y está disponible para todos los scripts vía window.AppSocket
 */
(function() {
  'use strict';

  class SocketService {
    constructor() {
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this._listeners = new Map();
    }

    connect(token) {
      if (this.socket && this.isConnected) {
        return this.socket;
      }

      const apiBase = window.apiBase;
      if (!apiBase || typeof io === 'undefined') return null;

      this.socket = io(apiBase, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket.io connection error:', error.message);
        this.reconnectAttempts++;
      });

      this.socket.on('reconnect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      return this.socket;
    }

    /**
     * Escuchar un evento. Soporta múltiples listeners por evento.
     */
    on(event, callback) {
      if (this.socket) {
        this.socket.on(event, callback);
      }
      // Guardar para registrar si el socket se conecta después
      if (!this._listeners.has(event)) this._listeners.set(event, []);
      this._listeners.get(event).push(callback);
    }

    /**
     * Emitir un evento
     */
    emit(event, data) {
      if (this.socket && this.isConnected) {
        this.socket.emit(event, data);
      }
    }

    /**
     * Obtener el socket raw (para compatibilidad)
     */
    getSocket() {
      return this.socket;
    }

    /**
     * Inicializar: validar token y conectar
     */
    init() {
      if (typeof io === 'undefined') return false;

      const token = localStorage.getItem('token');
      if (!token) return false;

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp < Date.now() / 1000) return false;
        this.connect(token);
        return true;
      } catch {
        return false;
      }
    }
  }

  // Singleton global
  window.AppSocket = new SocketService();
})();
