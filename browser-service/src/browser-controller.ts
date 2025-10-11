// browser-service/src/browser-controller.ts
// LLM-controlled browser operations (Playwright MCP style)
import { Page } from 'playwright';
import { getBrowserSessionManager } from './browser-session';

export class BrowserController {
  private sessionManager = getBrowserSessionManager();

  async navigate(sessionId: string, url: string): Promise<{ success: boolean; url: string }> {
    const { page } = await this.sessionManager.getOrCreateSession(sessionId);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    return {
      success: true,
      url: page.url(),
    };
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
    const { page } = await this.sessionManager.getOrCreateSession(sessionId);
    
    try {
      await page.click(selector, { timeout: 10000 });
      return {
        success: true,
        message: `Clicked element: ${selector}`,
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to click ${selector}: ${errMessage}`);
    }
  }

  async type(sessionId: string, selector: string, text: string, submit: boolean = false): Promise<{ success: boolean; message: string }> {
    const { page } = await this.sessionManager.getOrCreateSession(sessionId);
    
    try {
      await page.fill(selector, text, { timeout: 10000 });
      
      if (submit) {
        await page.press(selector, 'Enter');
        await page.waitForLoadState('domcontentloaded');
      }
      
      return {
        success: true,
        message: `Typed into ${selector}${submit ? ' and submitted' : ''}`,
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to type into ${selector}: ${errMessage}`);
    }
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

