// browser-service/src/browser-session.ts
// Manages persistent browser sessions for LLM-controlled browsing
import { chromium, Browser, BrowserContext, Page } from 'playwright';

interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  lastActivity: number;
  sessionId: string;
}

export class BrowserSessionManager {
  private sessions = new Map<string, BrowserSession>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Clean up idle sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, 5 * 60 * 1000);
  }

  async getOrCreateSession(sessionId: string): Promise<{ page: Page; context: BrowserContext }> {
    let session = this.sessions.get(sessionId);

    if (session) {
      // Update last activity
      session.lastActivity = Date.now();
      return { page: session.page, context: session.context };
    }

    // Create new session
    console.log(`Creating new browser session: ${sessionId}`);
    
    const browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
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
    };

    this.sessions.set(sessionId, session);
    console.log(`Session created: ${sessionId}`);

    return { page, context };
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`Closing session: ${sessionId}`);
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
}

// Singleton instance
let sessionManager: BrowserSessionManager | null = null;

export const getBrowserSessionManager = (): BrowserSessionManager => {
  if (!sessionManager) {
    sessionManager = new BrowserSessionManager();
  }
  return sessionManager;
};

