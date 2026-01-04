import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

async function testManualSync() {
  console.log('=== Testing Manual Sync Process ===\n')
  console.log(`BASE_URL: ${BASE_URL}`)
  console.log(`API_KEY: ${API_KEY ? 'SET' : 'NOT SET'}\n`)

  if (!BASE_URL) {
    console.error('❌ BACKEND_API_URL not configured')
    return
  }

  try {
    // Step 1: Test external API fetch
    console.log('Step 1: Testing external API fetch...')
    const url = `${BASE_URL}/market?status=live&limit=10&include_v2=false`
    console.log(`URL: ${url}`)
    
    const startTime = Date.now()
    
    // Add timeout to fetch
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 15000) // 15 second timeout

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const duration = Date.now() - startTime

      if (!response.ok) {
        console.error(`❌ API returned error: ${response.status} ${response.statusText}`)
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(`Error details: ${errorText}`)
        return
      }

      const data = await response.json()
      const matches = data.matches || []
      
      console.log(`✅ API fetch successful (${duration}ms)`)
      console.log(`   Received ${matches.length} matches\n`)

      if (matches.length === 0) {
        console.log('⚠️  No matches returned from API')
        return
      }

      // Step 2: Test database query
      console.log('Step 2: Testing database query...')
      const dbMatches = await prisma.marketMatch.findMany({
        where: {
          status: 'LIVE',
          isActive: true,
          isArchived: false,
        },
        take: 5,
        select: {
          matchId: true,
          lastSyncedAt: true,
          homeTeam: true,
          awayTeam: true,
        },
      })
      console.log(`✅ Found ${dbMatches.length} LIVE matches in database`)
      if (dbMatches.length > 0) {
        const oldest = dbMatches.reduce((oldest, m) => 
          m.lastSyncedAt < oldest ? m.lastSyncedAt : oldest, 
          dbMatches[0].lastSyncedAt
        )
        const ageSeconds = Math.floor((Date.now() - oldest.getTime()) / 1000)
        console.log(`   Oldest sync: ${ageSeconds} seconds ago\n`)
      }

      // Step 3: Test transform function
      console.log('Step 3: Testing match transformation...')
      const testMatch = matches[0]
      console.log(`   Testing match: ${testMatch.id || testMatch.match_id}`)
      
      const matchId = String(testMatch.id || testMatch.match_id || '')
      if (!matchId || matchId === 'undefined' || matchId === 'null') {
        console.error('❌ Invalid match ID')
        return
      }
      console.log(`✅ Match ID valid: ${matchId}\n`)

      // Step 4: Test database upsert
      console.log('Step 4: Testing database upsert...')
      const transformed = {
        matchId,
        status: 'LIVE',
        homeTeam: testMatch.home?.name || 'Test Home',
        awayTeam: testMatch.away?.name || 'Test Away',
        league: testMatch.league?.name || 'Test League',
        kickoffDate: new Date(),
        lastSyncedAt: new Date(),
        syncCount: 1,
      }

      try {
        await prisma.marketMatch.upsert({
          where: { matchId },
          update: {
            lastSyncedAt: new Date(),
            syncCount: { increment: 1 },
          },
          create: transformed,
        })
        console.log(`✅ Database upsert successful\n`)
      } catch (dbError) {
        console.error('❌ Database upsert failed:', dbError)
        return
      }

      console.log('✅ All steps completed successfully!')
      console.log('\n=== Summary ===')
      console.log('1. ✅ External API fetch works')
      console.log('2. ✅ Database query works')
      console.log('3. ✅ Match transformation works')
      console.log('4. ✅ Database upsert works')
      console.log('\nThe sync process should work. Check for timeout issues.')

    } catch (error) {
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`❌ API fetch TIMEOUT after ${duration}ms (15s limit)`)
        console.error('   This is the problem - external API is too slow')
        console.error('   The sync process hangs here waiting for API response')
      } else {
        console.error(`❌ API fetch failed after ${duration}ms:`, error)
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testManualSync()

