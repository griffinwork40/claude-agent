// browser-service/src/browser-session.ts
// Manages Playwright browser instances and delegates metadata to SessionManager
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import { getSessionManager, SessionControlRole, SessionPreviewDetails } from './session-manager';

interface ManagedBrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  lastActivity: number;
  sessionId: string;
  persistent: boolean;
}

export interface SessionOptions {
  headful?: boolean;
  owner?: SessionControlRole;
  persistent?: boolean;
}

export class BrowserSessionManager {
  private sessions = new Map<string, ManagedBrowserSession>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private readonly metadata = getSessionManager();

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions().catch((error) => {
        console.error('Failed to cleanup idle sessions', error);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Acquire existing session or create a new Playwright context.
   */
  async getOrCreateSession(
    sessionId: string,
    options: SessionOptions = {}
  ): Promise<{ page: Page; context: BrowserContext }> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      this.metadata.touch(sessionId, options);
      return { page: session.page, context: session.context };
    }

    const metadata = this.metadata.touch(sessionId, {
      headful: options.headful ?? this.isPreviewEnabled(),
      owner: options.owner,
    });

    const persistent = options.persistent ?? true;
    const headless = metadata.headful ? false : process.env.HEADLESS !== 'false';
    const browser = await chromium.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    });

    const storageStatePath = persistent ? metadata.persistentStoragePath : undefined;
    let storageState: string | undefined;
    if (storageStatePath && fs.existsSync(storageStatePath)) {
      storageState = storageStatePath;
    }

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      storageState,
    });

    const page = await context.newPage();

    const managedSession: ManagedBrowserSession = {
      browser,
      context,
      page,
      lastActivity: Date.now(),
      sessionId,
      persistent,
    };

    this.sessions.set(sessionId, managedSession);
    return { page, context };
  }

  /**
   * Attempt to acquire manual control for the requester.
   */
  requestControl(sessionId: string, requester: SessionControlRole): boolean {
    return this.metadata.requestControl(sessionId, requester);
  }

  /**
   * Release control lock for the session.
   */
  releaseControl(sessionId: string, requester: SessionControlRole): void {
    this.metadata.releaseControl(sessionId, requester);
  }

  /**
   * Provide preview information to clients.
   */
  getPreview(sessionId: string): SessionPreviewDetails | null {
    return this.metadata.getPreviewDetails(sessionId);
  }

  /**
   * Close a session and persist storage state if requested.
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.persistent) {
      try {
        const storageStatePath = this.metadata.resolveStoragePath(sessionId);
        await session.context.storageState({ path: storageStatePath });
      } catch (error) {
        console.error('Failed to persist storage state', error);
      }
    }

    await session.browser.close();
    this.sessions.delete(sessionId);
    this.metadata.remove(sessionId);
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const staleSessions = Array.from(this.sessions.values()).filter(
      (session) => now - session.lastActivity > this.sessionTimeout
    );

    for (const session of staleSessions) {
      console.log(`Cleaning up idle session: ${session.sessionId}`);
      await this.closeSession(session.sessionId);
    }
  }

  /**
   * Close all sessions and clear timers.
   */
  async closeAll(): Promise<void> {
    const closing = Array.from(this.sessions.keys()).map((id) => this.closeSession(id));
    await Promise.allSettled(closing);

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Provide the list of active session identifiers.
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Fetch metadata snapshot for diagnostics.
   */
  getSessionInfo(sessionId: string) {
    return this.metadata.getSessionInfo(sessionId);
  }

  private isPreviewEnabled(): boolean {
    return process.env.ENABLE_BROWSER_PREVIEW === 'true';
  }
}

let sessionManager: BrowserSessionManager | null = null;

export const getBrowserSessionManager = (): BrowserSessionManager => {
  if (!sessionManager) {
    sessionManager = new BrowserSessionManager();
  }
  return sessionManager;
};

