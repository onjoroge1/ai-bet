/**
 * Test API response for duplicates
 * Simulates what the homepage receives
 */

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

async function testApiResponse() {
  console.log('=== Testing API Response for Duplicates ===\n')

  if (!BASE_URL) {
    console.error('BACKEND_API_URL not set')
    return
  }

  // Test our internal API
  console.log('1. Testing internal API: /api/market?status=live&mode=lite')
  try {
    const response = await fetch('http://localhost:3000/api/market?status=live&mode=lite', {
      cache: 'no-store',
    })
    const data = await response.json()
    const matches = data.matches || []

    console.log(`   Received ${matches.length} matches`)

    // Check for duplicate matchIds
    const matchIdMap = new Map<string, any[]>()
    matches.forEach((match: any) => {
      const matchId = String(match.id || match.match_id || '')
      if (!matchIdMap.has(matchId)) {
        matchIdMap.set(matchId, [])
      }
      matchIdMap.get(matchId)!.push(match)
    })

    const duplicates = Array.from(matchIdMap.entries()).filter(
      ([_, matches]) => matches.length > 1
    )

    if (duplicates.length > 0) {
      console.log(`   ⚠️ Found ${duplicates.length} duplicate matchIds in API response:`)
      duplicates.forEach(([matchId, matches]) => {
        console.log(`\n   Match ID: ${matchId}`)
        matches.forEach((match, index) => {
          console.log(`     Duplicate ${index + 1}:`)
          console.log(`       Teams: ${match.home?.name || match.homeTeam?.name} vs ${match.away?.name || match.awayTeam?.name}`)
          console.log(`       Odds:`, match.odds)
          console.log(`       Full match:`, JSON.stringify(match, null, 2))
        })
      })
    } else {
      console.log('   ✅ No duplicate matchIds in API response')
    }

    // Check for matches with same teams
    const teamMap = new Map<string, any[]>()
    matches.forEach((match: any) => {
      const homeTeam = match.home?.name || match.homeTeam?.name || ''
      const awayTeam = match.away?.name || match.awayTeam?.name || ''
      const key = `${homeTeam} vs ${awayTeam}`
      if (key !== ' vs ') {
        if (!teamMap.has(key)) {
          teamMap.set(key, [])
        }
        teamMap.get(key)!.push(match)
      }
    })

    const sameTeamDuplicates = Array.from(teamMap.entries()).filter(
      ([_, matches]) => matches.length > 1
    )

    if (sameTeamDuplicates.length > 0) {
      console.log(`\n   ⚠️ Found ${sameTeamDuplicates.length} team combinations with multiple matchIds:`)
      sameTeamDuplicates.forEach(([teams, matches]) => {
        console.log(`\n   ${teams}:`)
        matches.forEach((match) => {
          const matchId = match.id || match.match_id
          console.log(`     Match ID: ${matchId}`)
          console.log(`     Odds:`, match.odds)
        })
      })
    }

    // Check specific match 1396383
    const match1396383 = matches.filter((m: any) => 
      String(m.id || m.match_id) === '1396383'
    )
    if (match1396383.length > 0) {
      console.log(`\n2. Match 1396383 in API response:`)
      console.log(`   Found ${match1396383.length} occurrence(s)`)
      match1396383.forEach((match: any, index: number) => {
        console.log(`\n   Occurrence ${index + 1}:`)
        console.log(`     ID: ${match.id || match.match_id}`)
        console.log(`     Teams: ${match.home?.name || match.homeTeam?.name} vs ${match.away?.name || match.awayTeam?.name}`)
        console.log(`     Odds:`, JSON.stringify(match.odds, null, 2))
      })
    }

  } catch (error) {
    console.error('   Error testing internal API:', error)
  }

  // Test external API directly
  console.log('\n3. Testing external API directly:')
  try {
    const url = `${BASE_URL}/market?status=live&mode=lite`
    console.log(`   URL: ${url}`)
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      cache: 'no-store',
    })
    const data = await response.json()
    const matches = data.matches || []

    console.log(`   Received ${matches.length} matches from external API`)

    // Check for duplicates
    const matchIdMap = new Map<string, any[]>()
    matches.forEach((match: any) => {
      const matchId = String(match.match_id || match.id || '')
      if (!matchIdMap.has(matchId)) {
        matchIdMap.set(matchId, [])
      }
      matchIdMap.get(matchId)!.push(match)
    })

    const duplicates = Array.from(matchIdMap.entries()).filter(
      ([_, matches]) => matches.length > 1
    )

    if (duplicates.length > 0) {
      console.log(`   ⚠️ External API returned ${duplicates.length} duplicate matchIds`)
      duplicates.forEach(([matchId, matches]) => {
        console.log(`\n   Match ID: ${matchId} (${matches.length} occurrences)`)
      })
    } else {
      console.log('   ✅ No duplicates in external API response')
    }

  } catch (error) {
    console.error('   Error testing external API:', error)
  }
}

testApiResponse().catch(console.error)

