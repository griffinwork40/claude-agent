// browser-service/src/vnc-server.ts
// VNC server setup for browser visualization with noVNC
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface VNCSession {
  sessionId: string;
  display: string;
  vncProcess: ChildProcess;
  websockifyProcess: ChildProcess;
  port: number;
  password: string;
  isActive: boolean;
}

export class VNCServer extends EventEmitter {
  private sessions = new Map<string, VNCSession>();
  private displayCounter = 10; // Start from display :10
  private portCounter = 6080; // Start from port 6080
  private vncPassword: string;

  constructor() {
    super();
    this.vncPassword = process.env.VNC_PASSWORD || 'browser123';
  }

  async createSession(sessionId: string): Promise<{ vncUrl: string; port: number; password: string }> {
    const display = `:${this.displayCounter++}`;
    const port = this.portCounter++;
    const password = this.generatePassword();

    console.log(`🖥️ Creating VNC session for ${sessionId} on display ${display}, port ${port}`);

    try {
      // Start Xvfb virtual display
      const xvfbProcess = spawn('Xvfb', [display, '-screen', '0', '1920x1080x24', '-ac'], {
        stdio: 'pipe'
      });

      // Wait a moment for Xvfb to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start x11vnc server
      const vncProcess = spawn('x11vnc', [
        '-display', display,
        '-nopw', // No password for now, we'll use websockify auth
        '-forever',
        '-shared',
        '-rfbport', '0', // Let x11vnc choose port
        '-bg'
      ], {
        stdio: 'pipe'
      });

      // Wait for x11vnc to start and get its port
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Start websockify proxy
      const websockifyProcess = spawn('python3', [
        '/opt/utils/websockify/websockify.py',
        '--web', '/opt',
        port.toString(),
        'localhost:5900' // x11vnc default port
      ], {
        stdio: 'pipe'
      });

      const vncSession: VNCSession = {
        sessionId,
        display,
        vncProcess,
        websockifyProcess,
        port,
        password,
        isActive: true
      };

      this.sessions.set(sessionId, vncSession);

      // Handle process cleanup
      vncProcess.on('exit', (code) => {
        console.log(`VNC process for ${sessionId} exited with code ${code}`);
        this.cleanupSession(sessionId);
      });

      websockifyProcess.on('exit', (code) => {
        console.log(`Websockify process for ${sessionId} exited with code ${code}`);
        this.cleanupSession(sessionId);
      });

      xvfbProcess.on('exit', (code) => {
        console.log(`Xvfb process for ${sessionId} exited with code ${code}`);
        this.cleanupSession(sessionId);
      });

      // Wait for websockify to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      const vncUrl = `http://localhost:${port}/vnc.html?autoconnect=true&resize=scale`;
      
      console.log(`✅ VNC session created: ${vncUrl}`);
      this.emit('sessionCreated', { sessionId, vncUrl, port });

      return { vncUrl, port, password };
    } catch (error) {
      console.error(`❌ Failed to create VNC session for ${sessionId}:`, error);
      this.cleanupSession(sessionId);
      throw error;
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    console.log(`🗑️ Destroying VNC session: ${sessionId}`);
    this.cleanupSession(sessionId);
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isActive = false;

    try {
      if (session.vncProcess && !session.vncProcess.killed) {
        session.vncProcess.kill('SIGTERM');
      }
    } catch (error) {
      console.error(`Error killing VNC process for ${sessionId}:`, error);
    }

    try {
      if (session.websockifyProcess && !session.websockifyProcess.killed) {
        session.websockifyProcess.kill('SIGTERM');
      }
    } catch (error) {
      console.error(`Error killing websockify process for ${sessionId}:`, error);
    }

    this.sessions.delete(sessionId);
    this.emit('sessionDestroyed', { sessionId });
  }

  private generatePassword(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  getSession(sessionId: string): VNCSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  async destroyAllSessions(): Promise<void> {
    console.log(`🗑️ Destroying all ${this.sessions.size} VNC sessions`);
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.destroySession(sessionId);
    }
  }
}

// Singleton instance
let vncServer: VNCServer | null = null;

export const getVNCServer = (): VNCServer => {
  if (!vncServer) {
    vncServer = new VNCServer();
  }
  return vncServer;
};