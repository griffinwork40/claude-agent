// browser-service/src/serp-client.ts
// Lightweight SERP API client that follows the existing browser service patterns
import { JobOpportunity, JobSearchParams } from './types';

// Conditional import for SERP API - only available in browser-service environment
let SerpApi: any = null;
try {
  // Use dynamic import to avoid build-time issues
  SerpApi = require('google-search-results-nodejs');
} catch (error) {
  // This is expected in Vercel builds - SERP API is only available in browser-service
  console.warn('⚠️ google-search-results-nodejs not available, SERP API will use fallback mode');
}

type SerpApiModule = {
  GoogleSearch: new (apiKey: string) => GoogleSearchClient;
};

type GoogleSearchClient = {
  json: (params: Record<string, unknown>, callback: (data: GoogleJobsResponse) => void) => void;
};

interface GoogleJobsResponse {
  jobs_results?: GoogleJobsResult[];
  error?: string;
  [key: string]: unknown;
}

interface GoogleJobsResult {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  detected_extensions?: {
    schedule_type?: string;
    salary?: string;
    job_type?: string;
    work_from_home?: boolean;
    remote?: boolean;
    experience_level?: string;
  };
  extensions?: string[];
  apply_link?: string;
  apply_options?: Array<{
    link?: string;
    text?: string;
  }>;
  related_links?: Array<{
    link: string;
    text?: string;
  }>;
  share_link?: string;
  link?: string;
  via?: string;
  salary?: string;
  [key: string]: unknown;
}

export interface SerpClientOptions {
  apiKey?: string;
  cacheTtlMs?: number;
  maxRetries?: number;
}

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_RETRIES = 2;

export class SerpClient {
  private readonly apiKey?: string;
  private readonly cacheTtl: number;
  private readonly maxRetries: number;
  private client: GoogleSearchClient | null = null;
  private resultCache = new Map<string, { data: JobOpportunity[]; timestamp: number }>();

  constructor(options: SerpClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.SERP_API_KEY ?? process.env.SERPAPI_API_KEY;
    this.cacheTtl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

    if (!this.apiKey) {
      console.warn(
        '⚠️  SERP_API_KEY is not configured. SERP searches will return fallback responses until the key is provided.'
      );
      return;
    }

    if (!SerpApi) {
      console.warn('⚠️ SerpApi module not available, using fallback mode');
      this.client = null;
      return;
    }

    try {
      const serpApiModule = SerpApi as unknown as SerpApiModule;
      this.client = new serpApiModule.GoogleSearch(this.apiKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to initialize SerpApi client:', message);
      this.client = null;
    }
  }

  async searchJobs(params: JobSearchParams): Promise<JobOpportunity[]> {
    const cacheKey = this.getCacheKey(params);
    const cached = this.getCachedResults(cacheKey);
    if (cached) {
      return cached;
    }

    const fallbackUrls = this.generateFallbackUrls(params);

    if (!this.client) {
      const fallback = this.createFallbackResponse(
        fallbackUrls,
        'SERP API key is not configured. Please add SERP_API_KEY to the environment.',
        params
      );
      this.setCachedResults(cacheKey, fallback);
      return fallback;
    }

    const requestParams = this.buildRequestParams(params);

    try {
      const response = await this.withRetry(() => this.fetchResults(requestParams));
      const jobs = this.transformResults(response, params);

      if (jobs.length === 0) {
        const noResults = this.createFallbackResponse(
          fallbackUrls,
          `No results returned from SERP API for "${params.keywords}" in ${params.location}.`,
          params
        );
        this.setCachedResults(cacheKey, noResults);
        return noResults;
      }

      this.setCachedResults(cacheKey, jobs);
      return jobs;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown SERP API error';
      console.error('❌ SERP API search failed:', message);

      const fallback = this.createFallbackResponse(fallbackUrls, message, params);
      this.setCachedResults(cacheKey, fallback);
      return fallback;
    }
  }

  private async withRetry<T>(operation: () => Promise<T>, maxRetries = this.maxRetries): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          throw error instanceof Error ? error : new Error(String(error));
        }

        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private getCacheKey(params: JobSearchParams): string {
    return `${params.keywords.toLowerCase()}_${params.location.toLowerCase()}_${params.experience_level ?? 'any'}_${
      params.remote ?? 'any'
    }`;
  }

  private getCachedResults(cacheKey: string): JobOpportunity[] | null {
    const cached = this.resultCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.cacheTtl) {
      this.resultCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  private setCachedResults(cacheKey: string, data: JobOpportunity[]): void {
    this.resultCache.set(cacheKey, { data, timestamp: Date.now() });
  }

  private buildRequestParams(params: JobSearchParams): Record<string, unknown> {
    const request: Record<string, unknown> = {
      engine: 'google_jobs',
      q: params.keywords,
      location: params.location,
      hl: 'en',
      gl: 'us'
    };

    if (typeof params.remote === 'boolean') {
      request.remote_job_type = params.remote ? 'REMOTE' : 'ON_SITE';
    }

    const experienceFilter = this.mapExperienceLevel(params.experience_level);
    if (experienceFilter) {
      request.job_experience = experienceFilter;
    }

    return request;
  }

  private mapExperienceLevel(level?: string): string | undefined {
    if (!level) return undefined;

    const normalized = level.toLowerCase();
    switch (normalized) {
      case 'entry':
      case 'entry-level':
      case 'junior':
        return 'entry_level';
      case 'mid':
      case 'mid-level':
      case 'associate':
        return 'mid_senior_level';
      case 'senior':
      case 'lead':
        return 'senior_level';
      case 'intern':
      case 'internship':
        return 'internship';
      default:
        return undefined;
    }
  }

  private async fetchResults(params: Record<string, unknown>): Promise<GoogleJobsResponse> {
    if (!this.client) {
      throw new Error('SERP API client is not configured');
    }

    return await new Promise<GoogleJobsResponse>((resolve, reject) => {
      try {
        this.client!.json(params, (data: GoogleJobsResponse) => {
          if (!data) {
            return reject(new Error('Empty response from SERP API'));
          }

          if (data.error) {
            return reject(new Error(data.error));
          }

          resolve(data);
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private transformResults(response: GoogleJobsResponse, params: JobSearchParams): JobOpportunity[] {
    const jobs = Array.isArray(response.jobs_results) ? response.jobs_results : [];
    return jobs.slice(0, 15).map((job, index) => this.mapJobResult(job, params, index));
  }

  private mapJobResult(job: GoogleJobsResult, params: JobSearchParams, index: number): JobOpportunity {
    const detected = job.detected_extensions ?? {};
    const applyLink = this.resolveApplyLink(job);
    const primaryLink = applyLink ?? job.share_link ?? job.link ?? null;

    return {
      id: job.job_id || `serp_${Date.now()}_${index}`,
      title: job.title ?? 'Unknown Title',
      company: job.company_name ?? job.via ?? 'Unknown Company',
      location: job.location ?? params.location,
      description: job.description ?? '',
      salary: detected.salary ?? job.salary,
      url: primaryLink ?? undefined,
      application_url: primaryLink ?? '',
      source: 'google',
      skills: this.extractSkills(job),
      experience_level: detected.experience_level ?? params.experience_level ?? 'unknown',
      job_type: detected.schedule_type ?? detected.job_type ?? 'full-time',
      remote_type: this.resolveRemoteType(detected, params.remote),
      applied: false,
      status: 'discovered',
      created_at: new Date().toISOString(),
      raw_data: job as unknown as Record<string, unknown>
    };
  }

  private resolveApplyLink(job: GoogleJobsResult): string | undefined {
    if (job.apply_options && job.apply_options.length > 0) {
      const directOption = job.apply_options.find(option => option.link);
      if (directOption?.link) {
        return directOption.link;
      }
    }

    if (job.related_links && job.related_links.length > 0) {
      const firstLink = job.related_links.find(link => !!link.link);
      if (firstLink?.link) {
        return firstLink.link;
      }
    }

    return job.apply_link ?? job.share_link ?? job.link ?? undefined;
  }

  private resolveRemoteType(
    detected: NonNullable<GoogleJobsResult['detected_extensions']>,
    requestedRemote?: boolean
  ): string {
    if (typeof detected.work_from_home === 'boolean') {
      return detected.work_from_home ? 'remote' : 'onsite';
    }

    if (typeof detected.remote === 'boolean') {
      return detected.remote ? 'remote' : 'onsite';
    }

    if (requestedRemote === true) {
      return 'remote';
    }

    if (requestedRemote === false) {
      return 'onsite';
    }

    return 'unknown';
  }

  private extractSkills(job: GoogleJobsResult): string[] {
    if (!Array.isArray(job.extensions)) {
      return [];
    }

    return job.extensions
      .filter((value): value is string => typeof value === 'string')
      .map(value => value.trim())
      .filter(Boolean);
  }

  private createFallbackResponse(
    fallbackUrls: string[],
    errorMessage: string,
    params: JobSearchParams
  ): JobOpportunity[] {
    const urls = fallbackUrls.length > 0 ? fallbackUrls : [this.buildGoogleJobsSearchUrl(params)];

    return urls.map((url, index) => ({
      id: `serp_fallback_${Date.now()}_${index}`,
      title: 'Manual Search Required',
      company: 'Job Board',
      location: params.location,
      description: `SERP API search failed: ${errorMessage}. Please use the fallback link to continue your search.`,
      url,
      application_url: url,
      source: 'manual',
      skills: [],
      experience_level: params.experience_level ?? 'unknown',
      job_type: params.remote ? 'remote' : 'full-time',
      remote_type: params.remote ? 'remote' : 'unknown',
      applied: false,
      status: 'fallback',
      created_at: new Date().toISOString(),
      error: errorMessage,
      fallback_url: url
    }));
  }

  private generateFallbackUrls(params: JobSearchParams): string[] {
    return [
      this.buildIndeedSearchUrl(params),
      this.buildLinkedInSearchUrl(params),
      this.buildGoogleJobsSearchUrl(params)
    ];
  }

  private buildIndeedSearchUrl(params: JobSearchParams): string {
    const baseUrl = 'https://www.indeed.com/jobs';
    const urlParams = new URLSearchParams({
      q: params.keywords,
      l: params.location,
      ...(params.remote && { remote: 'true' })
    });

    return `${baseUrl}?${urlParams.toString()}`;
  }

  private buildGoogleJobsSearchUrl(params: JobSearchParams): string {
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
      ibp: 'htl;jobs'
    });

    return `${baseUrl}?${urlParams.toString()}`;
  }

  private buildLinkedInSearchUrl(params: JobSearchParams): string {
    const baseUrl = 'https://www.linkedin.com/jobs/search';
    const urlParams = new URLSearchParams({
      keywords: params.keywords,
      location: params.location,
      ...(params.remote && { f_WT: '2' }),
      ...(params.experience_level && { f_E: this.experienceLevelToCode(params.experience_level) })
    });

    return `${baseUrl}?${urlParams.toString()}`;
  }

  private experienceLevelToCode(level: string): string {
    const levels: Record<string, string> = {
      entry: '1',
      'entry-level': '1',
      junior: '1',
      mid: '2',
      'mid-level': '2',
      senior: '3',
      lead: '3',
      executive: '4'
    };

    const normalized = level.toLowerCase();
    return levels[normalized] ?? '2';
  }
}

let serpClient: SerpClient | null = null;

export const getSerpClient = (): SerpClient => {
  if (!serpClient) {
    serpClient = new SerpClient();
  }

  return serpClient;
};

export const resetSerpClient = (): void => {
  serpClient = null;
};
