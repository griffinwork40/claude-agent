// lib/user-data-compiler.test.ts
/**
 * Tests for user data compilation utilities
 */

import { describe, it, expect } from 'vitest';
import { compileUserDataToJSON } from './user-data-compiler';

describe('User Data Compiler', () => {
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
});
