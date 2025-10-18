// browser-service/src/browser-session.ts
// Manages persistent browser sessions for LLM-controlled browsing
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { getVNCServer } from './vnc-server';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  lastActivity: number;
  sessionId: string;
  userId?: string;
  isHeadful: boolean;
  vncUrl?: string;
  vncPort?: number;
  controlOwner?: string; // WebSocket client ID who has control
  isRecording: boolean;
  recordingPath?: string;
}

export class BrowserSessionManager {
  private sessions = new Map<string, BrowserSession>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private vncServer = getVNCServer();

  constructor() {
    // Clean up idle sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, 5 * 60 * 1000);
  }

  async getOrCreateSession(sessionId: string, userId?: string, headful: boolean = false): Promise<{ page: Page; context: BrowserContext; session: BrowserSession }> {
    let session = this.sessions.get(sessionId);

    if (session) {
      // Update last activity
      session.lastActivity = Date.now();
      return { page: session.page, context: session.context, session };
    }

    // Create new session
    console.log(`Creating new browser session: ${sessionId} (headful: ${headful})`);
    
    let vncUrl: string | undefined;
    let vncPort: number | undefined;

    // If headful mode, create VNC session
    if (headful) {
      try {
        const vncSession = await this.vncServer.createSession(sessionId);
        vncUrl = vncSession.vncUrl;
        vncPort = vncSession.port;
        console.log(`VNC session created for ${sessionId}: ${vncUrl}`);
      } catch (error) {
        console.error(`Failed to create VNC session for ${sessionId}:`, error);
        // Continue with headless mode if VNC fails
      }
    }

    const browser = await chromium.launch({
      headless: !headful,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        // VNC-specific args for headful mode
        ...(headful ? [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--remote-debugging-port=0'
        ] : [])
      ],
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    session = {
      browser,
      context,
      page,
      lastActivity: Date.now(),
      sessionId,
      userId,
      isHeadful: headful,
      vncUrl,
      vncPort,
      isRecording: false
    };

    this.sessions.set(sessionId, session);
    console.log(`Session created: ${sessionId}`);

    return { page, context, session };
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`Closing session: ${sessionId}`);
    
    // Close VNC session if it exists
    if (session.isHeadful) {
      try {
        await this.vncServer.destroySession(sessionId);
      } catch (error) {
        console.error(`Error destroying VNC session for ${sessionId}:`, error);
      }
    }

    await session.browser.close();
    this.sessions.delete(sessionId);
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        toDelete.push(sessionId);
      }
    }

    for (const sessionId of toDelete) {
      console.log(`Cleaning up idle session: ${sessionId}`);
      await this.closeSession(sessionId);
    }
  }

  async closeAll(): Promise<void> {
    console.log(`Closing all ${this.sessions.size} browser sessions`);
    const closePromises = Array.from(this.sessions.keys()).map(id => this.closeSession(id));
    await Promise.all(closePromises);
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  setControlOwner(sessionId: string, clientId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.controlOwner = clientId;
    }
  }

  releaseControl(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.controlOwner = undefined;
    }
  }

  startRecording(sessionId: string, recordingPath: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isRecording = true;
      session.recordingPath = recordingPath;
    }
  }

  stopRecording(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isRecording = false;
      session.recordingPath = undefined;
    }
  }
}

// Singleton instance
let sessionManager: BrowserSessionManager | null = null;

export const getBrowserSessionManager = (): BrowserSessionManager => {
  if (!sessionManager) {
    sessionManager = new BrowserSessionManager();
  }
  return sessionManager;
};

