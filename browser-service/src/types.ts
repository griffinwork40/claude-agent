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
  source: 'linkedin' | 'indeed' | 'glassdoor' | 'angellist' | 'company';
  skills: string[];
  experience_level: string;
  job_type: string;
  remote_type: string;
  match_percentage?: number;
  applied: boolean;
  applied_at?: string;
  status: 'discovered' | 'interested' | 'applied' | 'rejected';
  raw_data?: Record<string, unknown>;
  created_at: string;
}

