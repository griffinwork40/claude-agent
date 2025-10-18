// lib/greenhouse-client.ts
// Greenhouse API client for job search and application submission

import { JobOpportunity, GreenhouseJob, GreenhouseApplication, UserProfile } from '@/types';
import { getBoardTokens } from './greenhouse-boards';

export interface GreenhouseSearchFilters {
  keywords?: string;
  location?: string;
  experience_level?: string;
  remote?: boolean;
}

export class GreenhouseClient {
  private apiKey?: string;
  private baseUrl = 'https://boards-api.greenhouse.io/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GREENHOUSE_API_KEY;
  }

  /**
   * Search jobs from a single Greenhouse board
   */
  async searchJobs(boardToken: string, filters: GreenhouseSearchFilters = {}): Promise<JobOpportunity[]> {
    try {
      const url = `${this.baseUrl}/boards/${boardToken}/jobs?content=true`;
      console.log(`🔍 Searching Greenhouse board: ${boardToken}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Enlist-Job-Search/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`⚠️ Board not found: ${boardToken}`);
          return [];
        }
        throw new Error(`Greenhouse API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const jobs = data.jobs || [];
      
      console.log(`✓ Found ${jobs.length} jobs on ${boardToken}`);
      
      return jobs
        .map((job: GreenhouseJob) => this.transformJob(job, boardToken, filters))
        .filter((job: JobOpportunity | null) => job !== null) as JobOpportunity[];
    } catch (error) {
      console.error(`❌ Error searching board ${boardToken}:`, error);
      return [];
    }
  }

  /**
   * Search jobs across multiple Greenhouse boards
   */
  async searchMultipleBoards(boardTokens: string[], filters: GreenhouseSearchFilters = {}): Promise<JobOpportunity[]> {
    console.log(`🔍 Searching ${boardTokens.length} Greenhouse boards`);
    
    const searchPromises = boardTokens.map(boardToken => 
      this.searchJobs(boardToken, filters).catch(error => {
        console.error(`❌ Error searching board ${boardToken}:`, error);
        return [];
      })
    );

    const results = await Promise.all(searchPromises);
    const allJobs = results.flat();
    
    console.log(`✓ Found ${allJobs.length} total jobs across all boards`);
    return allJobs;
  }

  /**
   * Get detailed job information
   */
  async getJobDetails(boardToken: string, jobId: string): Promise<GreenhouseJob | null> {
    try {
      const url = `${this.baseUrl}/boards/${boardToken}/jobs/${jobId}`;
      console.log(`📄 Getting job details: ${boardToken}/${jobId}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Enlist-Job-Search/1.0'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Greenhouse API error: ${response.status} ${response.statusText}`);
      }

      const job = await response.json();
      console.log(`✓ Retrieved job details for ${job.title}`);
      return job;
    } catch (error) {
      console.error(`❌ Error getting job details:`, error);
      return null;
    }
  }

  /**
   * Submit application to a Greenhouse job
   */
  async submitApplication(
    boardToken: string, 
    jobId: string, 
    formData: Record<string, any>
  ): Promise<GreenhouseApplication> {
    if (!this.apiKey) {
      throw new Error('Greenhouse API key required for application submission');
    }

    try {
      const url = `${this.baseUrl}/boards/${boardToken}/jobs/${jobId}`;
      console.log(`📝 Submitting application to: ${boardToken}/${jobId}`);
      
      // Convert form data to multipart/form-data
      const formDataObj = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value instanceof File) {
          formDataObj.append(key, value);
        } else {
          formDataObj.append(key, String(value));
        }
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
          'User-Agent': 'Enlist-Job-Search/1.0'
        },
        body: formDataObj,
        signal: AbortSignal.timeout(30000) // 30s timeout for applications
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Application failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✓ Application submitted successfully`);
      return { success: true, application_id: result.id };
    } catch (error) {
      console.error(`❌ Error submitting application:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Transform Greenhouse job to JobOpportunity format
   */
  private transformJob(job: GreenhouseJob, boardToken: string, filters: GreenhouseSearchFilters): JobOpportunity | null {
    try {
      // Apply keyword filter if specified
      if (filters.keywords) {
        const keywords = filters.keywords.toLowerCase();
        const searchText = `${job.title} ${job.content}`.toLowerCase();
        if (!searchText.includes(keywords)) {
          return null;
        }
      }

      // Apply location filter if specified
      if (filters.location && !filters.remote) {
        const location = job.location.name.toLowerCase();
        const filterLocation = filters.location.toLowerCase();
        if (!location.includes(filterLocation) && !location.includes('remote')) {
          return null;
        }
      }

      // Apply remote filter
      if (filters.remote !== undefined) {
        const isRemote = job.location.name.toLowerCase().includes('remote');
        if (filters.remote && !isRemote) {
          return null;
        }
        if (!filters.remote && isRemote) {
          return null;
        }
      }

      // Extract experience level from title
      const experienceLevel = this.extractExperienceLevel(job.title);
      
      // Determine job type (default to full-time)
      const jobType = this.extractJobType(job);
      
      // Determine remote type
      const remoteType = this.extractRemoteType(job.location.name);

      return {
        id: `greenhouse-${boardToken}-${job.id}`,
        title: job.title,
        company: job.departments[0]?.name || 'Unknown',
        location: job.location.name,
        description: job.content,
        application_url: `https://boards.greenhouse.io/${boardToken}/jobs/${job.id}`,
        source: 'greenhouse',
        skills: this.extractSkills(job.content),
        experience_level: experienceLevel,
        job_type: jobType,
        remote_type: remoteType,
        applied: false,
        status: 'discovered',
        greenhouse_job_id: job.id.toString(),
        greenhouse_board_token: boardToken,
        raw_data: job as unknown as Record<string, unknown>,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error transforming job ${job.id}:`, error);
      return null;
    }
  }

  /**
   * Extract experience level from job title
   */
  private extractExperienceLevel(title: string): string {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('senior') || titleLower.includes('sr') || titleLower.includes('lead') || titleLower.includes('principal')) {
      return 'senior';
    }
    if (titleLower.includes('junior') || titleLower.includes('jr') || titleLower.includes('entry') || titleLower.includes('intern')) {
      return 'entry';
    }
    if (titleLower.includes('director') || titleLower.includes('vp') || titleLower.includes('head of') || titleLower.includes('chief')) {
      return 'executive';
    }
    
    return 'mid'; // default
  }

  /**
   * Extract job type from job data
   */
  private extractJobType(job: GreenhouseJob): string {
    // Greenhouse doesn't typically provide job type in the API response
    // We'll default to full-time and could enhance this with more sophisticated parsing
    return 'full-time';
  }

  /**
   * Extract remote type from location
   */
  private extractRemoteType(location: string): string {
    const locationLower = location.toLowerCase();
    
    if (locationLower.includes('remote')) {
      return 'remote';
    }
    if (locationLower.includes('hybrid')) {
      return 'hybrid';
    }
    
    return 'onsite';
  }

  /**
   * Extract skills from job description
   */
  private extractSkills(description: string): string[] {
    // Simple keyword extraction - could be enhanced with more sophisticated NLP
    const commonSkills = [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++', 'c#',
      'react', 'vue', 'angular', 'node.js', 'express', 'django', 'flask',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform',
      'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
      'git', 'github', 'gitlab', 'ci/cd', 'jenkins', 'github actions',
      'machine learning', 'ai', 'data science', 'analytics',
      'frontend', 'backend', 'full-stack', 'devops', 'sre'
    ];

    const descriptionLower = description.toLowerCase();
    return commonSkills.filter(skill => descriptionLower.includes(skill));
  }

  /**
   * Search jobs using default board tokens
   */
  async searchJobsDefault(filters: GreenhouseSearchFilters = {}): Promise<JobOpportunity[]> {
    const boardTokens = getBoardTokens();
    return this.searchMultipleBoards(boardTokens, filters);
  }
}
