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
    
    this.browser = await chromium.launch({
      headless: process.env.NODE_ENV === 'production',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Search jobs on Indeed (no authentication required)
  async searchJobsIndeed(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();
    
    try {
      // Build Indeed search URL
      const searchUrl = this.buildIndeedSearchUrl(params);
      console.log('Searching Indeed:', searchUrl);
      
      await page.goto(searchUrl, { waitUntil: 'networkidle' });
      await page.waitForSelector('.job_seen_beacon', { timeout: 10000 });
      
      // Extract job listings
      const jobs = await page.$$eval('.job_seen_beacon', (elements) => {
        return elements.slice(0, 10).map((el, index) => ({
          id: `indeed_${Date.now()}_${index}`,
          title: el.querySelector('.jobTitle a')?.textContent?.trim() || 
                  el.querySelector('.jobTitle')?.textContent?.trim() || 'Unknown Title',
          company: el.querySelector('.companyName')?.textContent?.trim() || 'Unknown Company',
          location: el.querySelector('.companyLocation')?.textContent?.trim() || 'Unknown Location',
          salary: el.querySelector('.salary-snippet')?.textContent?.trim() || undefined,
          url: (el.querySelector('.jobTitle a') as HTMLAnchorElement | null)?.getAttribute('href') || 
               (el.querySelector('.jobTitle') as HTMLAnchorElement | null)?.getAttribute('href') || '',
          description: el.querySelector('.job-snippet')?.textContent?.trim() || '',
          application_url: (el.querySelector('.jobTitle a') as HTMLAnchorElement | null)?.getAttribute('href') || '',
          source: 'indeed' as const,
          skills: [],
          experience_level: 'unknown',
          job_type: 'full-time',
          remote_type: 'unknown',
          applied: false,
          status: 'discovered' as const,
          created_at: new Date().toISOString()
        }));
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

