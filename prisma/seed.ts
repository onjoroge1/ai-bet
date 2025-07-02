import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create countries with base pricing
  const countries = [
    {
      code: 'ke',
      name: 'Kenya',
      flagEmoji: '🇰🇪',
      currencyCode: 'KES',
      currencySymbol: 'KES',
      brandName: "Kenya's #1 AI Betting Platform",
      tagline: 'Win Big with AI-Powered Predictions',
      marketContext: "Kenya's vibrant sports betting market"
    },
    {
      code: 'ng',
      name: 'Nigeria',
      flagEmoji: '🇳🇬',
      currencyCode: 'NGN',
      currencySymbol: '₦',
      brandName: "Nigeria's Leading AI Betting Platform",
      tagline: 'Win More with AI-Powered Tips',
      marketContext: "Nigeria's competitive sports betting market"
    },
    {
      code: 'za',
      name: 'South Africa',
      flagEmoji: '🇿🇦',
      currencyCode: 'ZAR',
      currencySymbol: 'R',
      brandName: "South Africa's Leading AI Betting Platform",
      tagline: 'Expert Predictions for South African Sports',
      marketContext: "South Africa's competitive sports betting market"
    },
    {
      code: 'gh',
      name: 'Ghana',
      flagEmoji: '🇬🇭',
      currencyCode: 'GHS',
      currencySymbol: 'GH₵',
      brandName: "Ghana's Top AI Betting Platform",
      tagline: 'Win Big with AI-Powered Predictions',
      marketContext: "Ghana's vibrant sports betting market"
    },
    {
      code: 'ug',
      name: 'Uganda',
      flagEmoji: '🇺🇬',
      currencyCode: 'UGX',
      currencySymbol: 'UGX',
      brandName: "Uganda's Premier AI Betting Platform",
      tagline: 'Smart Predictions for Ugandan Sports',
      marketContext: "Uganda's growing sports betting market"
    },
    {
      code: 'tz',
      name: 'Tanzania',
      flagEmoji: '🇹🇿',
      currencyCode: 'TZS',
      currencySymbol: 'TSh',
      brandName: "Tanzania's Premier AI Betting Platform",
      tagline: 'Smart Predictions for Tanzanian Sports',
      marketContext: "Tanzania's growing sports betting market"
    },
    {
      code: 'gb',
      name: 'United Kingdom',
      flagEmoji: '🇬🇧',
      currencyCode: 'GBP',
      currencySymbol: '£',
      brandName: "UK's Smartest AI Betting Platform",
      tagline: 'Data-Driven Predictions for UK Sports',
      marketContext: "UK's regulated sports betting market"
    },
    {
      code: 'us',
      name: 'United States',
      flagEmoji: '🇺🇸',
      currencyCode: 'USD',
      currencySymbol: '$',
      brandName: "America's Premier AI Betting Platform",
      tagline: 'AI-Powered Sports Predictions',
      marketContext: 'US sports betting market'
    },
    {
      code: 'br',
      name: 'Brazil',
      flagEmoji: '🇧🇷',
      currencyCode: 'BRL',
      currencySymbol: 'R$',
      brandName: "Brazil's Premier AI Betting Platform",
      tagline: 'Smart Predictions for Brazilian Sports',
      marketContext: "Brazil's dynamic sports betting market"
    },
    {
      code: 'in',
      name: 'India',
      flagEmoji: '🇮🇳',
      currencyCode: 'INR',
      currencySymbol: '₹',
      brandName: "India's Premier AI Betting Platform",
      tagline: 'Smart Predictions for Indian Sports',
      marketContext: "India's growing sports betting market"
    },
    {
      code: 'de',
      name: 'Germany',
      flagEmoji: '🇩🇪',
      currencyCode: 'EUR',
      currencySymbol: '€',
      brandName: "Germany's Premier AI Betting Platform",
      tagline: 'Smart Predictions for German Sports',
      marketContext: "Germany's regulated sports betting market"
    },
    {
      code: 'ph',
      name: 'Philippines',
      flagEmoji: '🇵🇭',
      currencyCode: 'PHP',
      currencySymbol: '₱',
      brandName: "Philippines' Top AI Betting Platform",
      tagline: 'Expert Predictions for Filipino Sports',
      marketContext: "Philippines' dynamic sports betting market"
    },
    {
      code: 'tr',
      name: 'Turkey',
      flagEmoji: '🇹🇷',
      currencyCode: 'TRY',
      currencySymbol: '₺',
      brandName: "Turkey's Premier AI Betting Platform",
      tagline: 'Smart Predictions for Turkish Sports',
      marketContext: "Turkey's growing sports betting market"
    },
    {
      code: 'it',
      name: 'Italy',
      flagEmoji: '🇮🇹',
      currencyCode: 'EUR',
      currencySymbol: '€',
      brandName: "Italy's Premier AI Betting Platform",
      tagline: 'Smart Predictions for Italian Sports',
      marketContext: "Italy's regulated sports betting market"
    },
    {
      code: 'es',
      name: 'Spain',
      flagEmoji: '🇪🇸',
      currencyCode: 'EUR',
      currencySymbol: '€',
      brandName: "Spain's Premier AI Betting Platform",
      tagline: 'Smart Predictions for Spanish Sports',
      marketContext: "Spain's regulated sports betting market"
    }
  ]

  for (const country of countries) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: country,
      create: country
    })
  }

  // Get US country ID
  const usCountry = await prisma.country.findUnique({
    where: { code: 'us' }
  })

  if (!usCountry) {
    throw new Error('US country not found')
  }

  // Create a test user
  const hashedPassword = await hash('password123', 12)
  await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: hashedPassword,
      fullName: 'Test User',
      role: 'user',
      countryId: usCountry.id
    }
  })

  // Seed PackageCountryPrice table with base price + discount structure
  const basePrices = {
    'ke': 80,    // Kenya - KES
    'ng': 250,   // Nigeria - NGN
    'za': 20,    // South Africa - ZAR
    'gh': 5,     // Ghana - GHS
    'ug': 300,   // Uganda - UGX
    'tz': 200,   // Tanzania - TZS
    'gb': 0.80,  // UK - GBP
    'us': 1.00,  // US - USD
    'br': 3.00,  // Brazil - BRL
    'in': 80,    // India - INR
    'de': 1.00,  // Germany - EUR
    'ph': 50,    // Philippines - PHP
    'tr': 10,    // Turkey - TRY
    'it': 1.00,  // Italy - EUR
    'es': 1.00   // Spain - EUR
  }

  // Corrected package structure
  const discounts: Record<string, number> = {
    'prediction': 0,      // Single tip - no discount
    'tip': 0,             // Single tip - no discount (alias)
    'weekend_pass': 0.10, // Weekend package - 10% discount
    'weekly_pass': 0.15,  // Weekly package - 15% discount
    'monthly_sub': 0.30   // Monthly subscription - 30% discount
  }

  // Corrected number of tips per package
  const packageTipCounts: Record<string, number> = {
    'prediction': 1,      // Single tip
    'tip': 1,             // Single tip (alias)
    'weekend_pass': 5,    // 5 tips for weekend
    'weekly_pass': 8,     // 8 tips for week
    'monthly_sub': 30     // 30 tips for month
  }

  // Generate pricing for all countries and package types
  const packagePrices = []
  
  for (const [countryCode, basePrice] of Object.entries(basePrices)) {
    for (const [packageType, discount] of Object.entries(discounts)) {
      const tipCount = packageTipCounts[packageType]
      const originalPrice = basePrice * tipCount
      const discountedPrice = originalPrice * (1 - discount)
      
      packagePrices.push({
        countryCode,
        packageType,
        price: discountedPrice,
        originalPrice: originalPrice
      })
    }
  }

  for (const pkg of packagePrices) {
    const country = await prisma.country.findUnique({ where: { code: pkg.countryCode } })
    if (!country) {
      console.warn(`Country not found: ${pkg.countryCode}`)
      continue
    }
    
    await prisma.packageCountryPrice.upsert({
      where: { countryId_packageType: { countryId: country.id, packageType: pkg.packageType } },
      update: { 
        price: pkg.price,
        originalPrice: pkg.originalPrice
      },
      create: { 
        countryId: country.id, 
        packageType: pkg.packageType, 
        price: pkg.price,
        originalPrice: pkg.originalPrice
      },
    })
  }

  console.log('Database has been seeded. 🌱')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 