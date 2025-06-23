const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createSamplePredictions() {
  try {
    // Get the first user (you can modify this to target a specific user)
    const user = await prisma.user.findFirst()
    
    if (!user) {
      console.log('No user found. Please create a user first.')
      return
    }

    console.log(`Creating sample predictions for user: ${user.email}`)

    // Get some existing predictions to reference
    const predictions = await prisma.prediction.findMany({
      take: 5,
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true
          }
        }
      }
    })

    if (predictions.length === 0) {
      console.log('No predictions found in database. Please create some predictions first.')
      return
    }

    // Create sample user predictions with different outcomes
    const sampleUserPredictions = [
      {
        userId: user.id,
        predictionId: predictions[0].id,
        stakeAmount: 100,
        potentialReturn: 175,
        actualReturn: 175, // Won
        status: 'won',
        placedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      },
      {
        userId: user.id,
        predictionId: predictions[1].id,
        stakeAmount: 100,
        potentialReturn: 200,
        actualReturn: 0, // Lost
        status: 'lost',
        placedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // 14 days ago
      },
      {
        userId: user.id,
        predictionId: predictions[2].id,
        stakeAmount: 100,
        potentialReturn: 156,
        actualReturn: 156, // Won
        status: 'won',
        placedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) // 21 days ago
      },
      {
        userId: user.id,
        predictionId: predictions[3].id,
        stakeAmount: 100,
        potentialReturn: 230,
        actualReturn: 230, // Won
        status: 'won',
        placedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) // 25 days ago
      },
      {
        userId: user.id,
        predictionId: predictions[4].id,
        stakeAmount: 100,
        potentialReturn: 191,
        actualReturn: 0, // Lost
        status: 'lost',
        placedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      }
    ]

    // Create the user predictions
    for (const userPrediction of sampleUserPredictions) {
      await prisma.userPrediction.create({
        data: userPrediction
      })
    }

    console.log('✅ Created 5 sample user predictions:')
    console.log('- 3 won predictions (60% accuracy)')
    console.log('- 2 lost predictions')
    console.log('- Mix of recent and older predictions for monthly calculations')

    // Calculate the expected metrics
    const totalPredictions = 5
    const wonPredictions = 3
    const accuracy = (wonPredictions / totalPredictions) * 100
    const monthlyPredictions = 2 // Only 2 predictions in last 30 days
    const monthlyWon = 1 // Only 1 won in last 30 days
    const monthlyAccuracy = (monthlyWon / monthlyPredictions) * 100

    console.log('\n📊 Expected Dashboard Metrics:')
    console.log(`- Overall Accuracy: ${accuracy}%`)
    console.log(`- Monthly Success: ${monthlyAccuracy}%`)
    console.log(`- User Level: Should be around 3-4 (based on 60% accuracy)`)

  } catch (error) {
    console.error('Error creating sample predictions:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
createSamplePredictions() 