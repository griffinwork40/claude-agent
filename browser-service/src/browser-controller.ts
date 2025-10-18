// browser-service/src/browser-controller.ts
// LLM-controlled browser operations (Playwright MCP style)
import { Page } from 'playwright';
import { getBrowserSessionManager } from './browser-session';

// Enhanced stealth and retry utilities
class StealthHelper {
  static async addStealthScripts(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ 
            state: Notification.permission,
            name: 'notifications',
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false
          } as PermissionStatus);
        }
        return originalQuery.call(window.navigator.permissions, parameters);
      };

      // Override automation detection
      Object.defineProperty(window, 'chrome', {
        get: () => ({
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        }),
      });
    });
  }

  static async setStealthViewport(page: Page): Promise<void> {
    // Randomize viewport size to look more human
    const widths = [1280, 1366, 1440, 1536, 1920];
    const heights = [720, 768, 900, 960, 1080];
    const width = widths[Math.floor(Math.random() * widths.length)];
    const height = heights[Math.floor(Math.random() * heights.length)];
    
    await page.setViewportSize({ width, height });
  }

  static async setStealthHeaders(page: Page): Promise<void> {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': userAgent,
    });
  }

  static async humanLikeDelay(min: number = 100, max: number = 300): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  static async simulateMouseMovement(page: Page): Promise<void> {
    // Simulate human-like mouse movement
    const viewport = page.viewportSize();
    if (viewport) {
      const x = Math.floor(Math.random() * viewport.width);
      const y = Math.floor(Math.random() * viewport.height);
      await page.mouse.move(x, y);
    }
  }
}

class RetryHelper {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 2000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}

export class BrowserController {
  private sessionManager = getBrowserSessionManager();

  async navigate(sessionId: string, url: string, headful: boolean = false, userId?: string): Promise<{ success: boolean; url: string; vncUrl?: string }> {
    return RetryHelper.withRetry(async () => {
      const { page, session } = await this.sessionManager.getOrCreateSession(sessionId, userId, headful);
      
      // Apply stealth measures
      await StealthHelper.addStealthScripts(page);
      await StealthHelper.setStealthViewport(page);
      await StealthHelper.setStealthHeaders(page);
      
      // Add human-like delay before navigation
      await StealthHelper.humanLikeDelay(500, 1500);
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Simulate human behavior after navigation
      await StealthHelper.simulateMouseMovement(page);
      await StealthHelper.humanLikeDelay(1000, 2000);
      
      return {
        success: true,
        url: page.url(),
        vncUrl: session.vncUrl
      };
    });
  }

  async snapshot(sessionId: string): Promise<{ success: boolean; snapshot: string; url: string }> {
    const { page } = await this.sessionManager.getOrCreateSession(sessionId);
    
    // Get accessibility tree snapshot (similar to Playwright MCP)
    const snapshot = await page.evaluate(() => {
      const getSnapshot = (element: Element, depth: number = 0, maxDepth: number = 5): string => {
        if (depth > maxDepth) return '';
        
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.className ? `.${element.className.toString().split(' ').join('.')}` : '';
        const text = element.textContent?.trim().slice(0, 100) || '';
        const role = element.getAttribute('role') || '';
        const ariaLabel = element.getAttribute('aria-label') || '';
        
        let result = `${'  '.repeat(depth)}<${tag}${id}${classes}`;
        if (role) result += ` role="${role}"`;
        if (ariaLabel) result += ` aria-label="${ariaLabel}"`;
        if (text && !element.children.length) result += ` text="${text}"`;
        result += '>\n';
        
        // Recurse on children
        const importantTags = ['a', 'button', 'input', 'select', 'textarea', 'h1', 'h2', 'h3', 'nav', 'form', 'main', 'article'];
        for (const child of Array.from(element.children)) {
          if (importantTags.includes(child.tagName.toLowerCase()) || child.getAttribute('role')) {
            result += getSnapshot(child, depth + 1, maxDepth);
          }
        }
        
        return result;
      };
      
      return getSnapshot(document.body);
    });
    
    return {
      success: true,
      snapshot,
      url: page.url(),
    };
  }

  async screenshot(sessionId: string, fullPage: boolean = false): Promise<{ success: boolean; screenshot: string }> {
    const { page } = await this.sessionManager.getOrCreateSession(sessionId);
    
    const screenshot = await page.screenshot({ 
      fullPage,
      type: 'png',
    });
    
    return {
      success: true,
      screenshot: screenshot.toString('base64'),
    };
  }

  async click(sessionId: string, selector: string): Promise<{ success: boolean; message: string }> {
    return RetryHelper.withRetry(async () => {
      const { page } = await this.sessionManager.getOrCreateSession(sessionId);
      
      // Add human-like delay before clicking
      await StealthHelper.humanLikeDelay(200, 500);
      
      // Simulate mouse movement to element
      await StealthHelper.simulateMouseMovement(page);
      
      await page.click(selector, { timeout: 10000 });
      
      // Add delay after click to simulate human behavior
      await StealthHelper.humanLikeDelay(300, 800);
      
      return {
        success: true,
        message: `Clicked element: ${selector}`,
      };
    });
  }

  async type(sessionId: string, selector: string, text: string, submit: boolean = false): Promise<{ success: boolean; message: string }> {
    return RetryHelper.withRetry(async () => {
      const { page } = await this.sessionManager.getOrCreateSession(sessionId);
      
      // Add human-like delay before typing
      await StealthHelper.humanLikeDelay(200, 500);
      
      // Clear field first
      await page.fill(selector, '', { timeout: 10000 });
      await StealthHelper.humanLikeDelay(100, 200);
      
      // Type with human-like speed
      await page.type(selector, text, { delay: 50 + Math.random() * 100 });
      
      if (submit) {
        await StealthHelper.humanLikeDelay(300, 600);
        await page.press(selector, 'Enter');
        await page.waitForLoadState('domcontentloaded');
      }
      
      return {
        success: true,
        message: `Typed into ${selector}${submit ? ' and submitted' : ''}`,
      };
    });
  }

  async select(sessionId: string, selector: string, value: string): Promise<{ success: boolean; message: string }> {
    const { page } = await this.sessionManager.getOrCreateSession(sessionId);
    
    try {
      await page.selectOption(selector, value, { timeout: 10000 });
      return {
        success: true,
        message: `Selected ${value} in ${selector}`,
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to select option in ${selector}: ${errMessage}`);
    }
  }

  async waitFor(sessionId: string, selector?: string, timeout: number = 10000): Promise<{ success: boolean; message: string }> {
    const { page } = await this.sessionManager.getOrCreateSession(sessionId);
    
    try {
      if (selector) {
        await page.waitForSelector(selector, { timeout });
        return {
          success: true,
          message: `Element ${selector} appeared`,
        };
      } else {
        await page.waitForLoadState('domcontentloaded', { timeout });
        return {
          success: true,
          message: 'Page loaded',
        };
      }
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Wait failed: ${errMessage}`);
    }
  }

  async evaluate(sessionId: string, script: string): Promise<{ success: boolean; result: unknown }> {
    const { page } = await this.sessionManager.getOrCreateSession(sessionId);
    
    try {
      const result = await page.evaluate(script);
      return {
        success: true,
        result,
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Evaluation failed: ${errMessage}`);
    }
  }

  async getPageContent(sessionId: string): Promise<{ success: boolean; html: string; text: string; url: string }> {
    const { page } = await this.sessionManager.getOrCreateSession(sessionId);
    
    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);
    
    return {
      success: true,
      html,
      text,
      url: page.url(),
    };
  }

  async closeSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    await this.sessionManager.closeSession(sessionId);
    return {
      success: true,
      message: `Session ${sessionId} closed`,
    };
  }

  getActiveSessions(): string[] {
    return this.sessionManager.getActiveSessions();
  }
}

// Singleton instance
let browserController: BrowserController | null = null;

export const getBrowserController = (): BrowserController => {
  if (!browserController) {
    browserController = new BrowserController();
  }
  return browserController;
};

