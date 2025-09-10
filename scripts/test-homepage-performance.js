// Homepage Performance Test Script
// Tests the performance of homepage API endpoints

const BASE_URL = 'http://localhost:3000'

async function testEndpoint(endpoint, name) {
  const startTime = Date.now()
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`)
    const endTime = Date.now()
    const responseTime = endTime - startTime
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ ${name}: ${responseTime}ms (${data.success ? 'success' : 'error'})`)
      return { success: true, time: responseTime, data }
    } else {
      console.log(`❌ ${name}: ${responseTime}ms (HTTP ${response.status})`)
      return { success: false, time: responseTime, error: response.status }
    }
  } catch (error) {
    const endTime = Date.now()
    const responseTime = endTime - startTime
    console.log(`❌ ${name}: ${responseTime}ms (Error: ${error.message})`)
    return { success: false, time: responseTime, error: error.message }
  }
}

async function runPerformanceTest() {
  console.log('🚀 Starting Homepage Performance Test...\n')
  
  const endpoints = [
    { url: '/api/homepage/free-tip', name: 'Free Tip API' },
    { url: '/api/homepage/predictions', name: 'Predictions API' },
    { url: '/api/homepage/stats', name: 'Stats API' },
    { url: '/api/predictions/live-ticker', name: 'Live Ticker API' }
  ]
  
  const results = []
  
  // Test each endpoint
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.url, endpoint.name)
    results.push({ ...endpoint, ...result })
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Calculate totals
  const totalTime = results.reduce((sum, r) => sum + r.time, 0)
  const successfulRequests = results.filter(r => r.success).length
  const averageTime = totalTime / results.length
  
  console.log('\n📊 Performance Summary:')
  console.log(`Total Time: ${totalTime}ms`)
  console.log(`Average Time: ${Math.round(averageTime)}ms`)
  console.log(`Successful Requests: ${successfulRequests}/${results.length}`)
  
  // Performance thresholds
  const thresholds = {
    excellent: 500,
    good: 1000,
    acceptable: 2000,
    poor: 5000
  }
  
  let performanceRating = 'poor'
  if (averageTime < thresholds.excellent) performanceRating = 'excellent'
  else if (averageTime < thresholds.good) performanceRating = 'good'
  else if (averageTime < thresholds.acceptable) performanceRating = 'acceptable'
  
  console.log(`Performance Rating: ${performanceRating.toUpperCase()}`)
  
  // Detailed results
  console.log('\n📋 Detailed Results:')
  results.forEach(result => {
    const status = result.success ? '✅' : '❌'
    const rating = result.time < 500 ? '🟢' : result.time < 1000 ? '🟡' : result.time < 2000 ? '🟠' : '🔴'
    console.log(`${status} ${rating} ${result.name}: ${result.time}ms`)
  })
  
  return results
}

// Run the test
runPerformanceTest().catch(console.error)

