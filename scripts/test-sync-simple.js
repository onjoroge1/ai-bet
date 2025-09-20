#!/usr/bin/env node

/**
 * Simple Test for Sync Functionality
 * Tests the sync endpoint with curl-like requests
 */

const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
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

async function testUpcomingMatches() {
  console.log('\n🔍 Testing Upcoming Matches Endpoint');
  try {
    const response = await makeRequest('/api/admin/predictions/upcoming-matches?timeWindow=72h&leagueId=');
    console.log(`📊 Status: ${response.statusCode}`);
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      console.log('✅ Upcoming Matches:', data.data?.counts);
    } else {
      console.log('❌ Error:', response.body);
    }
  } catch (error) {
    console.log('💥 Error:', error.message);
  }
}

async function testSyncEndpoint() {
  console.log('\n🧪 Testing Sync Endpoint (72h window)');
  const payload = {
    timeWindow: '72h',
    leagueId: undefined,
    syncAll: false,
    limit: 50
  };
  
  try {
    const response = await makeRequest('/api/admin/predictions/sync-quickpurchases', 'POST', payload);
    console.log(`📊 Status: ${response.statusCode}`);
    console.log('📡 Response:', response.body);
  } catch (error) {
    console.log('💥 Error:', error.message);
  }
}

async function main() {
  console.log('🚀 Simple Sync Test');
  console.log('=' .repeat(40));
  
  await testUpcomingMatches();
  await testSyncEndpoint();
  
  console.log('\n✅ Test completed');
  console.log('\n📝 Note: Sync will fail with 401 without auth, but we can see if the request structure is correct');
}

main().catch(console.error);

