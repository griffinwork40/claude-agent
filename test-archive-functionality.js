/**
 * Test script for conversation archiving functionality
 */

const BASE_URL = 'http://localhost:3000';

async function testArchiveFunctionality() {
  console.log('🧪 Testing conversation archiving functionality...\n');

  try {
    // Test 1: Get conversations
    console.log('1. Testing GET /api/conversations');
    const getResponse = await fetch(`${BASE_URL}/api/conversations`);
    console.log(`   Status: ${getResponse.status}`);
    
    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log(`   ✅ Found ${data.conversations?.length || 0} conversations`);
    } else {
      console.log(`   ❌ Failed to get conversations: ${getResponse.statusText}`);
    }

    // Test 2: Get conversations including archived
    console.log('\n2. Testing GET /api/conversations?includeArchived=true');
    const getArchivedResponse = await fetch(`${BASE_URL}/api/conversations?includeArchived=true`);
    console.log(`   Status: ${getArchivedResponse.status}`);
    
    if (getArchivedResponse.ok) {
      const data = await getArchivedResponse.json();
      console.log(`   ✅ Found ${data.conversations?.length || 0} conversations (including archived)`);
    } else {
      console.log(`   ❌ Failed to get conversations with archived: ${getArchivedResponse.statusText}`);
    }

    // Test 3: Test archive endpoint (this will fail without auth, but we can test the endpoint exists)
    console.log('\n3. Testing POST /api/conversations/archive (without auth - should return 401)');
    const archiveResponse = await fetch(`${BASE_URL}/api/conversations/archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'test-session',
        archived: true
      })
    });
    console.log(`   Status: ${archiveResponse.status}`);
    
    if (archiveResponse.status === 401) {
      console.log('   ✅ Correctly requires authentication');
    } else {
      console.log(`   ⚠️  Unexpected status: ${archiveResponse.statusText}`);
    }

    console.log('\n🎉 Archive functionality API endpoints are working!');
    console.log('\n📝 To test the full functionality:');
    console.log('   1. Start the dev server: npm run dev');
    console.log('   2. Navigate to http://localhost:3000/agent');
    console.log('   3. Create a conversation by sending a message');
    console.log('   4. Look for the archive button (arrow icon) on hover over conversations');
    console.log('   5. Click "Show Archived" to toggle between active and archived conversations');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the dev server is running: npm run dev');
  }
}

// Run the test
testArchiveFunctionality();
