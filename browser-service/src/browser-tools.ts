// browser-service/src/browser-tools.ts
// Playwright-based browser automation for job searching (server-side implementation)
import { chromium, Browser, Page, Frame } from 'playwright';
import { JobOpportunity, JobSearchParams } from './types';
import { getSerpClient } from './serp-client';
import fs from 'fs/promises';

const toRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const stripHtml = (value: string): string =>
  value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

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
    maxRetries: number = 3,
    fallbackOperation?: (error: Error) => Promise<T | null>
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          break;
        }

        const delay = 2000 * Math.pow(2, attempt); // Exponential backoff: 2s, 4s, 8s
        console.log(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (fallbackOperation) {
      try {
        const fallbackResult = await fallbackOperation(lastError);
        if (fallbackResult) {
          return fallbackResult;
        }
      } catch (fallbackError) {
        console.warn('⚠️ Fallback operation failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      }
    }

    return this.createFallbackResponse(fallbackUrls, lastError.message) as T;
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
  private getCacheKey(
    params: { keywords: string; location: string; experience_level?: string; remote?: boolean },
    namespace: string = 'default'
  ): string {
    return [
      namespace,
      params.keywords,
      params.location,
      params.experience_level || 'any',
      params.remote || false
    ].join('|');
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

  // Visit Google landing page once per session to obtain cookies/consent
  private async prepareGoogleSession(page: Page): Promise<void> {
    try {
      console.log('🧭 Preparing Google session');
      await page.goto('https://www.google.com/?hl=en', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000 + Math.random() * 800);

      const consentButtons = await page.$$(
        'button#L2AGLb, button:has-text("Accept all"), button:has-text("Accept & continue"), button:has-text("I agree"), button:has-text("Agree")'
      );

      if (consentButtons.length > 0) {
        console.log('✅ Accepting Google consent dialog');
        await consentButtons[0].click();
        await page.waitForTimeout(800 + Math.random() * 600);
      }
    } catch (error: unknown) {
      console.warn('⚠️ Unable to prepare Google session:', error instanceof Error ? error.message : String(error));
    }
  }

  // Detect Google anti-bot / captcha responses
  private async detectGoogleCaptcha(page: Page): Promise<boolean> {
    try {
      const currentUrl = page.url();
      if (currentUrl.includes('/sorry/') || currentUrl.includes('/recaptcha/')) {
        return true;
      }

      const captchaForm = await page.$('#captcha-form, form[action*="sorry"], form[action*="recaptcha"]');
      if (captchaForm) {
        return true;
      }

      const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase().slice(0, 4000) || '');
      if (!bodyText) return false;

      if (bodyText.includes('unusual traffic') || bodyText.includes('verify that you are not a robot') || bodyText.includes('enter the characters')) {
        return true;
      }
    } catch (error: unknown) {
      console.warn('⚠️ Failed to evaluate captcha state:', error instanceof Error ? error.message : String(error));
    }
    return false;
  }

  // Extract Google Jobs listings from a frame
  private async extractGoogleJobsFromFrame(frame: Frame): Promise<Array<Record<string, unknown>>> {
    try {
      return await frame.evaluate(() => {
        const jobCards: Element[] = [];
        const selectors = [
          '[data-testid="job-card"]',
          '.iFjolb.gws-plugins-horizon-jobs__li-ed',
          'li[role="treeitem"]',
          'div[role="listitem"]',
          'div[jsname="M9KdWb"]',
          'div[data-hveid][data-ved]',
          'div[class*="job-result-card"]',
          'div[class*="PwjeAc"]'
        ];

        for (const selector of selectors) {
          const nodes = document.querySelectorAll(selector);
          nodes.forEach(node => {
            if (!jobCards.includes(node)) {
              jobCards.push(node);
            }
          });
        }

        const getText = (root: Element, textSelectors: string[]): string => {
          for (const selector of textSelectors) {
            const el = root.querySelector(selector);
            if (el && el.textContent) {
              const text = el.textContent.replace(/\s+/g, ' ').trim();
              if (text.length > 0) {
                return text;
              }
            }
          }
          return '';
        };

        const getAttr = (root: Element, attrs: string[]): string => {
          for (const attr of attrs) {
            const value = root.getAttribute?.(attr);
            if (value) {
              return value;
            }
          }
          return '';
        };

        const resolveUrl = (value: string): string => {
          if (!value) return '';
          if (value.startsWith('http://') || value.startsWith('https://')) {
            return value;
          }
          if (value.startsWith('//')) {
            return `https:${value}`;
          }
          if (value.startsWith('/')) {
            try {
              return new URL(value, window.location.origin).toString();
            } catch {
              return value;
            }
          }
          return value;
        };

        return jobCards.slice(0, 20).map((card, index) => {
          const title = getText(card, [
            '[data-testid="job-title"]',
            'h2',
            'h3',
            'a[role="link"]',
            'div[role="heading"]',
            '.BjJfJf',
            '.sH3zD'
          ]);

          const company = getText(card, [
            '[data-testid="company-name"]',
            '.vNEEBe',
            '.nJlQNd',
            '.gws-plugins-horizon-jobs__company-name',
            '.Qk80Jf',
            '.fNKvhd'
          ]);

          const location = getText(card, [
            '[data-testid="job-location"]',
            '.LCX52d',
            '.Qk80Jf',
            '.wHYlTd',
            '.gws-plugins-horizon-jobs__location',
            '.iFjolb span'
          ]);

          const salary = getText(card, [
            '[data-testid="salary"]',
            '.LL4CD',
            '.Q8K3Le',
            '.gws-plugins-horizon-jobs__salary'
          ]);

          const description = getText(card, [
            '[data-testid="job-snippet"]',
            '.HBvzbc',
            '.sMzDkb',
            '.gws-plugins-horizon-jobs__job-description-snippet'
          ]);

          let url = '';
          const linkCandidates = [
            'a[data-share-url]',
            'a[data-url]',
            'a[data-href]',
            'a[href^="https://www.google.com/url"]',
            'a[href^="https://"]',
            'a[href^="http://"]',
            'a[href]'
          ];

          for (const selector of linkCandidates) {
            const anchor = card.querySelector(selector);
            if (anchor instanceof HTMLAnchorElement && anchor.href) {
              url = resolveUrl(anchor.href);
              break;
            }

            if (!url && anchor) {
              const dataHref = anchor.getAttribute('data-share-url') || anchor.getAttribute('data-url') || anchor.getAttribute('data-href');
              if (dataHref) {
                url = resolveUrl(dataHref);
                break;
              }
            }
          }

          if (!url) {
            const attrUrl = getAttr(card, ['data-share-url', 'data-url', 'data-href', 'data-ol-href', 'data-job-url']);
            url = resolveUrl(attrUrl);
          }

          const textContent = (card.textContent || '').toLowerCase();
          const remoteHint = textContent.includes('remote') ? 'remote' : textContent.includes('hybrid') ? 'hybrid' : 'unknown';
          const postedAt = getText(card, ['[data-testid="post-date"]', '.LL4CD span', '.gws-plugins-horizon-jobs__posting-time', '.WVWNg']);

          return {
            id: getAttr(card, ['data-id', 'data-job-id', 'data-ved']) || `frame_${index}`,
            title,
            company,
            location,
            salary,
            url,
            description,
            postedAt,
            remoteHint
          };
        }).filter(job => job.title || job.company || job.url);
      });
    } catch (error: unknown) {
      console.warn('⚠️ Failed to extract jobs from frame:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  private normalizeGoogleJobs(
    rawJobs: Array<Record<string, unknown>>,
    params: { keywords: string; location: string; experience_level?: string; remote?: boolean },
    searchUrl: string
  ): JobOpportunity[] {
    const normalized = new Map<string, JobOpportunity>();
    const now = Date.now();

    rawJobs.forEach((job, index) => {
      const title = String(job.title || '').trim() || 'Unknown Title';
      const company = String(job.company || '').trim() || 'Unknown Company';
      const location = String(job.location || '').trim() || (params.remote ? 'Remote' : params.location || 'Unknown Location');
      const salaryRaw = String(job.salary || '').trim();
      let url = String(job.url || '').trim();
      if (!url) {
        url = searchUrl;
      }

      if (url.startsWith('/')) {
        url = `https://www.google.com${url}`;
      }

      const description = String(job.description || '').trim();
      const remoteHint = String(job.remoteHint || '').toLowerCase();
      const remoteType =
        remoteHint === 'remote' || location.toLowerCase().includes('remote') || params.remote
          ? 'remote'
          : remoteHint === 'hybrid' || location.toLowerCase().includes('hybrid')
            ? 'hybrid'
            : 'unknown';

      const jobType = 'full-time';
      const experienceLevel = params.experience_level || 'unknown';
      const salary = salaryRaw.length > 0 ? salaryRaw : undefined;

      const normalizedJob: JobOpportunity = {
        id: String(job.id || `google_${now}_${index}`),
        title,
        company,
        location,
        salary,
        url,
        description,
        application_url: url,
        source: 'google',
        skills: [],
        experience_level: experienceLevel,
        job_type: jobType,
        remote_type: remoteType as 'remote' | 'hybrid' | 'unknown',
        applied: false,
        status: 'discovered',
        created_at: new Date().toISOString()
      };

      const dedupeKey = `${normalizedJob.title.toLowerCase()}__${normalizedJob.company.toLowerCase()}__${normalizedJob.location.toLowerCase()}__${normalizedJob.url}`;
      if (!normalized.has(dedupeKey)) {
        normalized.set(dedupeKey, normalizedJob);
      }
    });

    return Array.from(normalized.values()).slice(0, 10);
  }

  private async fetchGoogleJobsViaSerpApi(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[] | null> {
    const apiKey = process.env.SERPAPI_API_KEY || process.env.GOOGLE_JOBS_SERPAPI_KEY;
    if (!apiKey) {
      return null;
    }

    try {
      const queryParts = [params.keywords, 'jobs'];
      if (params.remote) queryParts.push('remote');
      if (params.location && params.location.toLowerCase() !== 'remote') {
        queryParts.push(params.location);
      }
      if (params.experience_level) {
        queryParts.push(params.experience_level);
      }

      const apiUrl = new URL('https://serpapi.com/search.json');
      apiUrl.searchParams.set('engine', 'google_jobs');
      apiUrl.searchParams.set('api_key', apiKey);
      apiUrl.searchParams.set('q', queryParts.join(' ').trim());
      if (params.location) {
        apiUrl.searchParams.set('location', params.location);
      }

      console.log('🌐 Fetching Google Jobs via SerpApi:', apiUrl.toString());

      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        console.warn('⚠️ SerpApi request failed:', response.status, await response.text());
        return null;
      }

      const data = await response.json();
      const jobs = Array.isArray(data?.jobs_results) ? data.jobs_results : [];

      if (!jobs.length) {
        return null;
      }

      const normalizedJobs: JobOpportunity[] = jobs.slice(0, 10).map((job: Record<string, unknown>, index: number) => {
        const detectedExtensions = job.detected_extensions as Record<string, unknown> | undefined;
        const salary = typeof detectedExtensions?.salary === 'string' ? detectedExtensions.salary : undefined;
        const shareLink = typeof job.share_link === 'string' ? job.share_link : '';
        const applyLink = Array.isArray(job.apply_options)
          ? job.apply_options.find((option: Record<string, unknown>) => typeof option?.link === 'string')?.link
          : undefined;
        const relatedLink = Array.isArray(job.related_links)
          ? job.related_links.find((link: Record<string, unknown>) => typeof link?.link === 'string')?.link
          : undefined;

        const url = (shareLink || applyLink || relatedLink || '') as string;

        return {
          id: typeof job.job_id === 'string' ? `google_serpapi_${job.job_id}` : `google_serpapi_${Date.now()}_${index}`,
          title: typeof job.title === 'string' ? job.title : 'Unknown Title',
          company: typeof job.company_name === 'string' ? job.company_name : (typeof job.via === 'string' ? job.via : 'Unknown Company'),
          location: typeof job.location === 'string' ? job.location : (params.location || 'Unknown Location'),
          salary,
          url,
          description: typeof job.description === 'string'
            ? job.description
            : Array.isArray(job.job_highlights)
              ? (job.job_highlights as Array<Record<string, unknown>>)
                  .flatMap(highlight => Array.isArray(highlight?.items) ? highlight.items : [])
                  .filter(item => typeof item === 'string')
                  .slice(0, 3)
                  .join('\n')
              : '',
          application_url: url,
          source: 'google',
          skills: [],
          experience_level: params.experience_level || 'unknown',
          job_type: typeof detectedExtensions?.schedule_type === 'string' ? detectedExtensions.schedule_type : 'full-time',
          remote_type: params.remote || (typeof detectedExtensions?.work_from_home === 'boolean' && detectedExtensions.work_from_home)
            ? 'remote'
            : 'unknown',
          applied: false,
          status: 'discovered',
          created_at: new Date().toISOString()
        };
      });

      const filteredJobs = normalizedJobs.filter((job: JobOpportunity) => Boolean(job.url && job.url.length > 0));

      if (!filteredJobs.length) {
        return null;
      }

      console.log(`✅ Retrieved ${filteredJobs.length} jobs from SerpApi`);
      return filteredJobs;
    } catch (error: unknown) {
      console.error('❌ SerpApi request failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private async fetchJobsViaRemotive(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[] | null> {
    const remotiveUrl = new URL('https://remotive.com/api/remote-jobs');
    const queryParts: string[] = [];

    if (params.keywords) {
      queryParts.push(params.keywords);
    }
    if (params.experience_level) {
      queryParts.push(params.experience_level);
    }

    if (queryParts.length) {
      remotiveUrl.searchParams.set('search', queryParts.join(' ').trim());
    }

    if (params.location && params.location.trim().length && !params.remote && params.location.toLowerCase() !== 'remote') {
      remotiveUrl.searchParams.set('location', params.location);
    }

    try {
      console.log('🌐 Attempting Remotive API fallback:', remotiveUrl.toString());
      const response = await fetch(remotiveUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'claude-agent-job-search/1.0 (+https://remotive.com/)',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        console.warn('⚠️ Remotive API responded with non-OK status:', response.status);
        return null;
      }

      const data = await response.json();
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

      if (!jobs.length) {
        console.warn('⚠️ Remotive API returned no jobs for query');
        return null;
      }

      const requestedLocation = params.location?.toLowerCase() || '';
      const isRemoteQuery = params.remote || requestedLocation === 'remote';

      const normalizedJobs: JobOpportunity[] = jobs
        .filter((job: Record<string, unknown>) => {
          if (isRemoteQuery) {
            return true;
          }
          const candidateLocation = String(job?.candidate_required_location || '').toLowerCase();
          if (!candidateLocation) {
            return true;
          }
          return candidateLocation.includes(requestedLocation) || requestedLocation.includes(candidateLocation);
        })
        .slice(0, 10)
        .map((job: Record<string, unknown>, index: number) => {
          const idValue = typeof job.id === 'number' || typeof job.id === 'string' ? job.id : `${Date.now()}_${index}`;
          const rawDescription = typeof job.description === 'string' ? job.description : '';
          const cleanedDescription = stripHtml(rawDescription).slice(0, 600);
          const jobTypeRaw = typeof job.job_type === 'string' ? job.job_type : 'full_time';
          const jobType = jobTypeRaw.replace(/_/g, ' ').toLowerCase();
          const publicationDate = typeof job.publication_date === 'string' ? job.publication_date : undefined;
          const createdAt = publicationDate ? new Date(publicationDate).toISOString() : new Date().toISOString();
          const salary = typeof job.salary === 'string' && job.salary.trim().length > 0 ? job.salary.trim() : undefined;
          const tags = Array.isArray(job.tags) ? job.tags.filter((tag) => typeof tag === 'string').slice(0, 10) : [];
          const url = typeof job.url === 'string' ? job.url : '';
          const company = typeof job.company_name === 'string' ? job.company_name : 'Unknown Company';
          const location = typeof job.candidate_required_location === 'string' && job.candidate_required_location.trim().length
            ? job.candidate_required_location.trim()
            : params.location || 'Remote';

          return {
            id: `remotive_${idValue}`,
            title: typeof job.title === 'string' ? job.title : 'Unknown Title',
            company,
            location,
            salary,
            url,
            description: cleanedDescription,
            application_url: url,
            source: 'remotive',
            skills: tags,
            experience_level: params.experience_level || 'unknown',
            job_type: jobType,
            remote_type: 'remote',
            applied: false,
            status: 'discovered',
            created_at: createdAt,
            raw_data: toRecord(job)
          };
        });

      if (!normalizedJobs.length) {
        return null;
      }

      console.log(`✅ Retrieved ${normalizedJobs.length} jobs from Remotive fallback`);
      return normalizedJobs;
    } catch (error: unknown) {
      console.warn('⚠️ Remotive fallback failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  // Search jobs on Indeed using APIs (SerpAPI → Remotive → manual link)
  async searchJobsIndeed(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    // Check cache first
    const cacheKey = this.getCacheKey(params, 'indeed');
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    const remotePreference = params.remote ?? params.location.trim().toLowerCase() === 'remote';

    try {
      console.log('🔍 Searching Indeed via SerpAPI:', params);
      
      // 1. Try SerpAPI first (Google Jobs aggregated)
      const serpJobs = await this.fetchGoogleJobsViaSerpApi(params);
      if (serpJobs && serpJobs.length) {
        console.log(`✅ Found ${serpJobs.length} jobs via SerpAPI`);
        this.setCachedResults(cacheKey, serpJobs);
        return serpJobs;
      }

      console.log('⚠️ SerpAPI returned no results, trying Remotive...');
      
      // 2. Try Remotive as fallback
        const remotiveJobs = await this.fetchJobsViaRemotive({ ...params, remote: remotePreference });
        if (remotiveJobs && remotiveJobs.length) {
        console.log(`✅ Found ${remotiveJobs.length} jobs via Remotive`);
          this.setCachedResults(cacheKey, remotiveJobs);
          return remotiveJobs;
        }

      console.log('⚠️ Both APIs failed, returning manual search link');
      
      // 3. Return error with manual search link
      const searchUrl = this.buildIndeedSearchUrl(params);
      throw new Error(`Automated job search failed. Please use this manual search link: ${searchUrl}`);
      
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Indeed API search failed:', errMessage);
      
      // Return error with manual search link
      const searchUrl = this.buildIndeedSearchUrl(params);
      throw new Error(`Indeed automated search is currently unavailable. Please use this manual search link: ${searchUrl}`);
    }
  }

  // Search jobs on Google Jobs using APIs (SerpAPI → Remotive → manual link)
  async searchJobsGoogle(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    // Check cache first
    const cacheKey = this.getCacheKey(params, 'google');
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    const remotePreference = params.remote ?? params.location.trim().toLowerCase() === 'remote';

    try {
      console.log('🔍 Searching Google Jobs via SerpAPI:', params);
      
      // 1. Try SerpAPI first (Google Jobs API)
      const serpJobs = await this.fetchGoogleJobsViaSerpApi(params);
      if (serpJobs && serpJobs.length) {
        console.log(`✅ Found ${serpJobs.length} jobs via SerpAPI`);
        this.setCachedResults(cacheKey, serpJobs);
        return serpJobs;
      }

      console.log('⚠️ SerpAPI returned no results, trying Remotive...');
      
      // 2. Try Remotive as fallback
      const remotiveJobs = await this.fetchJobsViaRemotive({ ...params, remote: remotePreference });
      if (remotiveJobs && remotiveJobs.length) {
        console.log(`✅ Found ${remotiveJobs.length} jobs via Remotive`);
        this.setCachedResults(cacheKey, remotiveJobs);
        return remotiveJobs;
      }

      console.log('⚠️ Both APIs failed, returning manual search link');
      
      // 3. Return error with manual search link
      const searchUrl = this.buildGoogleJobsSearchUrl(params);
      throw new Error(`Automated job search failed. Please use this manual search link: ${searchUrl}`);
      
        } catch (error: unknown) {
          const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Google Jobs API search failed:', errMessage);
      
      // Return error with manual search link
      const searchUrl = this.buildGoogleJobsSearchUrl(params);
      throw new Error(`Google Jobs automated search is currently unavailable. Please use this manual search link: ${searchUrl}`);
    }
  }

  async searchJobsSerp(params: JobSearchParams): Promise<JobOpportunity[]> {
    const serpClient = getSerpClient();
    return serpClient.searchJobs(params);
  }

  // Search jobs on LinkedIn (returns manual search link - no good API available)
  async searchJobsLinkedIn(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
    userId: string;
  }): Promise<JobOpportunity[]> {
    console.log('🔍 LinkedIn search requested - returning manual search link');
    
    const searchUrl = this.buildLinkedInSearchUrl(params);
    
    // LinkedIn has no good public API, return manual search link immediately
    throw new Error(`LinkedIn automated search is not available. Please use this manual search link: ${searchUrl}`);
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

  // Extract company application URL from job board listing
  async extractCompanyApplicationUrl(jobBoardUrl: string): Promise<{ companyApplicationUrl: string | null; requiresJobBoard: boolean }> {
    if (!this.browser) {
      await this.initialize();
    }

    // First, check if this is already a direct company application URL (ATS platforms)
    const atsPlatforms = [
      'ashbyhq.com',
      'greenhouse.io', 
      'workday.com',
      'bamboohr.com',
      'lever.co',
      'smartrecruiters.com',
      'jobvite.com',
      'icims.com',
      'taleo.net',
      'successfactors.com',
      'workable.com',
      'recruitee.com',
      'breezy.hr',
      'personio.com',
      'zoho.com/recruit',
      'hiring.workday.com',
      'jobs.lever.co',
      'boards.greenhouse.io',
      'careers.smartrecruiters.com'
    ];

    const url = new URL(jobBoardUrl);
    const isAtsPlatform = atsPlatforms.some(platform => url.hostname.includes(platform));
    
    if (isAtsPlatform) {
      console.log('✓ URL is already a direct company application (ATS platform):', jobBoardUrl);
      return {
        companyApplicationUrl: jobBoardUrl,
        requiresJobBoard: false
      };
    }

    const page = await this.createStealthPage();
    
    try {
      console.log('🔍 Extracting company URL from:', jobBoardUrl);
      await page.goto(jobBoardUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      let companyUrl: string | null = null;
      
      // Try Indeed selectors
      if (jobBoardUrl.includes('indeed.com')) {
        // Look for "Apply on company website" button
        const selectors = [
          '[data-indeed-apply-button-type="offsite"]',
          'a[href*="company"]:has-text("Apply on company website")',
          'a[href*="apply"]:has-text("Company website")',
          '.jobsearch-IndeedApplyButton-newDesign[href*="http"]'
        ];
        
        for (const selector of selectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 })) {
              companyUrl = await element.getAttribute('href');
              if (companyUrl && !companyUrl.includes('indeed.com')) {
                console.log('✓ Found company URL via selector:', selector);
                break;
              }
            }
          } catch {
            continue;
          }
        }
      }
      
      // Try LinkedIn selectors
      if (jobBoardUrl.includes('linkedin.com')) {
        const selectors = [
          '[data-tracking-control-name="public_jobs_apply-link-offsite"]',
          'a[href*="apply"]:has-text("Apply on company website")',
          '.jobs-apply-button--top-card a[href*="http"]'
        ];
        
        for (const selector of selectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 })) {
              companyUrl = await element.getAttribute('href');
              if (companyUrl && !companyUrl.includes('linkedin.com')) {
                console.log('✓ Found company URL via selector:', selector);
                break;
              }
            }
          } catch {
            continue;
          }
        }
      }
      
      // Generic fallback: look for external links with application-related text
      if (!companyUrl) {
        const genericSelectors = [
          'a:has-text("Apply on company")',
          'a:has-text("Apply directly")',
          'a:has-text("Company website")',
          'a[href*="careers"]:has-text("Apply")',
          'a[href*="jobs"]:has-text("Apply")',
          'a[href*="apply"]:has-text("Apply")',
          'a[href*="application"]:has-text("Apply")'
        ];
        
        for (const selector of genericSelectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 1000 })) {
              companyUrl = await element.getAttribute('href');
              if (companyUrl && !companyUrl.includes('indeed.com') && !companyUrl.includes('linkedin.com')) {
                console.log('✓ Found company URL via generic selector:', selector);
                break;
              }
            }
          } catch {
            continue;
          }
        }
      }

      // Additional check: if the current page looks like an application form, it might be a direct application
      if (!companyUrl) {
        try {
          const pageTitle = await page.title();
          const hasApplicationKeywords = [
            'application', 'apply', 'careers', 'jobs', 'employment', 'join our team',
            'work with us', 'opportunity', 'position'
          ].some(keyword => 
            pageTitle.toLowerCase().includes(keyword) || 
            jobBoardUrl.toLowerCase().includes(keyword)
          );

          // Check if page has form elements typical of job applications
          const hasFormElements = await page.locator('form, input[type="text"], input[type="email"], textarea, select').count() > 0;
          
          if (hasApplicationKeywords && hasFormElements) {
            console.log('✓ Page appears to be a direct application form');
            companyUrl = jobBoardUrl;
          }
        } catch {
          // Ignore errors in this check
        }
      }
      
      await page.close();
      
      if (companyUrl) {
        // Ensure full URL
        if (companyUrl.startsWith('/')) {
          const url = new URL(jobBoardUrl);
          companyUrl = `${url.protocol}//${url.host}${companyUrl}`;
        }
        
        return {
          companyApplicationUrl: companyUrl,
          requiresJobBoard: false
        };
      }
      
      console.log('ℹ️ No company application URL found - requires job board application');
      return {
        companyApplicationUrl: null,
        requiresJobBoard: true
      };
      
    } catch (error: unknown) {
      await page.close();
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error extracting company URL:', errMessage);
      throw new Error(`Failed to extract company URL: ${errMessage}`);
    }
  }

  // Find company careers page via Google search
  async findCompanyCareersPage(companyName: string, jobTitle?: string): Promise<{ careersUrl: string; companyWebsite: string }> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.createStealthPage();
    
    try {
      // Build search query
      const searchQuery = `"${companyName}" careers OR jobs ${jobTitle || ''}`.trim();
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      
      console.log('🔍 Searching Google for careers page:', searchQuery);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      // Extract search results
      const results = await page.locator('div.g a[href]').evaluateAll((elements) => {
        return elements
          .map(el => (el as HTMLAnchorElement).href)
          .filter(href => href && !href.includes('google.com') && !href.includes('indeed.com') && !href.includes('linkedin.com'));
      });
      
      let careersUrl = '';
      let companyWebsite = '';
      
      // Find careers page (contains career/jobs/apply keywords)
      const careersKeywords = ['career', 'careers', 'jobs', 'apply', 'join', 'opportunities', 'hiring'];
      for (const url of results) {
        const lowerUrl = url.toLowerCase();
        if (careersKeywords.some(keyword => lowerUrl.includes(keyword))) {
          careersUrl = url;
          break;
        }
      }
      
      // Find company homepage (first result without career keywords)
      for (const url of results) {
        const lowerUrl = url.toLowerCase();
        if (!careersKeywords.some(keyword => lowerUrl.includes(keyword))) {
          companyWebsite = url;
          break;
        }
      }
      
      // If no distinct homepage found, use careers URL as base
      if (!companyWebsite && careersUrl) {
        try {
          const urlObj = new URL(careersUrl);
          companyWebsite = `${urlObj.protocol}//${urlObj.host}`;
        } catch {
          companyWebsite = careersUrl;
        }
      }
      
      // If no careers page found, use first result
      if (!careersUrl && results.length > 0) {
        careersUrl = results[0];
        companyWebsite = results[0];
      }
      
      await page.close();
      
      if (!careersUrl) {
        throw new Error(`No careers page found for ${companyName}`);
      }
      
      console.log('✓ Found careers page:', careersUrl);
      return {
        careersUrl,
        companyWebsite: companyWebsite || careersUrl
      };
      
    } catch (error: unknown) {
      await page.close();
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error finding careers page:', errMessage);
      throw new Error(`Failed to find careers page: ${errMessage}`);
    }
  }

  // Search jobs on Greenhouse using API
  async searchJobsGreenhouse(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    // Check cache first
    const cacheKey = this.getCacheKey(params, 'greenhouse');
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    try {
      console.log('🔍 Searching Greenhouse jobs:', params);
      
      // Import Greenhouse client from local copy
      const { GreenhouseClient } = await import('./greenhouse-client');
      const greenhouseClient = new GreenhouseClient();
      
      const filters = {
        keywords: params.keywords,
        location: params.location,
        experience_level: params.experience_level,
        remote: params.remote
      };
      
      const jobs = await greenhouseClient.searchJobsDefault(filters);
      
      console.log(`✅ Found ${jobs.length} jobs on Greenhouse`);
      this.setCachedResults(cacheKey, jobs);
      return jobs;
      
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Greenhouse search failed:', errMessage);
      throw new Error(`Greenhouse search failed: ${errMessage}`);
    }
  }

  // Apply to a Greenhouse job using API first, then browser automation fallback
  async applyToGreenhouseJob(
    boardToken: string, 
    jobId: string, 
    userProfile: Record<string, unknown>
  ): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      console.log(`📝 Applying to Greenhouse job: ${boardToken}/${jobId}`);
      
      // Import Greenhouse client from local copy
      const { GreenhouseClient } = await import('./greenhouse-client');
      const greenhouseClient = new GreenhouseClient();
      
      // First, try API submission
      try {
        const formData = this.buildGreenhouseFormData(userProfile);
        const result = await greenhouseClient.submitApplication(boardToken, jobId, formData);
        
        if (result.success) {
          console.log('✅ Application submitted via Greenhouse API');
          return {
            success: true,
            message: 'Application submitted successfully via Greenhouse API',
            details: { 
              method: 'greenhouse_api', 
              boardToken, 
              jobId, 
              applicationId: result.application_id 
            }
          };
        } else {
          console.log('⚠️ Greenhouse API submission failed, trying browser automation...');
        }
      } catch (apiError) {
        console.log('⚠️ Greenhouse API error, trying browser automation:', apiError);
      }
      
      // Fallback to browser automation
      if (!this.browser) {
        await this.initialize();
      }
      
      const page = await this.createStealthPage();
      
      try {
        const jobUrl = `https://boards.greenhouse.io/${boardToken}/jobs/${jobId}`;
        console.log('🌐 Opening job page for browser automation:', jobUrl);
        
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // Look for application form
        const applicationForm = await page.locator('form[action*="apply"], form[action*="application"]').first();
        if (await applicationForm.isVisible()) {
          console.log('📝 Filling out Greenhouse application form');
          await this.fillGreenhouseApplicationForm(page, userProfile);
          
          // Submit the form
          const submitButton = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply")').first();
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(3000);
            
            // Check for success confirmation
            const successMessage = await page.locator('text=Application submitted, text=Thank you for applying, text=Success').first();
            if (await successMessage.isVisible()) {
              return {
                success: true,
                message: 'Application submitted successfully via browser automation',
                details: { method: 'browser_automation', boardToken, jobId }
              };
            }
          }
        }
        
        return {
          success: false,
          message: 'Could not find application form or submit button',
          details: { method: 'browser_automation', boardToken, jobId }
        };
        
      } finally {
        await page.close();
      }
      
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error applying to Greenhouse job:', errMessage);
      return {
        success: false,
        message: `Application failed: ${errMessage}`,
        details: { method: 'greenhouse', boardToken, jobId, error: errMessage }
      };
    }
  }

  // Build form data for Greenhouse API submission
  private buildGreenhouseFormData(userProfile: Record<string, unknown>): Record<string, any> {
    const personalInfo = toRecord(userProfile.personal_info);
    const experience = toRecord(userProfile.experience);
    
    const formData: Record<string, any> = {
      // Basic personal information
      first_name: typeof personalInfo.name === 'string' ? personalInfo.name.split(' ')[0] : '',
      last_name: typeof personalInfo.name === 'string' ? personalInfo.name.split(' ').slice(1).join(' ') : '',
      email: typeof personalInfo.email === 'string' ? personalInfo.email : '',
      phone: typeof personalInfo.phone === 'string' ? personalInfo.phone : '',
      location: typeof personalInfo.location === 'string' ? personalInfo.location : '',
      
      // Experience information
      resume: typeof userProfile.resume_path === 'string' ? userProfile.resume_path : '',
      cover_letter: typeof userProfile.cover_letter === 'string' ? userProfile.cover_letter : '',
      
      // Skills
      skills: Array.isArray(experience.skills) ? experience.skills.join(', ') : '',
      
      // Work authorization
      authorized_to_work: true,
      requires_sponsorship: false,
      
      // Additional fields that might be required
      linkedin_url: typeof userProfile.linkedin_url === 'string' ? userProfile.linkedin_url : '',
      github_url: typeof userProfile.github_url === 'string' ? userProfile.github_url : '',
      portfolio_url: typeof userProfile.portfolio_url === 'string' ? userProfile.portfolio_url : '',
    };
    
    return formData;
  }

  // Fill out Greenhouse application form using browser automation
  private async fillGreenhouseApplicationForm(page: Page, userProfile: Record<string, unknown>) {
    const personalInfo = toRecord(userProfile.personal_info);
    const experience = toRecord(userProfile.experience);
    
    // Fill basic information
    const fullName = typeof personalInfo.name === 'string' ? personalInfo.name : '';
    const nameParts = fullName.split(' ');
    
    await this.fillField(page, 'input[name*="first_name"], input[name*="firstName"]', nameParts[0] || '');
    await this.fillField(page, 'input[name*="last_name"], input[name*="lastName"]', nameParts.slice(1).join(' ') || '');
    await this.fillField(page, 'input[name*="email"]', typeof personalInfo.email === 'string' ? personalInfo.email : '');
    await this.fillField(page, 'input[name*="phone"]', typeof personalInfo.phone === 'string' ? personalInfo.phone : '');
    await this.fillField(page, 'input[name*="location"], input[name*="city"]', typeof personalInfo.location === 'string' ? personalInfo.location : '');
    
    // Fill experience information
    if (Array.isArray(experience.skills)) {
      await this.fillField(page, 'textarea[name*="skills"], input[name*="skills"]', experience.skills.join(', '));
    }
    
    // Handle work authorization
    const authCheckbox = await page.locator('input[name*="authorized"], input[name*="eligible"]').first();
    if (await authCheckbox.isVisible()) {
      await authCheckbox.check();
    }
    
    // Handle sponsorship
    const sponsorshipCheckbox = await page.locator('input[name*="sponsorship"], input[name*="visa"]').first();
    if (await sponsorshipCheckbox.isVisible()) {
      await sponsorshipCheckbox.check();
    }
    
    // Fill additional fields
    await this.fillField(page, 'input[name*="linkedin"]', typeof userProfile.linkedin_url === 'string' ? userProfile.linkedin_url : '');
    await this.fillField(page, 'input[name*="github"]', typeof userProfile.github_url === 'string' ? userProfile.github_url : '');
    await this.fillField(page, 'input[name*="portfolio"]', typeof userProfile.portfolio_url === 'string' ? userProfile.portfolio_url : '');
    
    // Handle file uploads (resume, cover letter)
    if (typeof userProfile.resume_path === 'string') {
      const resumeInput = await page.locator('input[type="file"][name*="resume"], input[type="file"][name*="cv"]').first();
      if (await resumeInput.isVisible()) {
        await resumeInput.setInputFiles(userProfile.resume_path);
      }
    }
    
    if (typeof userProfile.cover_letter === 'string') {
      await this.fillField(page, 'textarea[name*="cover"], textarea[name*="letter"]', userProfile.cover_letter);
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
