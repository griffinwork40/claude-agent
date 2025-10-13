// browser-service/src/browser-tools.ts
// Playwright-based browser automation for job searching (server-side implementation)
import { chromium, Browser, Page } from 'playwright';
import { JobOpportunity } from './types';
import fs from 'fs/promises';

const toRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

// Browser automation service for job searching and application
export class BrowserJobService {
  private browser: Browser | null = null;
  private sessionPath = './linkedin-sessions';

  async initialize() {
    if (this.browser) return;
    
    const launchOptions: any = {
      // Always run headless unless explicitly set to false
      headless: process.env.HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
    };
    
    // Use system chromium if available (Docker/Railway)
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
    
    this.browser = await chromium.launch(launchOptions);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Create a stealth page with anti-detection measures
  private async createStealthPage(): Promise<Page> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();
    
    // Add stealth measures
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
          // Create a proper PermissionStatus-like object
          const mockPermissionStatus = {
            state: Notification.permission,
            name: 'notifications',
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false
          } as PermissionStatus;
          return Promise.resolve(mockPermissionStatus);
        }
        return originalQuery.call(window.navigator.permissions, parameters);
      };
    });
    
    // Set realistic viewport
    await page.setViewportSize({ width: 1366, height: 768 });
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });
    
    return page;
  }

  // Search jobs on Indeed (no authentication required)
  async searchJobsIndeed(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    const page = await this.createStealthPage();
    
    try {
      // Build Indeed search URL
      const searchUrl = this.buildIndeedSearchUrl(params);
      console.log('Searching Indeed:', searchUrl);
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Add random delay to look more human
      await page.waitForTimeout(1000 + Math.random() * 2000);
      
      // Wait for job listings with multiple possible selectors
      await page.waitForSelector('.job_seen_beacon, .jobsearch-ResultsList li, [data-testid="job-card"]', { timeout: 15000 }).catch(() => {
        console.log('Primary selector not found, trying alternative approach');
      });
      
      // Wait a bit for dynamic content
      await page.waitForTimeout(2000 + Math.random() * 1000);
      
      // Extract job listings with multiple selector strategies
      const jobs = await page.evaluate(() => {
        const jobCards = Array.from(document.querySelectorAll('.job_seen_beacon, .jobsearch-ResultsList li, [data-testid="job-card"]'));
        
        return jobCards.slice(0, 10).map((el, index) => {
          const titleEl = el.querySelector('.jobTitle a, .jobTitle span, h2 a, [data-testid="job-title"]');
          const companyEl = el.querySelector('.companyName, [data-testid="company-name"], .company');
          const locationEl = el.querySelector('.companyLocation, [data-testid="job-location"], .location');
          const salaryEl = el.querySelector('.salary-snippet, [data-testid="salary"], .salary');
          const descEl = el.querySelector('.job-snippet, [data-testid="job-snippet"], .description');
          const linkEl = el.querySelector('a[href*="/rc/clk"], a[href*="/viewjob"], h2 a') as HTMLAnchorElement | null;
          
          return {
            id: `indeed_${Date.now()}_${index}`,
            title: titleEl?.textContent?.trim() || 'Unknown Title',
            company: companyEl?.textContent?.trim() || 'Unknown Company',
            location: locationEl?.textContent?.trim() || 'Unknown Location',
            salary: salaryEl?.textContent?.trim() || undefined,
            url: linkEl?.href || '',
            description: descEl?.textContent?.trim() || '',
            application_url: linkEl?.href || '',
            source: 'indeed' as const,
            skills: [],
            experience_level: 'unknown',
            job_type: 'full-time',
            remote_type: 'unknown',
            applied: false,
            status: 'discovered' as const,
            created_at: new Date().toISOString()
          };
        });
      });

      console.log(`Found ${jobs.length} jobs on Indeed`);
      return jobs;
      
    } catch (error: unknown) {
      console.error('Error searching Indeed:', error);
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Indeed search failed: ${errMessage}`);
    } finally {
      await page.close();
    }
  }

  // Search jobs on Google Jobs (no authentication required)
  async searchJobsGoogle(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    const page = await this.createStealthPage();
    
    try {
      // Build Google Jobs search URL
      const searchUrl = this.buildGoogleJobsSearchUrl(params);
      console.log('Searching Google Jobs:', searchUrl);
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Add random delay to look more human
      await page.waitForTimeout(1000 + Math.random() * 2000);
      
      // Wait for Google Jobs results to load
      await page.waitForSelector('[data-ved], .g, .jobsearch-ResultsList', { timeout: 15000 }).catch(() => {
        console.log('Primary selector not found, trying alternative approach');
      });
      
      // Wait a bit for dynamic content
      await page.waitForTimeout(3000 + Math.random() * 1000);
      
      // Extract job listings from Google Jobs
      const jobs = await page.evaluate(() => {
        // Google Jobs can appear in different formats, so we try multiple selectors
        const jobCards = Array.from(document.querySelectorAll(
          '[data-ved] .g, .jobsearch-ResultsList li, [data-testid="job-card"], .g[data-ved]'
        ));
        
        return jobCards.slice(0, 10).map((el, index) => {
          // Try multiple selectors for job title
          const titleEl = el.querySelector('h3 a, h2 a, .jobTitle a, [data-testid="job-title"], .g h3 a') ||
                         el.querySelector('h3, h2, .jobTitle, [data-testid="job-title"]');
          
          // Try multiple selectors for company
          const companyEl = el.querySelector('.companyName, [data-testid="company-name"], .company, .g .company') ||
                           el.querySelector('.company, .companyName');
          
          // Try multiple selectors for location
          const locationEl = el.querySelector('.companyLocation, [data-testid="job-location"], .location, .g .location') ||
                            el.querySelector('.location, .companyLocation');
          
          // Try multiple selectors for salary
          const salaryEl = el.querySelector('.salary-snippet, [data-testid="salary"], .salary, .g .salary') ||
                          el.querySelector('.salary, .salary-snippet');
          
          // Try multiple selectors for description
          const descEl = el.querySelector('.job-snippet, [data-testid="job-snippet"], .description, .g .snippet') ||
                        el.querySelector('.snippet, .job-snippet, .description');
          
          // Try multiple selectors for job link
          const linkEl = el.querySelector('a[href*="/rc/clk"], a[href*="/viewjob"], h3 a, h2 a, .g a') as HTMLAnchorElement | null;
          
          return {
            id: `google_${Date.now()}_${index}`,
            title: titleEl?.textContent?.trim() || 'Unknown Title',
            company: companyEl?.textContent?.trim() || 'Unknown Company',
            location: locationEl?.textContent?.trim() || 'Unknown Location',
            salary: salaryEl?.textContent?.trim() || undefined,
            url: linkEl?.href || '',
            description: descEl?.textContent?.trim() || '',
            application_url: linkEl?.href || '',
            source: 'google' as const,
            skills: [],
            experience_level: 'unknown',
            job_type: 'full-time',
            remote_type: 'unknown',
            applied: false,
            status: 'discovered' as const,
            created_at: new Date().toISOString()
          };
        });
      });

      console.log(`Found ${jobs.length} jobs on Google Jobs`);
      return jobs;
      
    } catch (error: unknown) {
      console.error('Error searching Google Jobs:', error);
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Google Jobs search failed: ${errMessage}`);
    } finally {
      await page.close();
    }
  }

  // Search jobs on LinkedIn (requires authentication)
  async searchJobsLinkedIn(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
    userId: string;
  }): Promise<JobOpportunity[]> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.initializeLinkedInSession(params.userId);
    
    try {
      // Build LinkedIn search URL
      const searchUrl = this.buildLinkedInSearchUrl(params);
      console.log('Searching LinkedIn:', searchUrl);
      
      await page.goto(searchUrl, { waitUntil: 'networkidle' });
      await page.waitForSelector('.jobs-search__results-list', { timeout: 10000 });
      
      // Extract job listings
      const jobs = await page.$$eval('.job-card-container', (elements) => {
        return elements.slice(0, 10).map((el, index) => ({
          id: `linkedin_${Date.now()}_${index}`,
          title: el.querySelector('.job-card-list__title')?.textContent?.trim() || 'Unknown Title',
          company: el.querySelector('.job-card-container__company-name')?.textContent?.trim() || 'Unknown Company',
          location: el.querySelector('.job-card-container__metadata-item')?.textContent?.trim() || 'Unknown Location',
          salary: undefined, // LinkedIn doesn't show salary in search results
          url: (el.querySelector('a') as HTMLAnchorElement | null)?.getAttribute('href') || '',
          description: el.querySelector('.job-card-list__description')?.textContent?.trim() || '',
          application_url: (el.querySelector('a') as HTMLAnchorElement | null)?.getAttribute('href') || '',
          source: 'linkedin' as const,
          skills: [],
          experience_level: 'unknown',
          job_type: 'full-time',
          remote_type: 'unknown',
          applied: false,
          status: 'discovered' as const,
          created_at: new Date().toISOString()
        }));
      });

      console.log(`Found ${jobs.length} jobs on LinkedIn`);
      return jobs;
      
    } catch (error: unknown) {
      console.error('Error searching LinkedIn:', error);
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`LinkedIn search failed: ${errMessage}`);
    } finally {
      await page.close();
    }
  }

  // Get detailed information about a specific job
  async getJobDetails(jobUrl: string): Promise<Partial<JobOpportunity>> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();
    
    try {
      console.log('Getting job details from:', jobUrl);
      await page.goto(jobUrl, { waitUntil: 'networkidle' });
      
      // Wait for job content to load
      await page.waitForTimeout(2000);
      
      const jobDetails = await page.evaluate((currentUrl) => {
        // Extract job description
        const description = document.querySelector('.jobs-description-content__text')?.textContent?.trim() ||
                          document.querySelector('.jobsearch-jobDescriptionText')?.textContent?.trim() ||
                          document.querySelector('.job-description')?.textContent?.trim() || '';
        
        // Extract skills/requirements
        const skills = Array.from(document.querySelectorAll('.jobs-unified-top-card__job-insight, .jobsearch-jobDescriptionText li'))
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 0)
          .slice(0, 10);
        
        // Extract salary if available
        const salary = document.querySelector('.jobs-unified-top-card__job-insight--salary')?.textContent?.trim() ||
                      document.querySelector('.salary-snippet')?.textContent?.trim() || undefined;
        
        // Extract application URL
        const applicationUrl = (document.querySelector('.jobs-apply-button') as HTMLAnchorElement | null)?.getAttribute('href') ||
                              (document.querySelector('a[href*="apply"]') as HTMLAnchorElement | null)?.getAttribute('href') ||
                              currentUrl;
        
        return {
          description,
          skills,
          salary,
          application_url: applicationUrl
        };
      }, jobUrl);

      return jobDetails;
      
    } catch (error: unknown) {
      console.error('Error getting job details:', error);
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get job details: ${errMessage}`);
    } finally {
      await page.close();
    }
  }

  // Apply to a job using user profile data
  async applyToJob(jobUrl: string, userProfile: Record<string, unknown>): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();
    
    try {
      console.log('Applying to job:', jobUrl);
      await page.goto(jobUrl, { waitUntil: 'networkidle' });
      
      // Look for LinkedIn Easy Apply button
      const easyApplyButton = await page.locator('.jobs-apply-button').first();
      if (await easyApplyButton.isVisible()) {
        await easyApplyButton.click();
        await page.waitForTimeout(2000);
        
        // Fill out the application form
        await this.fillLinkedInEasyApply(page, userProfile);
        
        // Submit the application
        const submitButton = await page.locator('button[aria-label*="Submit"], button:has-text("Submit")').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(3000);
          
          // Check for success confirmation
          const successMessage = await page.locator('text=Application submitted, text=Thank you for applying').first();
          if (await successMessage.isVisible()) {
            return {
              success: true,
              message: 'Application submitted successfully via LinkedIn Easy Apply',
              details: { url: jobUrl, method: 'linkedin_easy_apply' }
            };
          }
        }
      }
      
      // Fallback: try to find general application form
      return await this.fillGeneralApplicationForm(page, userProfile);
      
    } catch (error: unknown) {
      console.error('Error applying to job:', error);
      const errMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Application failed: ${errMessage}`,
        details: { url: jobUrl, error: errMessage }
      };
    } finally {
      await page.close();
    }
  }

  // Helper methods
  private buildIndeedSearchUrl(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): string {
    const baseUrl = 'https://www.indeed.com/jobs';
    const urlParams = new URLSearchParams({
      q: params.keywords,
      l: params.location,
      ...(params.remote && { remote: 'true' })
    });
    
    return `${baseUrl}?${urlParams.toString()}`;
  }

  private buildGoogleJobsSearchUrl(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): string {
    // Build search query for Google Jobs
    let query = `${params.keywords} jobs`;
    
    if (params.location && params.location.toLowerCase() !== 'remote') {
      query += ` near ${params.location}`;
    }
    
    if (params.remote) {
      query += ' remote';
    }
    
    if (params.experience_level) {
      query += ` ${params.experience_level} level`;
    }
    
    const baseUrl = 'https://www.google.com/search';
    const urlParams = new URLSearchParams({
      q: query,
      ibp: 'htl;jobs' // This parameter tells Google to show job results
    });
    
    return `${baseUrl}?${urlParams.toString()}`;
  }

  private buildLinkedInSearchUrl(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): string {
    const baseUrl = 'https://www.linkedin.com/jobs/search';
    const urlParams = new URLSearchParams({
      keywords: params.keywords,
      location: params.location,
      ...(params.remote && { f_WT: '2' }), // Remote filter
      ...(params.experience_level && { f_E: this.experienceLevelToCode(params.experience_level) })
    });
    
    return `${baseUrl}?${urlParams.toString()}`;
  }

  private experienceLevelToCode(level: string): string {
    const levels: { [key: string]: string } = {
      'entry': '1',
      'mid': '2', 
      'senior': '3',
      'executive': '4'
    };
    return levels[level.toLowerCase()] || '2';
  }

  private async initializeLinkedInSession(userId: string): Promise<Page> {
    const sessionFile = `${this.sessionPath}/${userId}-linkedin.json`;
    
    // Ensure session directory exists
    await fs.mkdir(this.sessionPath, { recursive: true });
    
    const context = await this.browser!.newContext({
      storageState: await this.fileExists(sessionFile) ? sessionFile : undefined
    });
    
    const page = await context.newPage();
    
    // Check if logged in
    await page.goto('https://www.linkedin.com/jobs');
    const isLoggedIn = await page.locator('[data-test="authentication-wall"]').count() === 0;
    
    if (!isLoggedIn) {
      console.log('LinkedIn login required. Please login in the browser window...');
      // In production, you might want to handle this differently
      await page.waitForURL('**/jobs/**', { timeout: 120000 }); // Wait 2 minutes
      
      // Save session after successful login
      await context.storageState({ path: sessionFile });
      console.log('LinkedIn session saved!');
    }
    
    return page;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async fillLinkedInEasyApply(page: Page, userProfile: Record<string, unknown>) {
    // Fill personal information
    const personalInfo = toRecord(userProfile.personal_info);
    const fullName = typeof personalInfo.name === 'string' ? personalInfo.name : '';
    const nameParts = fullName.split(' ');
    await this.fillField(page, 'input[name*="firstName"], input[name*="first_name"]', nameParts[0] || '');
    await this.fillField(page, 'input[name*="lastName"], input[name*="last_name"]', nameParts.slice(1).join(' ') || '');
    await this.fillField(
      page,
      'input[name*="email"]',
      typeof personalInfo.email === 'string' ? personalInfo.email : ''
    );
    await this.fillField(
      page,
      'input[name*="phone"]',
      typeof personalInfo.phone === 'string' ? personalInfo.phone : ''
    );

    // Handle location
    if (typeof personalInfo.location === 'string') {
      await this.fillField(page, 'input[name*="city"], input[name*="location"]', personalInfo.location);
    }
    
    // Handle work authorization
    const authCheckbox = await page.locator('input[name*="authorized"], input[name*="eligible"]').first();
    if (await authCheckbox.isVisible()) {
      await authCheckbox.check();
    }
    
    // Handle sponsorship
    const workEligibility = toRecord(userProfile.work_eligibility);
    const sponsorshipCheckbox = await page.locator('input[name*="sponsorship"], input[name*="visa"]').first();
    const requiresSponsorship = workEligibility.require_sponsorship;
    const canSkipSponsorship =
      requiresSponsorship === false || requiresSponsorship === 'no' || requiresSponsorship === undefined;
    if (await sponsorshipCheckbox.isVisible() && canSkipSponsorship) {
      await sponsorshipCheckbox.check();
    }
  }

  private async fillGeneralApplicationForm(page: Page, userProfile: Record<string, unknown>) {
    // Generic form filling for non-LinkedIn sites
    const personalInfo = toRecord(userProfile.personal_info);
    const fullName = typeof personalInfo.name === 'string' ? personalInfo.name : '';
    const nameParts = fullName.split(' ');
    await this.fillField(page, 'input[name*="firstName"], input[name*="first_name"]', nameParts[0] || '');
    await this.fillField(page, 'input[name*="lastName"], input[name*="last_name"]', nameParts.slice(1).join(' ') || '');
    await this.fillField(
      page,
      'input[name*="email"]',
      typeof personalInfo.email === 'string' ? personalInfo.email : ''
    );
    await this.fillField(
      page,
      'input[name*="phone"]',
      typeof personalInfo.phone === 'string' ? personalInfo.phone : ''
    );
    
    // Try to submit
    const submitButton = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply")').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(3000);
      
      return {
        success: true,
        message: 'Application submitted successfully',
        details: { method: 'general_form' }
      };
    }
    
    return {
      success: false,
      message: 'Could not find application form or submit button',
      details: { method: 'general_form' }
    };
  }

  private async fillField(page: Page, selector: string, value: string) {
    if (!value) return;
    
    try {
      const field = await page.locator(selector).first();
      if (await field.isVisible()) {
        await field.fill(value);
        await page.waitForTimeout(500);
      }
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.log(`Could not fill field ${selector}: ${errMessage}`);
    }
  }
}

// Singleton instance
let browserJobService: BrowserJobService | null = null;

export const getBrowserJobService = (): BrowserJobService => {
  if (!browserJobService) {
    browserJobService = new BrowserJobService();
  }
  return browserJobService;
};

