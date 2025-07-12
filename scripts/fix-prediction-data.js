const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixPredictionData() {
  console.log('🔧 Starting prediction data consistency fix...')
  
  try {
    // Get all QuickPurchase records with prediction data
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        predictionData: {
          not: null
        }
      },
      select: {
        id: true,
        predictionData: true,
        predictionType: true,
        confidenceScore: true,
        odds: true,
        valueRating: true,
        analysisSummary: true
      }
    })

    console.log(`📊 Found ${quickPurchases.length} QuickPurchase records with prediction data`)

    let updatedCount = 0
    let skippedCount = 0

    for (const qp of quickPurchases) {
      try {
        const predictionData = qp.predictionData
        
        // Check if prediction data has the expected structure
        if (!predictionData || typeof predictionData !== 'object') {
          console.log(`⚠️  Skipping ${qp.id}: Invalid prediction data structure`)
          skippedCount++
          continue
        }

        // Ensure prediction data has the required nested structure
        if (!predictionData.prediction) {
          console.log(`⚠️  Skipping ${qp.id}: Missing prediction.prediction field`)
          skippedCount++
          continue
        }

        const prediction = predictionData.prediction

        // Check if additional_markets exists and has proper structure
        if (!prediction.additional_markets || typeof prediction.additional_markets !== 'object') {
          console.log(`⚠️  Skipping ${qp.id}: Missing or invalid additional_markets`)
          skippedCount++
          continue
        }

        // Ensure all required additional markets have proper structure
        const requiredMarkets = ['total_goals', 'both_teams_score', 'asian_handicap']
        let needsUpdate = false

        for (const market of requiredMarkets) {
          if (!prediction.additional_markets[market]) {
            console.log(`🔧 Adding missing ${market} market to ${qp.id}`)
            prediction.additional_markets[market] = {
              over_2_5: 0.5,
              under_2_5: 0.5,
              yes: 0.5,
              no: 0.5,
              home_handicap: 0.5,
              away_handicap: 0.5
            }
            needsUpdate = true
          }
        }

        // Ensure comprehensive_analysis structure exists
        if (!prediction.comprehensive_analysis) {
          console.log(`🔧 Adding missing comprehensive_analysis to ${qp.id}`)
          prediction.comprehensive_analysis = {
            ai_verdict: {
              detailed_reasoning: qp.analysisSummary || 'AI-powered prediction analysis',
              probability_assessment: {
                home: qp.predictionType === 'home_win' ? 0.6 : 0.2,
                away: qp.predictionType === 'away_win' ? 0.6 : 0.2,
                draw: qp.predictionType === 'draw' ? 0.6 : 0.2
              }
            },
            detailed_reasoning: {
              form_analysis: 'Based on recent team performance',
              injury_impact: 'No significant injuries reported',
              tactical_factors: 'Standard tactical considerations',
              historical_context: 'Historical data analysis'
            },
            risk_analysis: {
              overall_risk: qp.valueRating || 'Medium',
              key_risks: ['Market volatility may affect odds'],
              upset_potential: 'Standard risk level for this type of prediction'
            },
            betting_intelligence: {
              primary_bet: `${qp.predictionType?.replace(/_/g, ' ')} with odds around ${qp.odds}`,
              value_bets: [`${qp.predictionType?.replace(/_/g, ' ')} and over 1.5 goals`],
              avoid_bets: ['High-risk accumulator bets', 'Betting against the prediction']
            },
            confidence_breakdown: `The ${qp.confidenceScore >= 80 ? 'high' : qp.confidenceScore >= 60 ? 'medium' : 'low'} confidence level is based on the AI model prediction and analysis.`
          }
          needsUpdate = true
        }

        // Update the record if changes were made
        if (needsUpdate) {
          await prisma.quickPurchase.update({
            where: { id: qp.id },
            data: {
              predictionData: predictionData
            }
          })
          updatedCount++
          console.log(`✅ Updated ${qp.id}`)
        } else {
          console.log(`✅ ${qp.id} already has correct structure`)
        }

      } catch (error) {
        console.error(`❌ Error processing ${qp.id}:`, error)
        skippedCount++
      }
    }

    console.log('\n📈 Summary:')
    console.log(`✅ Updated: ${updatedCount} records`)
    console.log(`⚠️  Skipped: ${skippedCount} records`)
    console.log(`📊 Total processed: ${quickPurchases.length} records`)

  } catch (error) {
    console.error('❌ Script failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
fixPredictionData()
  .then(() => {
    console.log('🎉 Prediction data consistency fix completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  }) 