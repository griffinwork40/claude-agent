// browser-service/src/websocket-server.ts
// WebSocket server for real-time browser control and monitoring
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  sessionId?: string;
  userId?: string;
  isAlive: boolean;
  lastPing: number;
}

export interface BrowserEvent {
  type: 'automation_start' | 'automation_progress' | 'user_takeover' | 'user_release' | 'screenshot' | 'action' | 'error';
  sessionId: string;
  data: any;
  timestamp: number;
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private clients = new Map<string, WebSocketClient>();
  private sessionClients = new Map<string, Set<string>>(); // sessionId -> clientIds
  private pingInterval: NodeJS.Timeout;

  constructor(port: number = 8080) {
    super();
    
    this.wss = new WebSocketServer({ 
      port,
      perMessageDeflate: false 
    });

    this.setupWebSocketServer();
    this.startPingInterval();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = uuidv4();
      const client: WebSocketClient = {
        id: clientId,
        ws,
        isAlive: true,
        lastPing: Date.now()
      };

      this.clients.set(clientId, client);
      console.log(`🔌 WebSocket client connected: ${clientId}`);

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error(`❌ Invalid WebSocket message from ${clientId}:`, error);
          this.sendToClient(clientId, {
            type: 'error',
            error: 'Invalid message format'
          });
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log(`🔌 WebSocket client disconnected: ${clientId}`);
        this.removeClient(clientId);
      });

      // Handle pong responses
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastPing = Date.now();
        }
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        message: 'Connected to browser automation service'
      });
    });
  }

  private handleMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'join_session':
        this.joinSession(clientId, message.sessionId, message.userId);
        break;
      
      case 'leave_session':
        this.leaveSession(clientId);
        break;
      
      case 'take_control':
        this.takeControl(clientId, message.sessionId);
        break;
      
      case 'release_control':
        this.releaseControl(clientId, message.sessionId);
        break;
      
      case 'browser_action':
        this.handleBrowserAction(clientId, message);
        break;
      
      case 'ping':
        this.sendToClient(clientId, { type: 'pong' });
        break;
      
      default:
        console.log(`Unknown message type from ${clientId}:`, message.type);
    }
  }

  private joinSession(clientId: string, sessionId: string, userId?: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.sessionId = sessionId;
    client.userId = userId;

    // Add to session clients
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    this.sessionClients.get(sessionId)!.add(clientId);

    console.log(`👥 Client ${clientId} joined session ${sessionId}`);
    
    this.sendToClient(clientId, {
      type: 'session_joined',
      sessionId,
      message: `Joined session ${sessionId}`
    });

    // Notify other clients in the session
    this.broadcastToSession(sessionId, {
      type: 'client_joined',
      sessionId,
      clientId,
      userId
    }, clientId);
  }

  private leaveSession(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) return;

    const sessionId = client.sessionId;
    client.sessionId = undefined;
    client.userId = undefined;

    // Remove from session clients
    const sessionClients = this.sessionClients.get(sessionId);
    if (sessionClients) {
      sessionClients.delete(clientId);
      if (sessionClients.size === 0) {
        this.sessionClients.delete(sessionId);
      }
    }

    console.log(`👥 Client ${clientId} left session ${sessionId}`);
    
    this.broadcastToSession(sessionId, {
      type: 'client_left',
      sessionId,
      clientId
    }, clientId);
  }

  private takeControl(clientId: string, sessionId: string): void {
    console.log(`🎮 Client ${clientId} taking control of session ${sessionId}`);
    
    this.broadcastToSession(sessionId, {
      type: 'user_takeover',
      sessionId,
      clientId,
      timestamp: Date.now()
    });

    this.emit('user_takeover', { sessionId, clientId });
  }

  private releaseControl(clientId: string, sessionId: string): void {
    console.log(`🤖 Client ${clientId} releasing control of session ${sessionId}`);
    
    this.broadcastToSession(sessionId, {
      type: 'user_release',
      sessionId,
      clientId,
      timestamp: Date.now()
    });

    this.emit('user_release', { sessionId, clientId });
  }

  private handleBrowserAction(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) return;

    console.log(`🎯 Browser action from ${clientId}:`, message.action);
    
    this.emit('browser_action', {
      sessionId: client.sessionId,
      clientId,
      action: message.action,
      data: message.data
    });
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          console.log(`💀 Terminating dead client: ${clientId}`);
          this.removeClient(clientId);
          return;
        }

        client.isAlive = false;
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 30000); // Ping every 30 seconds
  }

  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client && client.sessionId) {
      this.leaveSession(clientId);
    }
    this.clients.delete(clientId);
  }

  // Public methods for sending events
  sendToClient(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }

  broadcastToSession(sessionId: string, data: any, excludeClientId?: string): void {
    const sessionClients = this.sessionClients.get(sessionId);
    if (!sessionClients) return;

    sessionClients.forEach(clientId => {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, data);
      }
    });
  }

  broadcastToAll(data: any): void {
    this.clients.forEach((_, clientId) => {
      this.sendToClient(clientId, data);
    });
  }

  // Emit browser events to connected clients
  emitBrowserEvent(event: BrowserEvent): void {
    this.broadcastToSession(event.sessionId, event);
  }

  getSessionClients(sessionId: string): string[] {
    const sessionClients = this.sessionClients.get(sessionId);
    return sessionClients ? Array.from(sessionClients) : [];
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessionClients.keys());
  }

  async close(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    return new Promise((resolve) => {
      this.wss.close(() => {
        console.log('🔌 WebSocket server closed');
        resolve();
      });
    });
  }
}

// Singleton instance
let wsManager: WebSocketManager | null = null;

export const getWebSocketManager = (): WebSocketManager => {
  if (!wsManager) {
    const port = parseInt(process.env.WEBSOCKET_PORT || '8080');
    wsManager = new WebSocketManager(port);
  }
  return wsManager;
};