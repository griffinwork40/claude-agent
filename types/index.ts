// types/index.ts
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  created_at: string;
  job_opportunity?: JobOpportunity;
}

export interface JobOpportunity {
  id: string;
  user_id?: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  application_url: string;
  source: 'linkedin' | 'indeed' | 'glassdoor' | 'angellist' | 'company' | 'google';
  skills: string[];
  experience_level: string;
  job_type: string; // full-time, part-time, contract
  remote_type: string; // remote, hybrid, onsite
  match_percentage?: number;
  applied: boolean;
  applied_at?: string;
  status: 'discovered' | 'interested' | 'applied' | 'rejected' | 'error';
  raw_data?: Record<string, unknown>; // Original scraped data
  created_at: string;
  error?: string; // Error message for error status jobs
}

export interface UserProfile {
  id?: string;
  user_id: string;
  personal_info: {
    name: string;
    email: string;
    phone: string;
    location: string;
  };
  experience: {
    skills: string[];
    years_experience: number;
    previous_roles: Array<{
      title: string;
      company: string;
      duration: string;
    }>;
  };
  preferences: {
    job_types: string[];
    locations: string[];
    salary_range: { min: number; max: number };
    remote_work: boolean;
  };
  resume_path: string;
  created_at?: string;
  updated_at?: string;
}

// Tool calling interfaces
export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// Browser tool execution result
export interface BrowserToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

// Company research result
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

// Salary data result
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