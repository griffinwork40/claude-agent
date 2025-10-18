// browser-service/src/websocket-server.ts
// Provides WebSocket transport for real-time automation events and user control handoffs
import { IncomingMessage, Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import { getSessionManager, SessionControlRole } from './session-manager';

/**
 * Standardized event payload emitted to UI subscribers.
 */
export interface AutomationEvent<T = Record<string, unknown>> {
  sessionId: string;
  type: 'automation_start' | 'automation_progress' | 'automation_complete' | 'automation_error' | 'user_takeover' | 'user_release';
  payload: T;
  timestamp: string;
}

interface ConnectedClient {
  socket: WebSocket;
  sessionId: string;
  role: SessionControlRole;
}

/**
 * WebSocket server that fans out automation events and relays user commands back to the automation runtime.
 */
class AutomationWebSocketServer {
  private readonly emitter = new EventEmitter();
  private readonly clients = new Set<ConnectedClient>();
  private server: WebSocketServer | null = null;

  /**
   * Attach to the existing HTTP server instance.
   */
  attach(httpServer: HTTPServer): void {
    if (this.server) {
      return;
    }

    this.server = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
      const { pathname, query } = url.parse(request.url || '', true);
      if (pathname !== '/ws/automation') {
        return;
      }

      const sessionId = typeof query.sessionId === 'string' ? query.sessionId : null;
      const token = typeof query.token === 'string' ? query.token : null;
      if (!sessionId || !token) {
        socket.destroy();
        return;
      }

      const sessionManager = getSessionManager();
      const validation = sessionManager.validateViewerToken(sessionId, token);
      if (!validation.valid) {
        socket.destroy();
        return;
      }

      this.server?.handleUpgrade(request, socket, head, (ws) => {
        this.registerClient(ws, sessionId, validation.role);
      });
    });
  }

  /**
   * Broadcast an automation event to all subscribers for the session.
   */
  broadcast<T>(event: AutomationEvent<T>): void {
    const payload = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.sessionId === event.sessionId) {
        client.socket.send(payload);
      }
    }
  }

  /**
   * Subscribe to user commands (click, type, etc.).
   */
  onUserCommand(listener: (sessionId: string, command: Record<string, unknown>) => void): void {
    this.emitter.on('user-command', listener);
  }

  private registerClient(socket: WebSocket, sessionId: string, role: SessionControlRole): void {
    const client: ConnectedClient = { socket, sessionId, role };
    this.clients.add(client);

    socket.on('message', (raw: Buffer) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed?.type === 'user_command' && parsed.command) {
          this.emitter.emit('user-command', sessionId, parsed.command);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message', error);
      }
    });

    socket.on('close', () => {
      this.clients.delete(client);
      const sessionManager = getSessionManager();
      sessionManager.handleSocketDisconnect(sessionId, role);
    });
  }
}

let socketServer: AutomationWebSocketServer | null = null;

/**
 * Singleton accessor for the automation WebSocket server.
 */
export const getAutomationWebSocketServer = (): AutomationWebSocketServer => {
  if (!socketServer) {
    socketServer = new AutomationWebSocketServer();
  }
  return socketServer;
};

