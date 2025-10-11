// lib/browser-tools.ts
// HTTP client wrapper for browser automation service
import { JobOpportunity } from '@/types';

// Browser automation service - HTTP client implementation
export class BrowserJobService {
  private serviceUrl = process.env.BROWSER_SERVICE_URL || 'http://localhost:3001';
  private apiKey = process.env.BROWSER_SERVICE_API_KEY || 'test-key-12345';

  async initialize() {
    // No-op for HTTP client, but kept for API compatibility
  }

  async close() {
    // No-op for HTTP client
  }

  // Search jobs on Indeed (no authentication required)
  async searchJobsIndeed(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
  }): Promise<JobOpportunity[]> {
    const response = await fetch(`${this.serviceUrl}/api/search-indeed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Indeed search failed: ${error.error || response.statusText}`);
    }
    
    const result = await response.json();
    return result.data;
  }

  // Search jobs on LinkedIn (requires authentication)
  async searchJobsLinkedIn(params: {
    keywords: string;
    location: string;
    experience_level?: string;
    remote?: boolean;
    userId: string;
  }): Promise<JobOpportunity[]> {
    const response = await fetch(`${this.serviceUrl}/api/search-linkedin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`LinkedIn search failed: ${error.error || response.statusText}`);
    }
    
    const result = await response.json();
    return result.data;
  }

  // Get detailed information about a specific job
  async getJobDetails(jobUrl: string): Promise<Partial<JobOpportunity>> {
    const response = await fetch(`${this.serviceUrl}/api/job-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ job_url: jobUrl })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Get job details failed: ${error.error || response.statusText}`);
    }
    
    const result = await response.json();
    return result.data;
  }

  // Apply to a job using user profile data
  async applyToJob(jobUrl: string, userProfile: Record<string, unknown>): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    const response = await fetch(`${this.serviceUrl}/api/apply-to-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ job_url: jobUrl, user_profile: userProfile })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Apply to job failed: ${error.error || response.statusText}`);
    }
    
    const result = await response.json();
    return result.data;
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

// Tool definitions for Claude
export const browserTools = [
  {
    name: 'search_jobs_indeed',
    description: 'Search for jobs on Indeed.com with specific criteria. Indeed does not require authentication.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keywords: { 
          type: 'string', 
          description: 'Job title or keywords to search for' 
        },
        location: { 
          type: 'string', 
          description: 'Job location (city, state, or "remote")' 
        },
        experience_level: { 
          type: 'string', 
          enum: ['entry', 'mid', 'senior', 'executive'],
          description: 'Experience level filter'
        },
        remote: { 
          type: 'boolean', 
          description: 'Filter for remote work opportunities' 
        }
      },
      required: ['keywords', 'location']
    }
  },
  {
    name: 'search_jobs_linkedin',
    description: 'Search for jobs on LinkedIn with specific criteria. Requires LinkedIn authentication.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keywords: { 
          type: 'string', 
          description: 'Job title or keywords to search for' 
        },
        location: { 
          type: 'string', 
          description: 'Job location (city, state, or "remote")' 
        },
        experience_level: { 
          type: 'string', 
          enum: ['entry', 'mid', 'senior', 'executive'],
          description: 'Experience level filter'
        },
        remote: { 
          type: 'boolean', 
          description: 'Filter for remote work opportunities' 
        },
        userId: {
          type: 'string',
          description: 'User ID for session management'
        }
      },
      required: ['keywords', 'location', 'userId']
    }
  },
  {
    name: 'get_job_details',
    description: 'Get detailed information about a specific job posting',
    input_schema: {
      type: 'object' as const,
      properties: {
        job_url: { 
          type: 'string', 
          description: 'URL of the job posting to get details for' 
        }
      },
      required: ['job_url']
    }
  },
  {
    name: 'apply_to_job',
    description: 'Apply to a job using the user\'s profile data. Only use after getting explicit user confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        job_url: { 
          type: 'string', 
          description: 'URL of the job to apply to' 
        },
        user_profile: { 
          type: 'object', 
          description: 'User profile data for the application' 
        }
      },
      required: ['job_url', 'user_profile']
    }
  }
];
