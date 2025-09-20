#!/usr/bin/env node

/**
 * Test Script for Sync Functionality
 * This script tests the sync-quickpurchases API endpoint directly
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/admin/predictions/sync-quickpurchases';

// Test configurations
const testConfigs = [
  {
    name: 'Test 1: Sync 72h window (should process ~33 matches)',
    payload: {
      timeWindow: '72h',
      leagueId: undefined,
      syncAll: false,
      limit: 50
    }
  },
  {
    name: 'Test 2: Sync all upcoming matches',
    payload: {
      timeWindow: 'all',
      leagueId: undefined,
      syncAll: true,
      limit: 100
    }
  },
  {
    name: 'Test 3: Sync 48h window only',
    payload: {
      timeWindow: '48h',
      leagueId: undefined,
      syncAll: false,
      limit: 20
    }
  }
];

async function testSyncEndpoint(config) {
  console.log(`\n🧪 ${config.name}`);
  console.log('📡 Payload:', JSON.stringify(config.payload, null, 2));
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${BASE_URL}${API_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail without proper auth, but we can see the request structure
      },
      body: JSON.stringify(config.payload)
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success Response:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Error Response:', errorText);
    }
    
  } catch (error) {
    console.log('💥 Request Failed:', error.message);
  }
}

async function testUpcomingMatchesEndpoint() {
  console.log('\n🔍 Testing Upcoming Matches Endpoint');
  
  try {
    const response = await fetch(`${BASE_URL}/api/admin/predictions/upcoming-matches?timeWindow=72h&leagueId=`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Upcoming Matches Data:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Error Response:', errorText);
    }
    
  } catch (error) {
    console.log('💥 Request Failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting Sync Functionality Tests');
  console.log('=' .repeat(50));
  
  // Test upcoming matches endpoint first
  await testUpcomingMatchesEndpoint();
  
  // Test sync endpoints
  for (const config of testConfigs) {
    await testSyncEndpoint(config);
  }
  
  console.log('\n✅ All tests completed');
  console.log('\n📝 Notes:');
  console.log('- These tests will fail with 401 Unauthorized without proper auth');
  console.log('- Check server logs to see if requests are being received');
  console.log('- The important part is verifying the request structure and server response');
}

main().catch(console.error);

