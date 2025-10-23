// lib/user-data-compiler.test.ts
/**
 * Tests for user data compilation utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  compileUserDataToJSON, 
  getUserDataJSON, 
  saveUserDataAsFile, 
  getUserContextForPrompt, 
  hasCompletedOnboarding 
} from './user-data-compiler';

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn()
      }))
    }))
  }))
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

// Mock fs
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn()
}));

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/'))
}));

describe('User Data Compiler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('should compile user profile to JSON format', () => {
    const testProfile = {
      user_id: 'test-user-123',
      personal_info: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1-234-567-8900',
        location: 'San Francisco, CA'
      },
      experience: {
        skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
        years_experience: 5,
        previous_roles: [
          {
            title: 'Senior Software Engineer',
            company: 'Tech Corp',
            duration: '2020-2025',
            description: 'Led frontend development'
          },
          {
            title: 'Software Engineer',
            company: 'Startup Inc',
            duration: '2018-2020',
            description: 'Full-stack development'
          }
        ]
      },
      preferences: {
        job_types: ['full-time', 'contract'],
        locations: ['San Francisco', 'Remote'],
        salary_range: { min: 120000, max: 180000 },
        remote_work: true
      },
      resume_path: 'resume.pdf',
      onboarding_completed: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-15T00:00:00Z'
    };

    const jsonOutput = compileUserDataToJSON(testProfile);
    const parsed = JSON.parse(jsonOutput);

    // Verify structure
    expect(parsed).toHaveProperty('user_id', 'test-user-123');
    expect(parsed).toHaveProperty('personal_information');
    expect(parsed).toHaveProperty('professional_profile');
    expect(parsed).toHaveProperty('job_search_preferences');
    expect(parsed).toHaveProperty('metadata');

    // Verify personal information
    expect(parsed.personal_information.full_name).toBe('John Doe');
    expect(parsed.personal_information.email).toBe('john@example.com');
    expect(parsed.personal_information.phone).toBe('+1-234-567-8900');
    expect(parsed.personal_information.location).toBe('San Francisco, CA');

    // Verify professional profile
    expect(parsed.professional_profile.years_of_experience).toBe(5);
    expect(parsed.professional_profile.skills).toEqual(['JavaScript', 'TypeScript', 'React', 'Node.js']);
    expect(parsed.professional_profile.employment_history).toHaveLength(2);
    expect(parsed.professional_profile.employment_history[0].job_title).toBe('Senior Software Engineer');

    // Verify preferences
    expect(parsed.job_search_preferences.desired_job_types).toEqual(['full-time', 'contract']);
    expect(parsed.job_search_preferences.preferred_locations).toEqual(['San Francisco', 'Remote']);
    expect(parsed.job_search_preferences.salary_expectations.minimum).toBe(120000);
    expect(parsed.job_search_preferences.salary_expectations.maximum).toBe(180000);
    expect(parsed.job_search_preferences.remote_work_preference).toBe(true);

    // Verify metadata
    expect(parsed.metadata.onboarding_completed).toBe(true);
    expect(parsed.metadata.profile_created_at).toBe('2025-01-01T00:00:00Z');
  });

  it('should handle profiles with minimal data', () => {
    const minimalProfile = {
      user_id: 'test-user-456',
      personal_info: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '',
        location: ''
      },
      experience: {
        skills: [],
        years_experience: 0,
        previous_roles: []
      },
      preferences: {
        job_types: [],
        locations: [],
        salary_range: { min: 0, max: 0 },
        remote_work: false
      },
      resume_path: ''
    };

    const jsonOutput = compileUserDataToJSON(minimalProfile);
    const parsed = JSON.parse(jsonOutput);

    expect(parsed.user_id).toBe('test-user-456');
    expect(parsed.personal_information.full_name).toBe('Jane Smith');
    expect(parsed.professional_profile.skills).toEqual([]);
    expect(parsed.professional_profile.years_of_experience).toBe(0);
  });

  it('should produce valid JSON output', () => {
    const testProfile = {
      user_id: 'test-user-789',
      personal_info: {
        name: 'Test User',
        email: 'test@test.com',
        phone: '123',
        location: 'Test City'
      },
      experience: {
        skills: ['Skill1'],
        years_experience: 1,
        previous_roles: []
      },
      preferences: {
        job_types: ['full-time'],
        locations: ['Remote'],
        salary_range: { min: 50000, max: 100000 },
        remote_work: true
      },
      resume_path: 'test.pdf'
    };

    const jsonOutput = compileUserDataToJSON(testProfile);
    
    // Should not throw when parsing
    expect(() => JSON.parse(jsonOutput)).not.toThrow();
    
    // Should be properly formatted
    expect(jsonOutput).toContain('"user_id"');
    expect(jsonOutput).toContain('"personal_information"');
    expect(jsonOutput).toContain('"professional_profile"');
  });

  describe('getUserDataJSON', () => {
    it('should fetch and compile user data from database', async () => {
      const mockProfile = {
        user_id: 'test-user-123',
        personal_info: {
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '555-123-4567',
          location: 'New York, NY'
        },
        experience: {
          skills: ['Python', 'Django', 'PostgreSQL'],
          years_experience: 3,
          previous_roles: [
            {
              title: 'Backend Developer',
              company: 'Tech Startup',
              duration: '2022-2025',
              description: 'Developed REST APIs'
            }
          ]
        },
        preferences: {
          job_types: ['full-time'],
          locations: ['New York', 'Remote'],
          salary_range: { min: 80000, max: 120000 },
          remote_work: true
        },
        resume_path: 'jane_resume.pdf',
        onboarding_completed: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z'
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      const result = await getUserDataJSON('test-user-123');
      
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.user_id).toBe('test-user-123');
      expect(parsed.personal_information.full_name).toBe('Jane Smith');
      expect(parsed.professional_profile.skills).toEqual(['Python', 'Django', 'PostgreSQL']);
    });

    it('should return null when user not found', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      const result = await getUserDataJSON('nonexistent-user');
      
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await getUserDataJSON('test-user-123');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user profile:', expect.any(Object));
      
      consoleSpy.mockRestore();
    });
  });

  describe('saveUserDataAsFile', () => {
    it('should save user data to file', async () => {
      const mockProfile = {
        user_id: 'test-user-123',
        personal_info: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '555-123-4567',
          location: 'San Francisco, CA'
        },
        experience: {
          skills: ['JavaScript', 'React'],
          years_experience: 5,
          previous_roles: []
        },
        preferences: {
          job_types: ['full-time'],
          locations: ['San Francisco'],
          salary_range: { min: 100000, max: 150000 },
          remote_work: false
        },
        resume_path: 'john_resume.pdf'
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      const { writeFileSync, mkdirSync, existsSync } = require('fs');
      const { join } = require('path');
      
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(join).mockReturnValue('/project/user-data/user_john.json');

      const result = await saveUserDataAsFile('test-user-123');
      
      expect(result).toBe('/project/user-data/user_john.json');
      expect(mkdirSync).toHaveBeenCalledWith('/project/user-data', { recursive: true });
      expect(writeFileSync).toHaveBeenCalledWith(
        '/project/user-data/user_john.json',
        expect.stringContaining('"user_id": "test-user-123"'),
        'utf8'
      );
    });

    it('should handle missing user data', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: null
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await saveUserDataAsFile('nonexistent-user');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get user data JSON');
      
      consoleSpy.mockRestore();
    });

    it('should handle file system errors', async () => {
      const mockProfile = {
        user_id: 'test-user-123',
        personal_info: { name: 'John Doe', email: 'john@example.com', phone: '', location: '' },
        experience: { skills: [], years_experience: 0, previous_roles: [] },
        preferences: { job_types: [], locations: [], salary_range: { min: 0, max: 0 }, remote_work: false },
        resume_path: ''
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      const { writeFileSync } = require('fs');
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await saveUserDataAsFile('test-user-123');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error saving user data file:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getUserContextForPrompt', () => {
    it('should generate context string for agent prompts', async () => {
      const mockProfile = {
        user_id: 'test-user-123',
        personal_info: {
          name: 'Alice Johnson',
          email: 'alice@example.com',
          phone: '555-987-6543',
          location: 'Seattle, WA'
        },
        experience: {
          skills: ['TypeScript', 'Vue.js', 'AWS'],
          years_experience: 4,
          previous_roles: [
            {
              title: 'Frontend Developer',
              company: 'Cloud Corp',
              duration: '2021-2025',
              description: 'Built responsive web applications'
            },
            {
              title: 'Junior Developer',
              company: 'StartupXYZ',
              duration: '2020-2021',
              description: 'Learned modern web technologies'
            }
          ]
        },
        preferences: {
          job_types: ['full-time', 'contract'],
          locations: ['Seattle', 'Remote'],
          salary_range: { min: 90000, max: 130000 },
          remote_work: true
        },
        resume_path: 'alice_resume.pdf'
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      const result = await getUserContextForPrompt('test-user-123');
      
      expect(result).toContain('USER PROFILE CONTEXT');
      expect(result).toContain('Name: Alice Johnson');
      expect(result).toContain('Email: alice@example.com');
      expect(result).toContain('Years of Experience: 4');
      expect(result).toContain('Key Skills: TypeScript, Vue.js, AWS');
      expect(result).toContain('Frontend Developer at Cloud Corp');
      expect(result).toContain('Desired Roles: full-time, contract');
      expect(result).toContain('Salary Range: $90,000 - $130,000');
    });

    it('should handle missing user profile', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await getUserContextForPrompt('nonexistent-user');
      
      expect(result).toBe('No user profile data available.');
    });

    it('should handle errors gracefully', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await getUserContextForPrompt('test-user-123');
      
      expect(result).toBe('Error loading user profile data.');
      expect(consoleSpy).toHaveBeenCalledWith('Error generating user context:', expect.any(Object));
      
      consoleSpy.mockRestore();
    });
  });

  describe('hasCompletedOnboarding', () => {
    it('should return true when onboarding is completed', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { onboarding_completed: true },
        error: null
      });

      const result = await hasCompletedOnboarding('test-user-123');
      
      expect(result).toBe(true);
    });

    it('should return false when onboarding is not completed', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { onboarding_completed: false },
        error: null
      });

      const result = await hasCompletedOnboarding('test-user-123');
      
      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await hasCompletedOnboarding('nonexistent-user');
      
      expect(result).toBe(false);
    });

    it('should return false on database errors', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await hasCompletedOnboarding('test-user-123');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error checking onboarding status:', expect.any(Object));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Environment Variables', () => {
    it('should throw error when Supabase URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      expect(() => {
        const { getSupabaseAdmin } = require('./user-data-compiler');
        getSupabaseAdmin();
      }).toThrow('Supabase environment variables are not set');
    });

    it('should throw error when service role key is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      expect(() => {
        const { getSupabaseAdmin } = require('./user-data-compiler');
        getSupabaseAdmin();
      }).toThrow('Supabase environment variables are not set');
    });
  });
});
