// browser-service/src/types.ts
// Shared types for browser service
export interface JobOpportunity {
  id: string;
  user_id?: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  url?: string;
  application_url: string;
  source:
    | 'linkedin'
    | 'indeed'
    | 'glassdoor'
    | 'angellist'
    | 'company'
    | 'google'
    | 'manual'
    | 'remotive'
    | 'greenhouse';
  skills: string[];
  experience_level: string;
  job_type: string;
  remote_type: string;
  match_percentage?: number;
  applied: boolean;
  applied_at?: string;
  status: 'discovered' | 'interested' | 'applied' | 'rejected' | 'error' | 'fallback';
  error?: string;
  fallback_url?: string;
  raw_data?: Record<string, unknown>;
  greenhouse_job_id?: string;
  greenhouse_board_token?: string;
  created_at: string;
}

export interface JobSearchParams {
  keywords: string;
  location: string;
  experience_level?: string;
  remote?: boolean;
}

