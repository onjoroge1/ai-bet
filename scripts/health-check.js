#!/usr/bin/env node

/**
 * Health check script for SnapBet platform
 * Works on Windows, macOS, and Linux
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

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.request(url, { timeout: 15000 }, (res) => {
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
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.end();
  });
}

async function checkHealth() {
  log(`${colors.bold}🏥 SnapBet Platform Health Check${colors.reset}`, 'blue');
  log(`Checking: ${BASE_URL}/api/health`, 'blue');
  log('─'.repeat(50), 'blue');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/health`);
    
    if (response.status === 200) {
      const health = response.data;
      
      // Overall status
      const statusColor = health.status === 'healthy' ? 'green' : 
                         health.status === 'degraded' ? 'yellow' : 'red';
      log(`\n📊 Overall Status: ${health.status.toUpperCase()}`, statusColor);
      
      // Individual checks
      log('\n🔍 System Checks:', 'blue');
      
      // Database
      const dbColor = health.checks.database.status === 'healthy' ? 'green' : 
                     health.checks.database.status === 'degraded' ? 'yellow' : 'red';
      log(`   🗄️  Database: ${health.checks.database.status} (${health.checks.database.responseTime}ms)`, dbColor);
      
      // Cache
      const cacheColor = health.checks.cache.status === 'healthy' ? 'green' : 
                        health.checks.cache.status === 'degraded' ? 'yellow' : 'red';
      log(`   ⚡ Cache: ${health.checks.cache.status} (${health.checks.cache.responseTime}ms)`, cacheColor);
      
      // Memory
      const memColor = health.checks.memory.status === 'healthy' ? 'green' : 
                      health.checks.memory.status === 'degraded' ? 'yellow' : 'red';
      const memPercent = Math.round((health.checks.memory.usage / health.checks.memory.limit) * 100);
      log(`   💾 Memory: ${health.checks.memory.status} (${health.checks.memory.usage}MB / ${health.checks.memory.limit}MB - ${memPercent}%)`, memColor);
      
      // Uptime
      const uptimeHours = Math.floor(health.checks.uptime.uptime / 3600);
      const uptimeMinutes = Math.floor((health.checks.uptime.uptime % 3600) / 60);
      log(`   ⏱️  Uptime: ${uptimeHours}h ${uptimeMinutes}m`, 'green');
      
      // Performance metrics
      if (health.performance && health.performance.totalRequests > 0) {
        log('\n📈 Performance Metrics:', 'blue');
        log(`   🚀 Avg Response Time: ${health.performance.avgResponseTime}ms`, 'green');
        log(`   📊 Total Requests: ${health.performance.totalRequests}`, 'green');
        log(`   ⚠️  Slow Requests: ${health.performance.slowRequests}`, health.performance.slowRequests > 0 ? 'yellow' : 'green');
      }
      
      // Response time
      const responseTime = response.headers['x-response-time'];
      if (responseTime) {
        log(`\n⏱️  Health Check Response Time: ${responseTime}`, 'blue');
      }
      
      // Version
      log(`\n📦 Version: ${health.version}`, 'blue');
      
      // Summary
      log('\n' + '─'.repeat(50), 'blue');
      if (health.status === 'healthy') {
        log('✅ All systems operational!', 'green');
      } else if (health.status === 'degraded') {
        log('⚠️  System is degraded - some issues detected', 'yellow');
      } else {
        log('❌ System is down - critical issues detected', 'red');
      }
      
    } else {
      log(`❌ Health check failed with status ${response.status}`, 'red');
      if (response.data && response.data.error) {
        log(`   Error: ${response.data.error}`, 'red');
      }
    }
    
  } catch (error) {
    log(`❌ Health check error: ${error.message}`, 'red');
    log('\n💡 Troubleshooting tips:', 'yellow');
    log('   • Make sure the development server is running (npm run dev)', 'yellow');
    log('   • Check if the server is accessible at the correct URL', 'yellow');
    log('   • Verify that all environment variables are set correctly', 'yellow');
  }
}

// Run health check if this script is executed directly
if (require.main === module) {
  checkHealth().catch(error => {
    log(`\n💥 Health check failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { checkHealth }; 