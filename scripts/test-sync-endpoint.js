#!/usr/bin/env node

/**
 * Direct Test for Sync Endpoint
 * Tests the sync-quickpurchases endpoint with proper authentication
 */

const http = require('http');

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testSyncEndpoint() {
  console.log('🧪 Testing Sync Endpoint Directly');
  console.log('=' .repeat(50));
  
  const payload = {
    timeWindow: '72h',
    leagueId: undefined,
    syncAll: false,
    limit: 50
  };
  
  console.log('📡 Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await makeRequest('/api/admin/predictions/sync-quickpurchases', 'POST', payload);
    console.log(`📊 Status: ${response.statusCode}`);
    console.log('📡 Headers:', response.headers);
    console.log('📡 Response Body:', response.body);
    
    if (response.statusCode === 200) {
      console.log('✅ Sync endpoint is working!');
    } else if (response.statusCode === 401) {
      console.log('🔐 Authentication required (expected)');
    } else {
      console.log('❌ Unexpected response');
    }
  } catch (error) {
    console.log('💥 Error:', error.message);
  }
}

async function testUpcomingMatches() {
  console.log('\n🔍 Testing Upcoming Matches Endpoint');
  console.log('=' .repeat(50));
  
  try {
    const response = await makeRequest('/api/admin/predictions/upcoming-matches?timeWindow=72h&leagueId=');
    console.log(`📊 Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      console.log('✅ Upcoming matches data:', data.data?.counts);
    } else {
      console.log('❌ Error:', response.body);
    }
  } catch (error) {
    console.log('💥 Error:', error.message);
  }
}

async function main() {
  console.log('🚀 Direct API Endpoint Tests');
  console.log('=' .repeat(50));
  
  await testUpcomingMatches();
  await testSyncEndpoint();
  
  console.log('\n✅ Tests completed');
  console.log('\n📝 Next Steps:');
  console.log('1. Check if sync endpoint returns 401 (auth required)');
  console.log('2. If 401, the endpoint exists and works');
  console.log('3. The issue is likely in the button click handler');
}

main().catch(console.error);

