// browser-service/src/browser-tools.ts
// Playwright-based browser automation for job searching (server-side implementation)
import { chromium, Browser, Page } from 'playwright';
import { JobOpportunity } from './types';
import { getSerpApiClient } from './serp-client';
import fs from 'fs/promises';

const toRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

// Browser automation service for job searching and application
export class BrowserJobService {
  private browser: Browser | null = null;
  private sessionPath = './linkedin-sessions';
  private resultCache = new Map<string, { data: JobOpportunity[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Enhanced retry logic with exponential backoff
  private async withRetryAndFallback<T>(
    operation: () => Promise<T>,
    fallbackUrls: string[] = [],
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          // Return fallback response with manual search URLs
          return this.createFallbackResponse(fallbackUrls, lastError.message) as T;
        }
        
        const delay = 2000 * Math.pow(2, attempt); // Exponential backoff: 2s, 4s, 8s
        console.log(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  // Create fallback response with manual search URLs
  private createFallbackResponse(fallbackUrls: string[], errorMessage: string): JobOpportunity[] {
    const fallbackJobs: JobOpportunity[] = [];
    
    fallbackUrls.forEach((url, index) => {
      fallbackJobs.push({
        id: `fallback_${Date.now()}_${index}`,
        title: 'Manual Search Required',
        company: 'Job Board',
        location: 'Various',
        description: `Automated search failed: ${errorMessage}. Please use the manual search link below.`,
        url: url,
        application_url: url,
        source: 'manual' as const,
        skills: [],
        experience_level: 'unknown',
        job_type: 'full-time',
        remote_type: 'unknown',
        applied: false,
        status: 'fallback' as const,
        created_at: new Date().toISOString(),
        error: errorMessage,
        fallback_url: url
      });
    });
    
    return fallbackJobs;
  }

  // Generate fallback URLs for manual search
  private generateFallbackUrls(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): string[] {
    const urls: string[] = [];
    
    // Indeed fallback
    const indeedUrl = this.buildIndeedSearchUrl(params);
    urls.push(indeedUrl);
    
    // LinkedIn fallback
    const linkedinUrl = this.buildLinkedInSearchUrl(params);
    urls.push(linkedinUrl);
    
    // Google Jobs fallback
    const googleUrl = this.buildGoogleJobsSearchUrl(params);
    urls.push(googleUrl);
    
    return urls;
  }

  // Check cache for recent results
  private getCachedResults(cacheKey: string): JobOpportunity[] | null {
    const cached = this.resultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('📦 Using cached results');
      return cached.data;
    }
    return null;
  }

  // Store results in cache
  private setCachedResults(cacheKey: string, data: JobOpportunity[]): void {
    this.resultCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  // Generate cache key from search parameters
  private getCacheKey(params: { keywords: string; location: string; experience_level?: string; remote?: boolean }): string {
    return `${params.keywords}_${params.location}_${params.experience_level || 'any'}_${params.remote || false}`;
  }

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
    // Check cache first
    const cacheKey = this.getCacheKey(params);
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    const fallbackUrls = this.generateFallbackUrls(params);
    
    const searchUrl = this.buildIndeedSearchUrl(params);
    
    return this.withRetryAndFallback(
      async () => {
        const page = await this.createStealthPage();
        
        try {
          console.log('🔍 Searching Indeed:', searchUrl);
          console.log('📋 Search params:', params);
          
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          // Add random delay to look more human
          await page.waitForTimeout(1000 + Math.random() * 2000);
      
      // Wait for job listings with multiple possible selectors
      console.log('⏳ Waiting for job listings...');
      await page.waitForSelector('.job_seen_beacon, .jobsearch-ResultsList li, [data-testid="job-card"]', { timeout: 15000 }).catch((selectorError) => {
        console.log('⚠️ Primary selector not found, trying alternative approach:', selectorError.message);
      });
      
      // Wait a bit for dynamic content
      await page.waitForTimeout(2000 + Math.random() * 1000);
      
      // Check if we're on the right page
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log('📍 Current page:', { url: currentUrl, title: pageTitle });
      
      // Extract job listings with multiple selector strategies
      const jobs = await page.evaluate(() => {
        const jobCards = Array.from(document.querySelectorAll('.job_seen_beacon, .jobsearch-ResultsList li, [data-testid="job-card"]'));
        console.log(`Found ${jobCards.length} job cards on page`);
        
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

          console.log(`✅ Found ${jobs.length} jobs on Indeed`);
          
          // If no jobs found, return a structured error response instead of empty array
          if (jobs.length === 0) {
            console.log('⚠️ No jobs found - returning error response');
            const errorJobs = [{
              id: `indeed_no_results_${Date.now()}`,
              title: 'No Jobs Found',
              company: 'Indeed',
              location: params.location,
              description: `No job listings found for "${params.keywords}" in ${params.location}. This could be due to: 1) No jobs matching criteria, 2) Indeed's anti-bot protection, 3) Selector changes.`,
              url: searchUrl,
              application_url: '',
              source: 'indeed' as const,
              skills: [],
              experience_level: 'unknown',
              job_type: 'full-time',
              remote_type: 'unknown',
              applied: false,
              status: 'error' as const,
              created_at: new Date().toISOString(),
              error: 'No jobs found - possible selector issues or anti-bot protection'
            }];
            
            // Cache error results for shorter time
            this.setCachedResults(cacheKey, errorJobs);
            return errorJobs;
          }
          
          // Cache successful results
          this.setCachedResults(cacheKey, jobs);
          return jobs;
      
        } catch (error: unknown) {
          const errMessage = error instanceof Error ? error.message : String(error);
          console.error('❌ Indeed search failed:', {
            error: errMessage,
            url: searchUrl,
            params
          });
          
          // Capture page state for debugging
          let pageState = 'unknown';
          let pageTitle = 'unknown';
          try {
            pageState = page.url();
            pageTitle = await page.title();
          } catch {}
          
          // Return structured error instead of throwing
          const errorJobs = [{
            id: `indeed_error_${Date.now()}`,
            title: 'Search Failed',
            company: 'Error',
            location: 'N/A',
            description: `Indeed search failed: ${errMessage}. Page: ${pageState} (${pageTitle})`,
            url: searchUrl,
            application_url: '',
            source: 'indeed' as const,
            skills: [],
            experience_level: 'unknown',
            job_type: 'full-time',
            remote_type: 'unknown',
            applied: false,
            status: 'error' as const,
            created_at: new Date().toISOString(),
            error: errMessage
          }];
          
          // Cache error results
          this.setCachedResults(cacheKey, errorJobs);
          return errorJobs;
        } finally {
          await page.close();
        }
      },
      fallbackUrls
    );
  }

  // Search jobs on Google Jobs using SERP API (no authentication required)
  async searchJobsGoogle(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    // Check cache first
    const cacheKey = this.getCacheKey(params);
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    try {
      console.log('🔍 Searching Google Jobs via SERP API:', params);
      
      const serpClient = getSerpApiClient();
      const jobs = await serpClient.searchGoogleJobs(params);
      
      console.log(`✅ Found ${jobs.length} jobs via SERP API`);
      
      // Cache successful results
      this.setCachedResults(cacheKey, jobs);
      return jobs;
      
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ SERP API Google Jobs search failed:', errMessage);
      
      // Return structured error instead of throwing
      const errorJobs = [{
        id: `google_serp_error_${Date.now()}`,
        title: 'Search Failed',
        company: 'Error',
        location: 'N/A',
        description: `Google Jobs search via SERP API failed: ${errMessage}`,
        url: '',
        application_url: '',
        source: 'google' as const,
        skills: [],
        experience_level: 'unknown',
        job_type: 'full-time',
        remote_type: 'unknown',
        applied: false,
        status: 'error' as const,
        created_at: new Date().toISOString(),
        error: errMessage
      }];
      
      // Cache error results
      this.setCachedResults(cacheKey, errorJobs);
      return errorJobs;
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
    
    const searchUrl = this.buildLinkedInSearchUrl(params);
    
    try {
      console.log('🔍 Searching LinkedIn:', searchUrl);
      console.log('📋 Search params:', params);
      
      await page.goto(searchUrl, { waitUntil: 'networkidle' });
      
      // Check if we're logged in
      const isLoggedIn = await page.locator('[data-test="authentication-wall"]').count() === 0;
      if (!isLoggedIn) {
        console.log('⚠️ LinkedIn authentication required');
        return [{
          id: `linkedin_auth_required_${Date.now()}`,
          title: 'Authentication Required',
          company: 'LinkedIn',
          location: params.location,
          description: `LinkedIn search requires authentication. Please log in to LinkedIn to search for jobs.`,
          url: searchUrl,
          application_url: '',
          source: 'linkedin' as const,
          skills: [],
          experience_level: 'unknown',
          job_type: 'full-time',
          remote_type: 'unknown',
          applied: false,
          status: 'error' as const,
          created_at: new Date().toISOString(),
          error: 'LinkedIn authentication required'
        }];
      }
      
      console.log('⏳ Waiting for LinkedIn job results...');
      await page.waitForSelector('.jobs-search__results-list', { timeout: 10000 }).catch((selectorError) => {
        console.log('⚠️ LinkedIn results selector not found:', selectorError.message);
      });
      
      // Check if we're on the right page
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log('📍 Current page:', { url: currentUrl, title: pageTitle });
      
      // Extract job listings
      const jobs = await page.$$eval('.job-card-container', (elements) => {
        console.log(`Found ${elements.length} job cards on LinkedIn page`);
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

      console.log(`✅ Found ${jobs.length} jobs on LinkedIn`);
      
      // If no jobs found, return a structured error response instead of empty array
      if (jobs.length === 0) {
        console.log('⚠️ No jobs found - returning error response');
        return [{
          id: `linkedin_no_results_${Date.now()}`,
          title: 'No Jobs Found',
          company: 'LinkedIn',
          location: params.location,
          description: `No job listings found for "${params.keywords}" in ${params.location}. This could be due to: 1) No jobs matching criteria, 2) LinkedIn's anti-bot protection, 3) Selector changes, 4) Search query format issues.`,
          url: searchUrl,
          application_url: '',
          source: 'linkedin' as const,
          skills: [],
          experience_level: 'unknown',
          job_type: 'full-time',
          remote_type: 'unknown',
          applied: false,
          status: 'error' as const,
          created_at: new Date().toISOString(),
          error: 'No jobs found - possible selector issues or anti-bot protection'
        }];
      }
      
      return jobs;
      
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ LinkedIn search failed:', {
        error: errMessage,
        url: searchUrl,
        params
      });
      
      // Capture page state for debugging
      let pageState = 'unknown';
      let pageTitle = 'unknown';
      try {
        pageState = page.url();
        pageTitle = await page.title();
      } catch {}
      
      // Return structured error instead of throwing
      return [{
        id: `linkedin_error_${Date.now()}`,
        title: 'Search Failed',
        company: 'Error',
        location: 'N/A',
        description: `LinkedIn search failed: ${errMessage}. Page: ${pageState} (${pageTitle})`,
        url: searchUrl,
        application_url: '',
        source: 'linkedin' as const,
        skills: [],
        experience_level: 'unknown',
        job_type: 'full-time',
        remote_type: 'unknown',
        applied: false,
        status: 'error' as const,
        created_at: new Date().toISOString(),
        error: errMessage
      }];
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

  // Research company information using SERP API
  async researchCompany(companyName: string): Promise<any> {
    try {
      console.log('🔍 Researching company via SERP API:', companyName);
      
      const serpClient = getSerpApiClient();
      const result = await serpClient.researchCompany(companyName);
      
      console.log(`✅ Company research completed for ${companyName}`);
      return result;
      
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ SERP API company research failed:', errMessage);
      
      return {
        company_name: companyName,
        description: `Company research failed: ${errMessage}`,
        created_at: new Date().toISOString()
      };
    }
  }

  // Get salary data using SERP API
  async getSalaryData(params: {
    job_title: string;
    location: string;
    experience_level?: string;
  }): Promise<any> {
    try {
      console.log('💰 Getting salary data via SERP API:', params);
      
      const serpClient = getSerpApiClient();
      const result = await serpClient.getSalaryData(params);
      
      console.log(`✅ Salary data retrieved for ${params.job_title} in ${params.location}`);
      return result;
      
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ SERP API salary data retrieval failed:', errMessage);
      
      return {
        job_title: params.job_title,
        location: params.location,
        salary_ranges: [],
        created_at: new Date().toISOString()
      };
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

