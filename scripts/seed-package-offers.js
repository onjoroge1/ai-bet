const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seedPackageOffers() {
  try {
    console.log('🌱 Seeding package offers...')

    // Get all countries
    const countries = await prisma.country.findMany({
      where: { isActive: true }
    })

    console.log(`Found ${countries.length} countries`)

    // Define package offers
    const packageOffers = [
      {
        name: "Daily Package",
        packageType: "daily",
        description: "Get 5 premium tips for today's matches",
        tipCount: 5,
        validityDays: 1,
        features: [
          "5 Premium Tips",
          "Daily Analysis",
          "Email Notifications",
          "Mobile Access",
          "24-Hour Validity"
        ],
        iconName: "Zap",
        colorGradientFrom: "#3B82F6",
        colorGradientTo: "#1D4ED8",
        displayOrder: 1
      },
      {
        name: "Weekend Package",
        packageType: "weekend_pass",
        description: "Weekend special with 5 tips (Friday-Sunday)",
        tipCount: 5,
        validityDays: 3,
        features: [
          "5 Premium Tips",
          "Weekend Coverage",
          "Live Updates",
          "Priority Support",
          "3-Day Validity"
        ],
        iconName: "Calendar",
        colorGradientFrom: "#8B5CF6",
        colorGradientTo: "#7C3AED",
        displayOrder: 2
      },
      {
        name: "Weekly Package",
        packageType: "weekly_pass",
        description: "Full week coverage with 8 premium tips",
        tipCount: 8,
        validityDays: 7,
        features: [
          "8 Premium Tips",
          "Weekly Analysis",
          "Trend Reports",
          "VIP Chat Access",
          "7-Day Validity"
        ],
        iconName: "TrendingUp",
        colorGradientFrom: "#10B981",
        colorGradientTo: "#059669",
        displayOrder: 3
      },
      {
        name: "Monthly Subscription",
        packageType: "monthly_sub",
        description: "VIP Zone - Unlimited tips for the entire month",
        tipCount: -1, // -1 indicates unlimited
        validityDays: 30,
        features: [
          "Unlimited Tips",
          "VIP Zone Access",
          "Priority Support",
          "Advanced Analytics",
          "30-Day Validity",
          "Exclusive Content"
        ],
        iconName: "Crown",
        colorGradientFrom: "#F59E0B",
        colorGradientTo: "#D97706",
        displayOrder: 4
      }
    ]

    // Define base prices for each country (same as main seed)
    const basePrices = {
      ke: 80, ng: 250, za: 20, gh: 5, ug: 300, tz: 200, gb: 0.80, us: 1.00, br: 3.00, in: 80, de: 1.00, ph: 50, tr: 10, it: 1.00, es: 1.00
    }

    // Map offer packageType to tip count and discount
    const offerMeta = {
      daily: { tipCount: 1, discount: 0 }, // single tip
      weekend_pass: { tipCount: 5, discount: 0.10 },
      weekly_pass: { tipCount: 8, discount: 0.15 },
      monthly_sub: { tipCount: 30, discount: 0.30 }
    }

    // Create package offers
    for (const offer of packageOffers) {
      console.log(`Creating ${offer.name}...`)
      
      const createdOffer = await prisma.packageOffer.create({
        data: {
          name: offer.name,
          packageType: offer.packageType,
          description: offer.description,
          tipCount: offer.tipCount,
          validityDays: offer.validityDays,
          features: offer.features,
          iconName: offer.iconName,
          colorGradientFrom: offer.colorGradientFrom,
          colorGradientTo: offer.colorGradientTo,
          displayOrder: offer.displayOrder,
          isActive: true
        }
      })

      for (const country of countries) {
        const countryCode = country.code.toLowerCase()
        const base = basePrices[countryCode] ?? 1 // fallback to $1
        const meta = offerMeta[offer.packageType]
        if (!meta) continue
        const originalPrice = base * meta.tipCount
        const price = originalPrice * (1 - meta.discount)
        await prisma.packageOfferCountryPrice.create({
          data: {
            packageOfferId: createdOffer.id,
            countryId: country.id,
            price,
            originalPrice,
            currencyCode: country.currencyCode || 'USD',
            currencySymbol: country.currencySymbol || '$',
            isActive: true
          }
        })
        console.log(`  - ${country.name}: ${country.currencySymbol}${price}`)
      }
    }

    console.log('✅ Package offers seeded successfully!')
  } catch (error) {
    console.error('❌ Error seeding package offers:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedPackageOffers() 