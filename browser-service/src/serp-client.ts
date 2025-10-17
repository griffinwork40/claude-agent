// browser-service/src/serp-client.ts
// SERP API client for Google Jobs, company research, and salary intelligence
import { JobOpportunity } from './types';

// Use require for the untyped module
const { SerpApiSearch } = require('google-search-results-nodejs');

// Additional type definitions for SERP API responses
export interface CompanyResearchResult {
  company_name: string;
  website?: string;
  description?: string;
  industry?: string;
  size?: string;
  founded?: string;
  headquarters?: string;
  recent_news?: Array<{
    title: string;
    snippet: string;
    link: string;
    date?: string;
  }>;
  reviews?: Array<{
    source: string;
    rating?: number;
    review_count?: number;
    url?: string;
  }>;
  social_media?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  financial_info?: {
    revenue?: string;
    employees?: string;
    market_cap?: string;
  };
  created_at: string;
}

export interface SalaryDataResult {
  job_title: string;
  location: string;
  salary_ranges: Array<{
    min: number;
    max: number;
    currency: string;
    source: string;
    job_count: number;
  }>;
  average_salary?: {
    min: number;
    max: number;
    currency: string;
  };
  salary_trends?: Array<{
    year: number;
    average_min: number;
    average_max: number;
    currency: string;
  }>;
  benefits?: string[];
  experience_levels?: Array<{
    level: string;
    min_salary: number;
    max_salary: number;
    currency: string;
  }>;
  companies?: Array<{
    name: string;
    min_salary: number;
    max_salary: number;
    currency: string;
    job_count: number;
  }>;
  created_at: string;
}

export class SerpApiClient {
  private serpApi: any;
  private resultCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor() {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      throw new Error('SERPAPI_API_KEY environment variable is required');
    }
    this.serpApi = new SerpApiSearch(apiKey);
  }

  // Check cache for recent results
  private getCachedResults(cacheKey: string): any | null {
    const cached = this.resultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('📦 Using cached SERP API results');
      return cached.data;
    }
    return null;
  }

  // Store results in cache
  private setCachedResults(cacheKey: string, data: any): void {
    this.resultCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  // Generate cache key from search parameters
  private getCacheKey(params: Record<string, any>): string {
    return `serp_${JSON.stringify(params)}`;
  }

  // Search Google Jobs using SERP API
  async searchGoogleJobs(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    const cacheKey = this.getCacheKey(params);
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    try {
      console.log('🔍 Searching Google Jobs via SERP API:', params);

      // Build search query
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

      const searchParams = {
        q: query,
        engine: 'google_jobs',
        location: params.location,
        hl: 'en',
        gl: 'us',
        num: 20
      };

      const response = await this.serpApi.json(searchParams);
      
      if (!response.jobs_results) {
        console.log('⚠️ No job results found in SERP API response');
        return [];
      }

      const jobs: JobOpportunity[] = response.jobs_results.map((job: any, index: number) => ({
        id: `google_serp_${Date.now()}_${index}`,
        title: job.title || 'Unknown Title',
        company: job.company_name || 'Unknown Company',
        location: job.location || 'Unknown Location',
        description: job.description || '',
        salary: job.salary?.min || job.salary?.max ? 
          `${job.salary.min || ''} - ${job.salary.max || ''} ${job.salary.currency || ''}`.trim() : 
          undefined,
        url: job.apply_options?.[0]?.link || job.related_links?.[0]?.link || '',
        application_url: job.apply_options?.[0]?.link || job.related_links?.[0]?.link || '',
        source: 'google' as const,
        skills: this.extractSkillsFromDescription(job.description || ''),
        experience_level: this.inferExperienceLevel(job.title || '', job.description || ''),
        job_type: this.inferJobType(job.title || '', job.description || ''),
        remote_type: this.inferRemoteType(job.location || '', job.description || ''),
        applied: false,
        status: 'discovered' as const,
        created_at: new Date().toISOString(),
        raw_data: job
      }));

      console.log(`✅ Found ${jobs.length} jobs via SERP API`);
      
      // Cache successful results
      this.setCachedResults(cacheKey, jobs);
      return jobs;

    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ SERP API Google Jobs search failed:', errMessage);
      
      // Return structured error instead of throwing
      return [{
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
    }
  }

  // Research company information using SERP API Google Search
  async researchCompany(companyName: string): Promise<CompanyResearchResult> {
    const cacheKey = this.getCacheKey({ company: companyName });
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    try {
      console.log('🔍 Researching company via SERP API:', companyName);

      // Search for company information
      const companyQuery = `${companyName} company information`;
      const companyParams = {
        q: companyQuery,
        engine: 'google',
        hl: 'en',
        gl: 'us',
        num: 10
      };

      const companyResponse = await this.serpApi.json(companyParams);

      // Search for recent news
      const newsQuery = `${companyName} news 2024 2025`;
      const newsParams = {
        q: newsQuery,
        engine: 'google',
        hl: 'en',
        gl: 'us',
        num: 5,
        tbs: 'qdr:m' // Past month
      };

      const newsResponse = await this.serpApi.json(newsParams);

      // Search for company reviews
      const reviewsQuery = `${companyName} reviews glassdoor indeed`;
      const reviewsParams = {
        q: reviewsQuery,
        engine: 'google',
        hl: 'en',
        gl: 'us',
        num: 5
      };

      const reviewsResponse = await this.serpApi.json(reviewsParams);

      // Extract company information from search results
      const companyInfo = this.extractCompanyInfo(companyResponse, companyName);
      const recentNews = this.extractRecentNews(newsResponse);
      const reviews = this.extractReviews(reviewsResponse, companyName);

      const result: CompanyResearchResult = {
        company_name: companyName,
        website: companyInfo.website,
        description: companyInfo.description,
        industry: companyInfo.industry,
        size: companyInfo.size,
        founded: companyInfo.founded,
        headquarters: companyInfo.headquarters,
        recent_news: recentNews,
        reviews: reviews,
        social_media: companyInfo.social_media,
        financial_info: companyInfo.financial_info,
        created_at: new Date().toISOString()
      };

      console.log(`✅ Company research completed for ${companyName}`);
      
      // Cache successful results
      this.setCachedResults(cacheKey, result);
      return result;

    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ SERP API company research failed:', errMessage);
      
      // Return structured error result
      return {
        company_name: companyName,
        description: `Company research failed: ${errMessage}`,
        created_at: new Date().toISOString()
      };
    }
  }

  // Get salary data using SERP API Google Jobs
  async getSalaryData(params: {
    job_title: string;
    location: string;
    experience_level?: string;
  }): Promise<SalaryDataResult> {
    const cacheKey = this.getCacheKey(params);
    const cachedResults = this.getCachedResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    try {
      console.log('💰 Getting salary data via SERP API:', params);

      // Search for salary information
      const salaryQuery = `${params.job_title} salary ${params.location} 2024 2025`;
      const salaryParams = {
        q: salaryQuery,
        engine: 'google',
        hl: 'en',
        gl: 'us',
        num: 10
      };

      const salaryResponse = await this.serpApi.json(salaryParams);

      // Search for specific job postings to extract salary data
      const jobsQuery = `${params.job_title} jobs ${params.location} salary`;
      const jobsParams = {
        q: jobsQuery,
        engine: 'google_jobs',
        location: params.location,
        hl: 'en',
        gl: 'us',
        num: 20
      };

      const jobsResponse = await this.serpApi.json(jobsParams);

      // Extract salary information
      const salaryRanges = this.extractSalaryRanges(salaryResponse, jobsResponse);
      const averageSalary = this.calculateAverageSalary(salaryRanges);
      const experienceLevels = this.extractExperienceLevels(jobsResponse);
      const companies = this.extractCompanySalaries(jobsResponse);

      const result: SalaryDataResult = {
        job_title: params.job_title,
        location: params.location,
        salary_ranges: salaryRanges,
        average_salary: averageSalary,
        experience_levels: experienceLevels,
        companies: companies,
        created_at: new Date().toISOString()
      };

      console.log(`✅ Salary data retrieved for ${params.job_title} in ${params.location}`);
      
      // Cache successful results
      this.setCachedResults(cacheKey, result);
      return result;

    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ SERP API salary data retrieval failed:', errMessage);
      
      // Return structured error result
      return {
        job_title: params.job_title,
        location: params.location,
        salary_ranges: [],
        created_at: new Date().toISOString()
      };
    }
  }

  // Helper methods for data extraction and processing
  private extractSkillsFromDescription(description: string): string[] {
    const commonSkills = [
      'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'TypeScript', 'AWS', 'Docker',
      'Kubernetes', 'SQL', 'MongoDB', 'PostgreSQL', 'Git', 'Agile', 'Scrum', 'CI/CD',
      'Machine Learning', 'AI', 'Data Science', 'Analytics', 'Leadership', 'Management',
      'Communication', 'Problem Solving', 'Teamwork', 'Project Management'
    ];

    const foundSkills = commonSkills.filter(skill => 
      description.toLowerCase().includes(skill.toLowerCase())
    );

    return foundSkills.slice(0, 10); // Limit to 10 skills
  }

  private inferExperienceLevel(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    
    if (text.includes('senior') || text.includes('lead') || text.includes('principal') || 
        text.includes('staff') || text.includes('architect')) {
      return 'senior';
    }
    if (text.includes('junior') || text.includes('entry') || text.includes('graduate') || 
        text.includes('intern')) {
      return 'entry';
    }
    if (text.includes('manager') || text.includes('director') || text.includes('vp') || 
        text.includes('executive')) {
      return 'executive';
    }
    return 'mid';
  }

  private inferJobType(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    
    if (text.includes('part-time') || text.includes('part time')) {
      return 'part-time';
    }
    if (text.includes('contract') || text.includes('freelance')) {
      return 'contract';
    }
    return 'full-time';
  }

  private inferRemoteType(location: string, description: string): string {
    const text = `${location} ${description}`.toLowerCase();
    
    if (text.includes('remote') || text.includes('work from home')) {
      return 'remote';
    }
    if (text.includes('hybrid') || text.includes('flexible')) {
      return 'hybrid';
    }
    return 'onsite';
  }

  private extractCompanyInfo(response: any, companyName: string): any {
    const info: any = {};
    
    if (response.organic_results) {
      for (const result of response.organic_results) {
        const snippet = result.snippet || '';
        const title = result.title || '';
        
        // Extract website
        if (result.link && !info.website) {
          info.website = result.link;
        }
        
        // Extract description
        if (snippet && !info.description) {
          info.description = snippet;
        }
        
        // Extract industry, size, founded, headquarters from snippets
        if (snippet.includes('industry') || snippet.includes('sector')) {
          const industryMatch = snippet.match(/(?:industry|sector)[:\s]+([^.]+)/i);
          if (industryMatch) {
            info.industry = industryMatch[1].trim();
          }
        }
        
        if (snippet.includes('employees') || snippet.includes('staff')) {
          const sizeMatch = snippet.match(/(\d+[,\d]*)\s*(?:employees|staff)/i);
          if (sizeMatch) {
            info.size = sizeMatch[1];
          }
        }
        
        if (snippet.includes('founded') || snippet.includes('established')) {
          const foundedMatch = snippet.match(/(?:founded|established)[:\s]+(\d{4})/i);
          if (foundedMatch) {
            info.founded = foundedMatch[1];
          }
        }
        
        if (snippet.includes('headquarters') || snippet.includes('based in')) {
          const hqMatch = snippet.match(/(?:headquarters|based in)[:\s]+([^.]+)/i);
          if (hqMatch) {
            info.headquarters = hqMatch[1].trim();
          }
        }
      }
    }
    
    return info;
  }

  private extractRecentNews(response: any): Array<{ title: string; snippet: string; link: string; date?: string }> {
    const news: Array<{ title: string; snippet: string; link: string; date?: string }> = [];
    
    if (response.organic_results) {
      for (const result of response.organic_results) {
        if (result.title && result.link) {
          news.push({
            title: result.title,
            snippet: result.snippet || '',
            link: result.link,
            date: result.date
          });
        }
      }
    }
    
    return news.slice(0, 5);
  }

  private extractReviews(response: any, companyName: string): Array<{ source: string; rating?: number; review_count?: number; url?: string }> {
    const reviews: Array<{ source: string; rating?: number; review_count?: number; url?: string }> = [];
    
    if (response.organic_results) {
      for (const result of response.organic_results) {
        const title = result.title || '';
        const snippet = result.snippet || '';
        
        if (title.toLowerCase().includes('glassdoor') || 
            title.toLowerCase().includes('indeed') ||
            title.toLowerCase().includes('reviews')) {
          
          // Extract rating from snippet
          const ratingMatch = snippet.match(/(\d+\.?\d*)\s*(?:stars?|out of 5)/i);
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;
          
          // Extract review count
          const countMatch = snippet.match(/(\d+[,\d]*)\s*(?:reviews?|ratings?)/i);
          const reviewCount = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : undefined;
          
          reviews.push({
            source: title,
            rating,
            review_count: reviewCount,
            url: result.link
          });
        }
      }
    }
    
    return reviews.slice(0, 3);
  }

  private extractSalaryRanges(salaryResponse: any, jobsResponse: any): Array<{ min: number; max: number; currency: string; source: string; job_count: number }> {
    const ranges: Array<{ min: number; max: number; currency: string; source: string; job_count: number }> = [];
    
    // Extract from salary search results
    if (salaryResponse.organic_results) {
      for (const result of salaryResponse.organic_results) {
        const snippet = result.snippet || '';
        const salaryMatch = snippet.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*[-–]\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
        if (salaryMatch) {
          const min = parseFloat(salaryMatch[1].replace(/,/g, ''));
          const max = parseFloat(salaryMatch[2].replace(/,/g, ''));
          ranges.push({
            min,
            max,
            currency: 'USD',
            source: result.title || 'Salary Data',
            job_count: 1
          });
        }
      }
    }
    
    // Extract from job postings
    if (jobsResponse.jobs_results) {
      for (const job of jobsResponse.jobs_results) {
        if (job.salary && job.salary.min && job.salary.max) {
          ranges.push({
            min: job.salary.min,
            max: job.salary.max,
            currency: job.salary.currency || 'USD',
            source: job.company_name || 'Job Posting',
            job_count: 1
          });
        }
      }
    }
    
    return ranges;
  }

  private calculateAverageSalary(ranges: Array<{ min: number; max: number; currency: string }>): { min: number; max: number; currency: string } | undefined {
    if (ranges.length === 0) return undefined;
    
    const totalMin = ranges.reduce((sum, range) => sum + range.min, 0);
    const totalMax = ranges.reduce((sum, range) => sum + range.max, 0);
    const count = ranges.length;
    
    return {
      min: Math.round(totalMin / count),
      max: Math.round(totalMax / count),
      currency: ranges[0].currency
    };
  }

  private extractExperienceLevels(jobsResponse: any): Array<{ level: string; min_salary: number; max_salary: number; currency: string }> {
    const levels: Array<{ level: string; min_salary: number; max_salary: number; currency: string }> = [];
    
    if (jobsResponse.jobs_results) {
      const levelGroups: { [key: string]: Array<{ min: number; max: number; currency: string }> } = {};
      
      for (const job of jobsResponse.jobs_results) {
        if (job.salary && job.salary.min && job.salary.max) {
          const level = this.inferExperienceLevel(job.title || '', job.description || '');
          if (!levelGroups[level]) {
            levelGroups[level] = [];
          }
          levelGroups[level].push({
            min: job.salary.min,
            max: job.salary.max,
            currency: job.salary.currency || 'USD'
          });
        }
      }
      
      for (const [level, salaries] of Object.entries(levelGroups)) {
        if (salaries.length > 0) {
          const avgMin = salaries.reduce((sum, s) => sum + s.min, 0) / salaries.length;
          const avgMax = salaries.reduce((sum, s) => sum + s.max, 0) / salaries.length;
          
          levels.push({
            level,
            min_salary: Math.round(avgMin),
            max_salary: Math.round(avgMax),
            currency: salaries[0].currency
          });
        }
      }
    }
    
    return levels;
  }

  private extractCompanySalaries(jobsResponse: any): Array<{ name: string; min_salary: number; max_salary: number; currency: string; job_count: number }> {
    const companies: Array<{ name: string; min_salary: number; max_salary: number; currency: string; job_count: number }> = [];
    
    if (jobsResponse.jobs_results) {
      const companyGroups: { [key: string]: Array<{ min: number; max: number; currency: string }> } = {};
      
      for (const job of jobsResponse.jobs_results) {
        if (job.salary && job.salary.min && job.salary.max && job.company_name) {
          const company = job.company_name;
          if (!companyGroups[company]) {
            companyGroups[company] = [];
          }
          companyGroups[company].push({
            min: job.salary.min,
            max: job.salary.max,
            currency: job.salary.currency || 'USD'
          });
        }
      }
      
      for (const [company, salaries] of Object.entries(companyGroups)) {
        if (salaries.length > 0) {
          const avgMin = salaries.reduce((sum, s) => sum + s.min, 0) / salaries.length;
          const avgMax = salaries.reduce((sum, s) => sum + s.max, 0) / salaries.length;
          
          companies.push({
            name: company,
            min_salary: Math.round(avgMin),
            max_salary: Math.round(avgMax),
            currency: salaries[0].currency,
            job_count: salaries.length
          });
        }
      }
    }
    
    return companies.slice(0, 10); // Limit to top 10 companies
  }
}

// Singleton instance
let serpApiClient: SerpApiClient | null = null;

export const getSerpApiClient = (): SerpApiClient => {
  if (!serpApiClient) {
    serpApiClient = new SerpApiClient();
  }
  return serpApiClient;
};
