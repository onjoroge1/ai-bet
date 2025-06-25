import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Detailed QuickPurchase Analysis...')

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
      type: true,
      matchId: true,
      isPredictionActive: true,
      price: true,
      displayOrder: true
    },
    orderBy: [
      { countryId: 'asc' },
      { displayOrder: 'asc' }
    ]
  })

  console.log(`🎯 Found ${quickPurchases.length} active QuickPurchases`)

  // Group by country and show details
  const quickPurchasesByCountry = quickPurchases.reduce((acc, qp) => {
    if (!acc[qp.countryId]) {
      acc[qp.countryId] = []
    }
    acc[qp.countryId].push(qp)
    return acc
  }, {} as Record<string, typeof quickPurchases>)

  console.log('\n📈 Detailed breakdown by country:')
  console.log('=' .repeat(80))
  
  countries.forEach(country => {
    const predictions = quickPurchasesByCountry[country.id] || []
    const matchPredictions = predictions.filter(p => p.type === 'prediction')
    const tips = predictions.filter(p => p.type === 'tip')
    
    console.log(`\n🇺🇸 ${country.name} (${country.code}) - ${predictions.length} total`)
    console.log(`   Match Predictions: ${matchPredictions.length}`)
    console.log(`   Tips: ${tips.length}`)
    
    if (predictions.length > 0) {
      predictions.forEach(pred => {
        const typeIcon = pred.type === 'prediction' ? '⚽' : '💡'
        const matchInfo = pred.matchId ? ` (Match: ${pred.matchId})` : ''
        console.log(`   ${typeIcon} ${pred.name} - ${pred.type}${matchInfo}`)
      })
    } else {
      console.log('   ❌ No predictions found')
    }
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

  if (templateCountryId) {
    const templateCountry = countries.find(c => c.id === templateCountryId)
    const templatePredictions = quickPurchasesByCountry[templateCountryId]
    const templateMatchPredictions = templatePredictions.filter(p => p.type === 'prediction')
    
    console.log(`\n🔄 Template Country: ${templateCountry?.name} with ${templateMatchPredictions.length} match predictions`)
    
    // Show which countries are missing match predictions
    console.log('\n❌ Countries missing match predictions:')
    countries.forEach(country => {
      const predictions = quickPurchasesByCountry[country.id] || []
      const matchPredictions = predictions.filter(p => p.type === 'prediction')
      
      if (matchPredictions.length === 0) {
        console.log(`   ${country.name} (${country.code})`)
      }
    })
  }

  console.log('\n🎉 Analysis complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect()) 