/**
 * ==============================================================================
 * MuleShield (SIH26184) - Real-Time WebSocket Manager
 * ==============================================================================
 * Handles resilient bi-directional communication with HQ server:
 * - Dynamic URL resolution based on window.location
 * - Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
 * - Broadcast channel event dispatching (NEW_ALERT, FREEZE_APPROVED, etc.)
 * - Automatic ping-pong keepalives to prevent NAT timeouts.
 * ==============================================================================
 */

class WebSocketManager {
  constructor(defaultRole = 'investigator') {
    this.role = defaultRole;
    this.ws = null;
    this.subscribers = new Set();
    this.statusSubscribers = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 30000;
    this.pingInterval = null;
    this.status = 'disconnected'; // 'connected' | 'reconnecting' | 'disconnected'
    this.isExplicitlyClosed = false;
  }

  // ADDITION 1: Dynamic WebSocket URL resolution with role routing
  getWebSocketUrl(role) {
    const r = role || this.role || 'investigator';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_HOST || window.location.hostname;
    return `${protocol}//${host}:8000/ws/${r}`;
  }

  connect(role) {
    if (role) this.role = role;
    this.isExplicitlyClosed = false;
    const url = this.getWebSocketUrl(this.role);

    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'disconnected');
    console.log(`[WS:${this.role}] Connecting to ${url} (Attempt ${this.reconnectAttempts + 1})...`);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected to MuleShield Command Hub.');
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startKeepAlive();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.notifySubscribers(message);
        } catch (err) {
          console.warn('[WS] Received non-JSON message:', event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Connection error:', error);
      };

      this.ws.onclose = (event) => {
        this.stopKeepAlive();
        if (!this.isExplicitlyClosed) {
          this.setStatus('reconnecting');
          this.scheduleReconnect();
        } else {
          this.setStatus('disconnected');
        }
      };
    } catch (err) {
      console.error('[WS] Initialization failed:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    console.log(`[WS] Reconnecting in ${(delay / 1000).toFixed(1)}s...`);

    setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  startKeepAlive() {
    this.stopKeepAlive();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 20000);
  }

  stopKeepAlive() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    this.stopKeepAlive();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusSubscribers.forEach((callback) => callback(newStatus));
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  subscribeStatus(callback) {
    this.statusSubscribers.add(callback);
    callback(this.status);
    return () => this.statusSubscribers.delete(callback);
  }

  notifySubscribers(message) {
    this.subscribers.forEach((callback) => {
      try {
        callback(message);
      } catch (err) {
        console.error('[WS] Subscriber dispatch error:', err);
      }
    });
  }
}

export const wsManager = new WebSocketManager('investigator');
export const createRoleWsManager = (role) => new WebSocketManager(role);
export default wsManager;
