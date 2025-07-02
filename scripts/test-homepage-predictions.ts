import prisma from '../lib/db'

async function testHomepagePredictions() {
  try {
    console.log('🔍 Testing Homepage Predictions API...\n')

    // Check total predictions
    const totalPredictions = await prisma.prediction.count()
    console.log(`📊 Total predictions in database: ${totalPredictions}`)

    if (totalPredictions === 0) {
      console.log('❌ No predictions found in database')
      return
    }

    // Get all predictions with match data
    const allPredictions = await prisma.prediction.findMany({
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          }
        }
      },
      take: 5
    })

    console.log('\n📋 Sample predictions:')
    allPredictions.forEach((pred, index) => {
      console.log(`\n${index + 1}. ${pred.match?.homeTeam?.name || 'Unknown'} vs ${pred.match?.awayTeam?.name || 'Unknown'}`)
      console.log(`   League: ${pred.match?.league?.name || 'Unknown'}`)
      console.log(`   Date: ${pred.match?.matchDate || 'Unknown'}`)
      console.log(`   Status: ${pred.match?.status || 'Unknown'}`)
      console.log(`   Confidence: ${pred.confidenceScore || 'N/A'}%`)
      console.log(`   Value Rating: ${pred.valueRating || 'N/A'}`)
      console.log(`   Show in Daily Tips: ${pred.showInDailyTips}`)
      console.log(`   Is Featured: ${pred.isFeatured}`)
      console.log(`   Is Free: ${pred.isFree}`)
    })

    // Test the homepage filtering logic
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    console.log(`\n📅 Date range for filtering:`)
    console.log(`   Today: ${today.toISOString()}`)
    console.log(`   Tomorrow: ${tomorrow.toISOString()}`)

    // Check upcoming matches
    const upcomingMatches = await prisma.prediction.findMany({
      where: {
        match: {
          matchDate: {
            gte: today,
            lte: tomorrow,
          },
          status: {
            in: ['upcoming', 'live']
          }
        }
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          }
        }
      }
    })

    console.log(`\n⏰ Upcoming matches (today/tomorrow): ${upcomingMatches.length}`)

    // Check high confidence predictions
    const highConfidence = await prisma.prediction.findMany({
      where: {
        OR: [
          { confidenceScore: { gte: 70 } },
          { valueRating: { in: ['High', 'Very High'] } },
          { showInDailyTips: true },
          { isFeatured: true }
        ]
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          }
        }
      }
    })

    console.log(`\n🎯 High quality predictions: ${highConfidence.length}`)

    // Test the combined filter
    const homepagePredictions = await prisma.prediction.findMany({
      where: {
        match: {
          matchDate: {
            gte: today,
            lte: tomorrow,
          },
          status: {
            in: ['upcoming', 'live']
          }
        },
        OR: [
          { confidenceScore: { gte: 70 } },
          { valueRating: { in: ['High', 'Very High'] } },
          { showInDailyTips: true },
          { isFeatured: true }
        ]
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          }
        }
      },
      orderBy: [
        { confidenceScore: 'desc' },
        { valueRating: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 10
    })

    console.log(`\n🏠 Homepage predictions (combined filter): ${homepagePredictions.length}`)

    if (homepagePredictions.length > 0) {
      console.log('\n✅ Top predictions for homepage:')
      homepagePredictions.slice(0, 3).forEach((pred, index) => {
        console.log(`\n${index + 1}. ${pred.match?.homeTeam?.name || 'Unknown'} vs ${pred.match?.awayTeam?.name || 'Unknown'}`)
        console.log(`   League: ${pred.match?.league?.name || 'Unknown'}`)
        console.log(`   Date: ${pred.match?.matchDate || 'Unknown'}`)
        console.log(`   Confidence: ${pred.confidenceScore || 'N/A'}%`)
        console.log(`   Value Rating: ${pred.valueRating || 'N/A'}`)
      })
    } else {
      console.log('\n⚠️  No predictions match the homepage criteria')
      console.log('   This could be because:')
      console.log('   - No matches are scheduled for today/tomorrow')
      console.log('   - No predictions have high confidence or value ratings')
      console.log('   - Predictions are not marked as featured or daily tips')
    }

  } catch (error) {
    console.error('❌ Error testing homepage predictions:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testHomepagePredictions() 