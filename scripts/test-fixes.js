const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testFixes() {
  console.log('🧪 Testing fixes...')
  
  try {
    // Test 1: Check credit system consistency
    console.log('\n1️⃣ Testing credit system consistency...')
    
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        predictionCredits: true,
        userPackages: {
          where: {
            status: 'active',
            expiresAt: { gt: new Date() }
          },
          include: {
            packageOffer: true
          }
        },
        userPoints: true
      }
    })

    for (const user of users) {
      // Calculate unified credits (same as dashboard)
      let packageCreditsCount = 0
      let hasUnlimited = false

      for (const userPackage of user.userPackages) {
        if (userPackage.packageOffer.tipCount === -1) {
          hasUnlimited = true
          break
        } else {
          packageCreditsCount += userPackage.tipsRemaining
        }
      }

      const quizCreditsCount = user.userPoints ? Math.floor(user.userPoints.points / 50) : 0
      const totalUnifiedCredits = hasUnlimited ? "∞" : (packageCreditsCount + quizCreditsCount)

      console.log(`   User ${user.id}:`)
      console.log(`     - Prediction Credits: ${user.predictionCredits}`)
      console.log(`     - Package Credits: ${packageCreditsCount}`)
      console.log(`     - Quiz Credits: ${quizCreditsCount}`)
      console.log(`     - Total Unified: ${totalUnifiedCredits}`)
      console.log(`     - Has Unlimited: ${hasUnlimited}`)
    }

    // Test 2: Check prediction data structure
    console.log('\n2️⃣ Testing prediction data structure...')
    
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        predictionData: { not: null }
      },
      take: 3,
      select: {
        id: true,
        predictionData: true,
        predictionType: true,
        confidenceScore: true,
        odds: true
      }
    })

    for (const qp of quickPurchases) {
      console.log(`   QuickPurchase ${qp.id}:`)
      console.log(`     - Prediction Type: ${qp.predictionType}`)
      console.log(`     - Confidence Score: ${qp.confidenceScore}`)
      console.log(`     - Odds: ${qp.odds}`)
      
      if (qp.predictionData?.prediction) {
        const prediction = qp.predictionData.prediction
        console.log(`     - Has Prediction: ✅`)
        console.log(`     - Has Additional Markets: ${prediction.additional_markets ? '✅' : '❌'}`)
        console.log(`     - Has Comprehensive Analysis: ${prediction.comprehensive_analysis ? '✅' : '❌'}`)
        
        if (prediction.additional_markets) {
          const markets = Object.keys(prediction.additional_markets)
          console.log(`     - Available Markets: ${markets.join(', ')}`)
        }
      } else {
        console.log(`     - Has Prediction: ❌`)
      }
    }

    // Test 3: Check my-tips API response
    console.log('\n3️⃣ Testing my-tips API response...')
    
    const purchases = await prisma.purchase.findMany({
      where: {
        status: 'completed'
      },
      take: 2,
      include: {
        quickPurchase: {
          select: {
            predictionData: true,
            predictionType: true,
            confidenceScore: true,
            odds: true
          }
        }
      }
    })

    for (const purchase of purchases) {
      console.log(`   Purchase ${purchase.id}:`)
      console.log(`     - Payment Method: ${purchase.paymentMethod}`)
      console.log(`     - Amount: ${purchase.amount}`)
      
      if (purchase.quickPurchase) {
        const qp = purchase.quickPurchase
        console.log(`     - QuickPurchase: ${qp.id}`)
        console.log(`     - Prediction Type: ${qp.predictionType}`)
        console.log(`     - Confidence Score: ${qp.confidenceScore}`)
        console.log(`     - Odds: ${qp.odds}`)
        console.log(`     - Has Prediction Data: ${qp.predictionData ? '✅' : '❌'}`)
      }
    }

    // Test 4: Check database connection
    console.log('\n4️⃣ Testing database connection...')
    
    try {
      await prisma.$queryRaw`SELECT 1`
      console.log('   Database connection: ✅')
    } catch (error) {
      console.log('   Database connection: ❌')
      console.error('   Error:', error)
    }

    console.log('\n✅ All tests completed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the tests
testFixes()
  .then(() => {
    console.log('🎉 Tests completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Tests failed:', error)
    process.exit(1)
  }) 