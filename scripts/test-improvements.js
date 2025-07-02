#!/usr/bin/env node

/**
 * Test script for SnapBet platform improvements
 * Run with: node scripts/test-improvements.js
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const requestOptions = {
      timeout: 30000,
      ...options
    };

    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout (30s)')));
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testHealthCheck() {
  log('\n🏥 Testing Health Check API...', 'blue');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/health`);
    
    if (response.status === 200) {
      log('✅ Health check passed', 'green');
      log(`   Status: ${response.data.status}`, 'green');
      log(`   Database: ${response.data.checks.database.status}`, 'green');
      log(`   Cache: ${response.data.checks.cache.status}`, 'green');
      log(`   Memory: ${response.data.checks.memory.status}`, 'green');
      log(`   Response Time: ${response.headers['x-response-time']}`, 'green');
    } else {
      log(`❌ Health check failed with status ${response.status}`, 'red');
    }
  } catch (error) {
    log(`❌ Health check error: ${error.message}`, 'red');
  }
}

async function testCountriesAPI() {
  log('\n🌍 Testing Countries API...', 'blue');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/countries`);
    
    if (response.status === 200) {
      log('✅ Countries API working', 'green');
      log(`   Cache: ${response.headers['x-cache']}`, 'green');
      log(`   Countries returned: ${response.data.length}`, 'green');
      
      // Test cache hit
      const cachedResponse = await makeRequest(`${BASE_URL}/api/countries`);
      log(`   Second request cache: ${cachedResponse.headers['x-cache']}`, 'green');
    } else {
      log(`❌ Countries API failed with status ${response.status}`, 'red');
    }
  } catch (error) {
    log(`❌ Countries API error: ${error.message}`, 'red');
  }
}

async function testRateLimiting() {
  log('\n🚦 Testing Rate Limiting...', 'blue');
  
  try {
    const requests = [];
    for (let i = 0; i < 6; i++) {
      requests.push(makeRequest(`${BASE_URL}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' })
      }));
    }
    
    const responses = await Promise.allSettled(requests);
    const rateLimited = responses.filter(r => 
      r.status === 'fulfilled' && r.value.status === 429
    ).length;
    
    if (rateLimited > 0) {
      log(`✅ Rate limiting working (${rateLimited} requests blocked)`, 'green');
    } else {
      log('⚠️  Rate limiting may not be working as expected', 'yellow');
    }
  } catch (error) {
    log(`❌ Rate limiting test error: ${error.message}`, 'red');
  }
}

async function testSecurityHeaders() {
  log('\n🔒 Testing Security Headers...', 'blue');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/countries`);
    const headers = response.headers;
    
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'referrer-policy'
    ];
    
    const missingHeaders = securityHeaders.filter(header => !headers[header]);
    
    if (missingHeaders.length === 0) {
      log('✅ All security headers present', 'green');
    } else {
      log(`⚠️  Missing security headers: ${missingHeaders.join(', ')}`, 'yellow');
    }
  } catch (error) {
    log(`❌ Security headers test error: ${error.message}`, 'red');
  }
}

async function testDatabaseConnection() {
  log('\n🗄️  Testing Database Connection...', 'blue');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/health`);
    
    if (response.status === 200) {
      const dbCheck = response.data.checks.database;
      
      if (dbCheck.status === 'healthy') {
        log('✅ Database connection healthy', 'green');
        log(`   Response time: ${dbCheck.responseTime}ms`, 'green');
      } else {
        log(`❌ Database connection issues: ${dbCheck.status}`, 'red');
        if (dbCheck.error) {
          log(`   Error: ${dbCheck.error}`, 'red');
        }
      }
    } else {
      log(`❌ Cannot test database connection - health check failed`, 'red');
    }
  } catch (error) {
    log(`❌ Database connection test error: ${error.message}`, 'red');
  }
}

async function testCachePerformance() {
  log('\n⚡ Testing Cache Performance...', 'blue');
  
  try {
    const startTime = Date.now();
    const response1 = await makeRequest(`${BASE_URL}/api/countries`);
    const firstRequestTime = Date.now() - startTime;
    
    const startTime2 = Date.now();
    const response2 = await makeRequest(`${BASE_URL}/api/countries`);
    const secondRequestTime = Date.now() - startTime2;
    
    if (response1.headers['x-cache'] === 'MISS' && response2.headers['x-cache'] === 'HIT') {
      log('✅ Cache performance working', 'green');
      log(`   First request: ${firstRequestTime}ms (cache miss)`, 'green');
      log(`   Second request: ${secondRequestTime}ms (cache hit)`, 'green');
      
      if (secondRequestTime < firstRequestTime) {
        log('   ✅ Cache is improving performance', 'green');
      } else {
        log('   ⚠️  Cache may not be improving performance', 'yellow');
      }
    } else {
      log('⚠️  Cache behavior unexpected', 'yellow');
    }
  } catch (error) {
    log(`❌ Cache performance test error: ${error.message}`, 'red');
  }
}

async function runAllTests() {
  log(`${colors.bold}🧪 SnapBet Platform Improvements Test Suite${colors.reset}`, 'blue');
  log(`Testing against: ${BASE_URL}`, 'blue');
  
  const tests = [
    testHealthCheck,
    testCountriesAPI,
    testRateLimiting,
    testSecurityHeaders,
    testDatabaseConnection,
    testCachePerformance
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      log(`❌ Test failed: ${error.message}`, 'red');
      failed++;
    }
  }
  
  log(`\n${colors.bold}📊 Test Results:${colors.reset}`, 'blue');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`, 'blue');
  
  if (failed === 0) {
    log('\n🎉 All tests passed! Platform improvements are working correctly.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please check the implementation.', 'yellow');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    log(`\n💥 Test suite failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = {
  testHealthCheck,
  testCountriesAPI,
  testRateLimiting,
  testSecurityHeaders,
  testDatabaseConnection,
  testCachePerformance,
  runAllTests
}; 