/**
 * Check what the API is actually returning for match 1379152
 */

async function checkApiResponse() {
  const matchId = '1379152'
  const url = `http://localhost:3000/api/match/${matchId}`
  
  console.log(`\n🔍 Checking API response for match ${matchId}...\n`)
  console.log(`URL: ${url}\n`)
  
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`)
      return
    }
    
    const data = await response.json()
    const match = data.match
    
    console.log('📊 API Response:')
    console.log('='.repeat(60))
    console.log(`Status: ${match?.status}`)
    console.log(`Has final_result: ${!!match?.final_result}`)
    console.log(`Has score: ${!!match?.score}`)
    console.log(`Has live_data: ${!!match?.live_data}`)
    
    if (match?.final_result) {
      console.log(`\n✅ final_result:`, JSON.stringify(match.final_result, null, 2))
    } else {
      console.log(`\n❌ final_result: MISSING`)
    }
    
    if (match?.score) {
      console.log(`\n✅ score:`, JSON.stringify(match.score, null, 2))
    } else {
      console.log(`\n❌ score: MISSING`)
    }
    
    if (match?.live_data) {
      console.log(`\n✅ live_data:`, JSON.stringify(match.live_data, null, 2))
    }
    
    console.log(`\n📋 All match keys:`, Object.keys(match || {}))
    console.log(`\n📄 Full match object:`, JSON.stringify(match, null, 2))
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkApiResponse()

