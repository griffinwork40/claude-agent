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
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  application_url?: string;
  skills?: string[];
  match_percentage?: number;
}