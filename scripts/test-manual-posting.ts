/**
 * Test Manual Twitter Posting
 * 
 * Manually triggers the post-scheduled endpoint to test posting
 */

import * as dotenv from 'dotenv'
import fetch from 'node-fetch'

dotenv.config({ path: '.env.local' })
dotenv.config()

async function testManualPosting() {
  console.log('🧪 Testing Manual Twitter Posting\n')
  console.log('='.repeat(60))
  
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'
  
  console.log(`\n1️⃣  Calling posting endpoint...`)
  console.log(`   URL: ${baseUrl}/api/admin/social/twitter/post-scheduled`)
  
  try {
    const response = await fetch(`${baseUrl}/api/admin/social/twitter/post-scheduled`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    })
    
    const data = await response.json() as any
    
    if (!response.ok) {
      console.error(`❌ Error: ${response.status} ${response.statusText}`)
      console.error(`   Response:`, JSON.stringify(data, null, 2))
      return
    }
    
    console.log(`✅ Response received (${response.status})`)
    console.log(`\n📊 Results:`)
    console.log(`   Success: ${data.success}`)
    console.log(`   Message: ${data.message || 'N/A'}`)
    
    if (data.summary) {
      console.log(`\n   Summary:`)
      console.log(`   - Posted: ${data.summary.posted || 0}`)
      console.log(`   - Failed: ${data.summary.failed || 0}`)
      console.log(`   - Total: ${data.summary.total || 0}`)
    }
    
    if (data.errors && data.errors.length > 0) {
      console.log(`\n   Errors:`)
      data.errors.forEach((error: string, idx: number) => {
        console.log(`   ${idx + 1}. ${error}`)
      })
    }
    
    if (data.duration) {
      console.log(`\n   Duration: ${data.duration}`)
    }
    
  } catch (error) {
    console.error(`❌ Failed to call endpoint:`)
    console.error(`   ${error instanceof Error ? error.message : String(error)}`)
    console.error(`\n   💡 Make sure the server is running and accessible at ${baseUrl}`)
  }
  
  console.log('\n')
}

testManualPosting()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

