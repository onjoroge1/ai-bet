import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking QuickPurchase data...')

  // Get all countries
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      currencyCode: true,
      currencySymbol: true
    }
  })

  console.log(`📊 Found ${countries.length} active countries`)

  // Get all QuickPurchases with all fields
  const quickPurchases = await prisma.quickPurchase.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      countryId: true,
      price: true,
      originalPrice: true,
      description: true,
      features: true,
      type: true,
      iconName: true,
      colorGradientFrom: true,
      colorGradientTo: true,
      isUrgent: true,
      timeLeft: true,
      isPopular: true,
      discountPercentage: true,
      isActive: true,
      displayOrder: true,
      targetLink: true,
      isPredictionActive: true,
      matchId: true,
      matchData: true,
      predictionData: true,
      predictionType: true,
      confidenceScore: true,
      odds: true,
      valueRating: true,
      analysisSummary: true
    }
  })

  console.log(`🎯 Found ${quickPurchases.length} active QuickPurchases`)

  // Group QuickPurchases by country
  const quickPurchasesByCountry = quickPurchases.reduce((acc, qp) => {
    if (!acc[qp.countryId]) {
      acc[qp.countryId] = []
    }
    acc[qp.countryId].push(qp)
    return acc
  }, {} as Record<string, typeof quickPurchases>)

  // Check which countries have match predictions (type: 'prediction')
  const countriesWithMatchPredictions = Object.entries(quickPurchasesByCountry)
    .filter(([_, predictions]) => predictions.some(p => p.type === 'prediction'))
    .map(([countryId]) => countryId)

  const countriesWithoutMatchPredictions = countries.filter(c => 
    !countriesWithMatchPredictions.includes(c.id)
  )

  console.log('\n📈 Countries WITH match predictions:')
  countriesWithMatchPredictions.forEach(countryId => {
    const country = countries.find(c => c.id === countryId)
    const predictions = quickPurchasesByCountry[countryId]
    const matchPredictions = predictions.filter(p => p.type === 'prediction')
    console.log(`  ${country?.name} (${country?.code}): ${matchPredictions.length} match predictions`)
  })

  console.log('\n❌ Countries WITHOUT match predictions:')
  countriesWithoutMatchPredictions.forEach(country => {
    console.log(`  ${country.name} (${country.code})`)
  })

  // Find the country with the most match predictions to use as template
  let templateCountryId = ''
  let maxMatchPredictions = 0

  Object.entries(quickPurchasesByCountry).forEach(([countryId, predictions]) => {
    const matchPredictions = predictions.filter(p => p.type === 'prediction')
    if (matchPredictions.length > maxMatchPredictions) {
      maxMatchPredictions = matchPredictions.length
      templateCountryId = countryId
    }
  })

  if (templateCountryId && countriesWithoutMatchPredictions.length > 0) {
    console.log(`\n🔄 Using ${countries.find(c => c.id === templateCountryId)?.name} as template...`)
    
    const templatePredictions = quickPurchasesByCountry[templateCountryId]
    const templateMatchPredictions = templatePredictions.filter(p => p.type === 'prediction')
    
    console.log(`📝 Found ${templateMatchPredictions.length} match predictions to copy`)
    
    // Create match predictions for countries without them
    for (const country of countriesWithoutMatchPredictions) {
      console.log(`\n📝 Creating match predictions for ${country.name}...`)
      
      for (const template of templateMatchPredictions) {
        try {
          // Create a copy of the template match prediction for the new country
          // Note: We set matchId to null to avoid unique constraint violation
          // since matchId is meant to be unique across all countries
          const newQuickPurchase = await prisma.quickPurchase.create({
            data: {
              name: template.name,
              price: template.price,
              originalPrice: template.originalPrice,
              description: template.description,
              features: template.features,
              type: template.type,
              iconName: template.iconName,
              colorGradientFrom: template.colorGradientFrom,
              colorGradientTo: template.colorGradientTo,
              isUrgent: template.isUrgent,
              timeLeft: template.timeLeft,
              isPopular: template.isPopular,
              discountPercentage: template.discountPercentage,
              isActive: template.isActive,
              displayOrder: template.displayOrder,
              targetLink: template.targetLink,
              countryId: country.id,
              matchId: null, // Set to null to avoid unique constraint violation
              matchData: template.matchData as any,
              predictionData: template.predictionData as any,
              predictionType: template.predictionType,
              confidenceScore: template.confidenceScore,
              odds: template.odds,
              valueRating: template.valueRating,
              analysisSummary: template.analysisSummary,
              isPredictionActive: template.isPredictionActive
            }
          })
          
          console.log(`  ✅ Created: ${newQuickPurchase.name}`)
        } catch (error) {
          console.error(`  ❌ Failed to create prediction for ${country.name}:`, error)
        }
      }
    }
  }

  console.log('\n🎉 QuickPurchase data check complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect()) 