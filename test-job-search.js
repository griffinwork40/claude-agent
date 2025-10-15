// test-job-search.js
// Simple test script to verify job search endpoints work

const testJobSearch = async () => {
  console.log('🧪 Testing job search endpoints...\n');
  
  // Test Google Jobs endpoint
  console.log('1. Testing Google Jobs endpoint...');
  try {
    const response = await fetch('http://localhost:3000/api/search-google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords: 'software engineer',
        location: 'Remote',
        remote: true
      })
    });
    
    const data = await response.json();
    console.log('✅ Google Jobs response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Google Jobs error:', error.message);
  }
  
  console.log('\n2. Testing Indeed endpoint...');
  try {
    const response = await fetch('http://localhost:3000/api/search-indeed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords: 'software engineer',
        location: 'Remote',
        remote: true
      })
    });
    
    const data = await response.json();
    console.log('✅ Indeed response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Indeed error:', error.message);
  }
};

// Run the test
testJobSearch().catch(console.error);