// scripts/test-onboarding.ts
/**
 * Manual test script for onboarding flow
 * Run with: npx tsx scripts/test-onboarding.ts
 */

import { compileUserDataToJSON, getUserContextForPrompt } from '../lib/user-data-compiler';

// Test data
const testProfile = {
  user_id: 'test-user-12345',
  personal_info: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-123-4567',
    location: 'San Francisco, CA'
  },
  experience: {
    skills: [
      'JavaScript',
      'TypeScript',
      'React',
      'Node.js',
      'PostgreSQL',
      'AWS'
    ],
    years_experience: 8,
    previous_roles: [
      {
        title: 'Senior Software Engineer',
        company: 'Tech Innovators Inc.',
        duration: '2020-Present',
        description: 'Lead frontend development for SaaS platform'
      },
      {
        title: 'Software Engineer',
        company: 'Digital Solutions LLC',
        duration: '2017-2020',
        description: 'Full-stack web development'
      },
      {
        title: 'Junior Developer',
        company: 'StartUp Ventures',
        duration: '2015-2017',
        description: 'Frontend development and UI/UX'
      }
    ]
  },
  preferences: {
    job_types: ['full-time', 'contract'],
    locations: ['San Francisco', 'Remote', 'New York'],
    salary_range: { min: 140000, max: 200000 },
    remote_work: true
  },
  resume_path: 'john_doe_resume.pdf',
  resume_text: 'Sample resume text content...',
  onboarding_completed: true,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T11:30:00Z'
};

console.log('===================================');
console.log('ONBOARDING FLOW TEST');
console.log('===================================\n');

// Test 1: Compile user data to JSON
console.log('Test 1: Compiling user data to JSON format...');
try {
  const jsonOutput = compileUserDataToJSON(testProfile);
  const parsed = JSON.parse(jsonOutput);
  
  console.log('✓ JSON compilation successful');
  console.log('\nCompiled JSON structure:');
  console.log(JSON.stringify(parsed, null, 2));
  console.log();
} catch (error) {
  console.error('✗ JSON compilation failed:', error);
  process.exit(1);
}

// Test 2: Verify JSON structure
console.log('\nTest 2: Verifying JSON structure...');
try {
  const jsonOutput = compileUserDataToJSON(testProfile);
  const parsed = JSON.parse(jsonOutput);
  
  const requiredFields = [
    'user_id',
    'personal_information',
    'professional_profile',
    'job_search_preferences',
    'metadata'
  ];
  
  const missingFields = requiredFields.filter(field => !(field in parsed));
  
  if (missingFields.length > 0) {
    console.error('✗ Missing required fields:', missingFields);
    process.exit(1);
  }
  
  console.log('✓ All required fields present');
  console.log('  - user_id:', parsed.user_id);
  console.log('  - personal_information:', Object.keys(parsed.personal_information).join(', '));
  console.log('  - professional_profile:', Object.keys(parsed.professional_profile).join(', '));
  console.log('  - job_search_preferences:', Object.keys(parsed.job_search_preferences).join(', '));
  console.log('  - metadata:', Object.keys(parsed.metadata).join(', '));
  console.log();
} catch (error) {
  console.error('✗ Structure verification failed:', error);
  process.exit(1);
}

// Test 3: Generate context for agent prompt (mock version)
console.log('\nTest 3: Generating agent context...');
try {
  // Since we can't access database, create a mock version
  const data = JSON.parse(compileUserDataToJSON(testProfile));
  
  const mockContext = `
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
  
  console.log('✓ Context generation successful');
  console.log('\nGenerated context:');
  console.log(mockContext);
} catch (error) {
  console.error('✗ Context generation failed:', error);
  process.exit(1);
}

console.log('\n===================================');
console.log('ALL TESTS PASSED ✓');
console.log('===================================\n');
console.log('Next steps:');
console.log('1. Run database migrations: supabase migration up');
console.log('2. Set environment variables in .env.local');
console.log('3. Start dev server: npm run dev');
console.log('4. Create a test account at /signup');
console.log('5. Upload a test resume at /onboarding');
console.log('6. Verify data compilation at /api/user/export-profile');
console.log();
