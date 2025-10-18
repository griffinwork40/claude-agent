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
  source: 'linkedin' | 'indeed' | 'glassdoor' | 'angellist' | 'company' | 'google' | 'manual' | 'remotive' | 'greenhouse';
  skills: string[];
  experience_level: string;
  job_type: string; // full-time, part-time, contract
  remote_type: string; // remote, hybrid, onsite
  match_percentage?: number;
  applied: boolean;
  applied_at?: string;
  status: 'discovered' | 'interested' | 'applied' | 'rejected' | 'error' | 'fallback';
  raw_data?: Record<string, unknown>; // Original scraped data
  greenhouse_job_id?: string; // Greenhouse-specific job ID
  greenhouse_board_token?: string; // Greenhouse board token for applications
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

// Greenhouse API specific types
export interface GreenhouseJob {
  id: number;
  title: string;
  location: {
    name: string;
  };
  departments: Array<{
    id: number;
    name: string;
  }>;
  content: string;
  absolute_url: string;
  created_at: string;
  updated_at: string;
  internal_job_id?: string;
  requisition_id?: string;
  questions?: GreenhouseQuestion[];
}

export interface GreenhouseQuestion {
  id: number;
  label: string;
  required: boolean;
  type: 'text' | 'textarea' | 'select' | 'multi_select' | 'file';
  options?: Array<{
    id: number;
    label: string;
  }>;
}

export interface GreenhouseApplication {
  success: boolean;
  application_id?: string;
  error?: string;
}
