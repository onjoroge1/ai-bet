import { PrismaClient } from '@prisma/client'

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
        packageType: "weekend",
        description: "Weekend special with 10 tips (Friday-Sunday)",
        tipCount: 10,
        validityDays: 3,
        features: [
          "10 Premium Tips",
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
        packageType: "weekly",
        description: "Full week coverage with 15 premium tips",
        tipCount: 15,
        validityDays: 7,
        features: [
          "15 Premium Tips",
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
        packageType: "monthly",
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

    // Pricing structure for different countries
    const pricingStructure = {
      // Kenya (KES)
      ke: {
        daily: { price: 250, originalPrice: 350 },
        weekend: { price: 500, originalPrice: 700 },
        weekly: { price: 1000, originalPrice: 1200 },
        monthly: { price: 2500, originalPrice: 3500 }
      },
      // Nigeria (NGN)
      ng: {
        daily: { price: 1500, originalPrice: 2000 },
        weekend: { price: 3000, originalPrice: 4000 },
        weekly: { price: 6000, originalPrice: 8000 },
        monthly: { price: 15000, originalPrice: 20000 }
      },
      // South Africa (ZAR)
      za: {
        daily: { price: 25, originalPrice: 35 },
        weekend: { price: 50, originalPrice: 70 },
        weekly: { price: 100, originalPrice: 120 },
        monthly: { price: 250, originalPrice: 350 }
      },
      // Ghana (GHS)
      gh: {
        daily: { price: 15, originalPrice: 20 },
        weekend: { price: 30, originalPrice: 40 },
        weekly: { price: 60, originalPrice: 80 },
        monthly: { price: 150, originalPrice: 200 }
      },
      // Uganda (UGX)
      ug: {
        daily: { price: 5000, originalPrice: 7000 },
        weekend: { price: 10000, originalPrice: 14000 },
        weekly: { price: 20000, originalPrice: 24000 },
        monthly: { price: 50000, originalPrice: 70000 }
      },
      // Tanzania (TZS)
      tz: {
        daily: { price: 3500, originalPrice: 5000 },
        weekend: { price: 7000, originalPrice: 10000 },
        weekly: { price: 14000, originalPrice: 17000 },
        monthly: { price: 35000, originalPrice: 50000 }
      },
      // United States (USD)
      us: {
        daily: { price: 2.99, originalPrice: 4.99 },
        weekend: { price: 5.99, originalPrice: 8.99 },
        weekly: { price: 11.99, originalPrice: 14.99 },
        monthly: { price: 29.99, originalPrice: 39.99 }
      },
      // Italy (EUR)
      it: {
        daily: { price: 2.99, originalPrice: 4.99 },
        weekend: { price: 5.99, originalPrice: 8.99 },
        weekly: { price: 11.99, originalPrice: 14.99 },
        monthly: { price: 29.99, originalPrice: 39.99 }
      }
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

      // Create country-specific pricing
      for (const country of countries) {
        const countryCode = country.code.toLowerCase()
        const pricing = pricingStructure[countryCode as keyof typeof pricingStructure]
        
        if (pricing && country.currencyCode && country.currencySymbol) {
          const packagePricing = pricing[offer.packageType as keyof typeof pricing]
          
          if (packagePricing) {
            await prisma.packageOfferCountryPrice.create({
              data: {
                packageOfferId: createdOffer.id,
                countryId: country.id,
                price: packagePricing.price,
                originalPrice: packagePricing.originalPrice,
                currencyCode: country.currencyCode,
                currencySymbol: country.currencySymbol,
                isActive: true
              }
            })
            
            console.log(`  - ${country.name}: ${country.currencySymbol}${packagePricing.price}`)
          }
        }
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