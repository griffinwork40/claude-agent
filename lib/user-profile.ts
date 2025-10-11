// lib/user-profile.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

interface GriffinEmploymentHistoryEntry {
  job_title?: string;
  employer_name?: string;
  start_date?: string;
  end_date?: string;
}

interface GriffinProfile {
  personal_information?: {
    full_name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  skills_and_qualifications?: {
    technical_skills?: string[];
    business_and_product_skills?: string[];
  };
  employment_history?: GriffinEmploymentHistoryEntry[];
  resume_location?: string;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not set');
  }
  
  return createClient(supabaseUrl, supabaseKey);
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

// Get user profile from database
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
}

// Import profile from griffin.json file
export async function importProfileFromFile(userId: string, filePath?: string): Promise<UserProfile | null> {
  try {
    // Default to the griffin.json file if no path provided
    const profilePath = filePath || '/Users/griffinlong/Projects/personal_projects/resume/griffin.json';
    
    const profileData = JSON.parse(readFileSync(profilePath, 'utf8')) as GriffinProfile;
    
    // Transform griffin.json structure to our UserProfile interface
    const userProfile: UserProfile = {
      user_id: userId,
      personal_info: {
        name: profileData.personal_information?.full_name || '',
        email: profileData.personal_information?.email || '',
        phone: profileData.personal_information?.phone || '',
        location: profileData.personal_information?.address || ''
      },
      experience: {
        skills: [
          ...(profileData.skills_and_qualifications?.technical_skills || []),
          ...(profileData.skills_and_qualifications?.business_and_product_skills || [])
        ],
        years_experience: calculateYearsExperience(profileData.employment_history ?? []),
        previous_roles: (profileData.employment_history ?? []).map((job) => ({
          title: job.job_title ?? '',
          company: job.employer_name ?? '',
          duration: formatEmploymentDuration(job.start_date, job.end_date)
        }))
      },
      preferences: {
        job_types: ['full-time'], // Default, can be updated
        locations: [profileData.personal_information?.address || ''],
        salary_range: { min: 80000, max: 150000 }, // Default, can be updated
        remote_work: true // Default to remote-friendly
      },
      resume_path: profileData.resume_location || ''
    };

    // Save to database
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert([userProfile], { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving user profile:', error);
      return null;
    }

    console.log('User profile imported and saved successfully');
    return data;
  } catch (error) {
    console.error('Error importing profile from file:', error);
    return null;
  }
}

// Update user profile
export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return null;
  }
}

// Get resume file path for user
export async function getResumeForUser(userId: string): Promise<string | null> {
  try {
    const profile = await getUserProfile(userId);
    return profile?.resume_path || null;
  } catch (error) {
    console.error('Error getting resume path:', error);
    return null;
  }
}

// Create or get user profile (with fallback to griffin.json)
export async function getOrCreateUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    // Try to get existing profile
    let profile = await getUserProfile(userId);
    
    if (!profile) {
      console.log('No existing profile found, importing from griffin.json...');
      // Import from griffin.json as fallback
      profile = await importProfileFromFile(userId);
    }
    
    return profile;
  } catch (error) {
    console.error('Error in getOrCreateUserProfile:', error);
    return null;
  }
}

// Calculate years of experience from employment history
function calculateYearsExperience(employmentHistory: GriffinEmploymentHistoryEntry[]): number {
  if (!employmentHistory || employmentHistory.length === 0) return 0;

  let totalMonths = 0;

  for (const job of employmentHistory) {
    const { start_date: startDate, end_date: endDate } = job;
    if (!startDate) {
      continue;
    }

    const start = new Date(startDate);
    const normalizedEndDate = endDate?.trim();
    const end = !normalizedEndDate || normalizedEndDate.toLowerCase() === 'present'
      ? new Date()
      : new Date(normalizedEndDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }

    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    totalMonths += Math.max(months, 0);
  }

  return Math.round(totalMonths / 12);
}

function formatEmploymentDuration(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) {
    return '';
  }

  if (!startDate) {
    return endDate ?? 'Present';
  }

  const formattedEnd = endDate ?? 'Present';
  return `${startDate} - ${formattedEnd}`;
}

// Validate user profile completeness
export function validateUserProfile(profile: UserProfile): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  
  if (!profile.personal_info.name) missingFields.push('name');
  if (!profile.personal_info.email) missingFields.push('email');
  if (!profile.personal_info.phone) missingFields.push('phone');
  if (!profile.personal_info.location) missingFields.push('location');
  if (!profile.resume_path) missingFields.push('resume_path');
  if (profile.experience.skills.length === 0) missingFields.push('skills');
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

// Generate cover letter based on job and user profile
export function generateCoverLetter(jobTitle: string, company: string, userProfile: UserProfile): string {
  const { personal_info, experience } = userProfile;
  
  return `Dear Hiring Manager,

I am writing to express my strong interest in the ${jobTitle} position at ${company}. With my background in ${experience.skills.slice(0, 3).join(', ')}, I am confident that I would be a valuable addition to your team.

In my ${experience.years_experience} years of experience, I have developed expertise in ${experience.skills.slice(0, 5).join(', ')}. This experience, combined with my passion for ${experience.skills[0] || 'technology'}, has prepared me well for this opportunity.

I am particularly drawn to this position because of the opportunity to contribute to ${company}'s mission and grow professionally within your organization. I am excited about the possibility of bringing my skills and experience to your team.

Thank you for considering my application. I look forward to discussing how my background aligns with your needs.

Sincerely,
${personal_info.name}`;
}
