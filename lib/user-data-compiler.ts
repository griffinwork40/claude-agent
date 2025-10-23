// lib/user-data-compiler.ts
/**
 * Compiles user profile data into JSON format for agent context injection.
 * Creates user_fname.json files that can be used in system prompts.
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface UserProfile {
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
      description?: string;
    }>;
  };
  preferences: {
    job_types: string[];
    locations: string[];
    salary_range: { min: number; max: number };
    remote_work: boolean;
  };
  resume_path?: string;
  resume_text?: string;
  onboarding_completed?: boolean;
  created_at?: string;
  updated_at?: string;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not set');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Compiles user profile data into a structured JSON format.
 */
export function compileUserDataToJSON(profile: UserProfile): string {
  const compiledData = {
    user_id: profile.user_id,
    personal_information: {
      full_name: profile.personal_info.name,
      email: profile.personal_info.email,
      phone: profile.personal_info.phone,
      location: profile.personal_info.location
    },
    professional_profile: {
      years_of_experience: profile.experience.years_experience,
      skills: profile.experience.skills,
      employment_history: profile.experience.previous_roles.map(role => ({
        job_title: role.title,
        employer_name: role.company,
        duration: role.duration,
        description: role.description || ''
      }))
    },
    job_search_preferences: {
      desired_job_types: profile.preferences.job_types,
      preferred_locations: profile.preferences.locations,
      salary_expectations: {
        minimum: profile.preferences.salary_range.min,
        maximum: profile.preferences.salary_range.max,
        currency: 'USD'
      },
      remote_work_preference: profile.preferences.remote_work
    },
    metadata: {
      onboarding_completed: profile.onboarding_completed || false,
      profile_created_at: profile.created_at,
      profile_updated_at: profile.updated_at
    }
  };

  return JSON.stringify(compiledData, null, 2);
}

/**
 * Fetches user profile from database and compiles to JSON.
 */
export async function getUserDataJSON(userId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    if (!profile) {
      console.log('No profile found for user:', userId);
      return null;
    }

    return compileUserDataToJSON(profile);
  } catch (error) {
    console.error('Error in getUserDataJSON:', error);
    return null;
  }
}

/**
 * Saves user data as a JSON file in the user-data directory.
 * Filename format: user_{firstName}.json
 */
export async function saveUserDataAsFile(userId: string): Promise<string | null> {
  try {
    const jsonData = await getUserDataJSON(userId);
    if (!jsonData) {
      console.error('Failed to get user data JSON');
      return null;
    }

    const parsedData = JSON.parse(jsonData);
    const firstName = parsedData.personal_information.full_name.split(' ')[0] || 'unknown';
    const filename = `user_${firstName.toLowerCase()}.json`;

    // Create user-data directory if it doesn't exist
    const userDataDir = join(process.cwd(), 'user-data');
    if (!existsSync(userDataDir)) {
      mkdirSync(userDataDir, { recursive: true });
    }

    const filepath = join(userDataDir, filename);
    writeFileSync(filepath, jsonData, 'utf8');

    console.log(`✓ User data saved to: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('Error saving user data file:', error);
    return null;
  }
}

/**
 * Generates context string for injection into agent system prompts.
 * This provides the agent with user-specific information.
 */
export async function getUserContextForPrompt(userId: string): Promise<string> {
  try {
    const jsonData = await getUserDataJSON(userId);
    if (!jsonData) {
      return 'No user profile data available.';
    }

    const data = JSON.parse(jsonData);
    
    return `
USER PROFILE CONTEXT:
======================

Personal Information:
- Name: ${data.personal_information.full_name}
- Email: ${data.personal_information.email}
- Phone: ${data.personal_information.phone}
- Location: ${data.personal_information.location}

Professional Background:
- Years of Experience: ${data.professional_profile.years_of_experience}
- Key Skills: ${data.professional_profile.skills.join(', ')}
- Recent Roles: ${data.professional_profile.employment_history.slice(0, 3).map((role: any) => 
  `${role.job_title} at ${role.employer_name} (${role.duration})`).join('; ')}

Job Search Preferences:
- Desired Roles: ${data.job_search_preferences.desired_job_types.join(', ')}
- Preferred Locations: ${data.job_search_preferences.preferred_locations.join(', ')}
- Salary Range: $${data.job_search_preferences.salary_expectations.minimum.toLocaleString()} - $${data.job_search_preferences.salary_expectations.maximum.toLocaleString()}
- Remote Work: ${data.job_search_preferences.remote_work_preference ? 'Yes' : 'No'}

Use this information to personalize job searches and applications for the user.
======================
`;
  } catch (error) {
    console.error('Error generating user context:', error);
    return 'Error loading user profile data.';
  }
}

/**
 * Checks if user has completed onboarding.
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('user_id', userId)
      .single();

    return profile?.onboarding_completed || false;
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
}
