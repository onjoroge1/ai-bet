import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create countries
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

  // Seed PackageCountryPrice table
  const packagePrices = [
    // Kenya
    { countryCode: 'ke', packageType: 'tip', price: 62.4 },
    { countryCode: 'ke', packageType: 'weekend_pass', price: 156 },
    { countryCode: 'ke', packageType: 'weekly_pass', price: 390 },
    { countryCode: 'ke', packageType: 'special_game', price: 93.6 },
    { countryCode: 'ke', packageType: 'monthly_sub', price: 936 },
    // Nigeria
    { countryCode: 'ng', packageType: 'tip', price: 750 },
    { countryCode: 'ng', packageType: 'weekend_pass', price: 2250 },
    { countryCode: 'ng', packageType: 'weekly_pass', price: 4500 },
    { countryCode: 'ng', packageType: 'special_game', price: 1125 },
    { countryCode: 'ng', packageType: 'monthly_sub', price: 12000 },
    // Uganda
    { countryCode: 'ug', packageType: 'tip', price: 1155 },
    { countryCode: 'ug', packageType: 'weekend_pass', price: 2887.5 },
    { countryCode: 'ug', packageType: 'weekly_pass', price: 7700 },
    { countryCode: 'ug', packageType: 'special_game', price: 1925 },
    { countryCode: 'ug', packageType: 'monthly_sub', price: 19250 },
    // South Africa
    { countryCode: 'za', packageType: 'tip', price: 13.5 },
    { countryCode: 'za', packageType: 'weekend_pass', price: 36 },
    { countryCode: 'za', packageType: 'weekly_pass', price: 72 },
    { countryCode: 'za', packageType: 'special_game', price: 18 },
    { countryCode: 'za', packageType: 'monthly_sub', price: 180 },
    // India
    { countryCode: 'in', packageType: 'tip', price: 33.2 },
    { countryCode: 'in', packageType: 'weekend_pass', price: 83 },
    { countryCode: 'in', packageType: 'weekly_pass', price: 207.5 },
    { countryCode: 'in', packageType: 'special_game', price: 49.8 },
    { countryCode: 'in', packageType: 'monthly_sub', price: 498 },
    // USA
    { countryCode: 'us', packageType: 'tip', price: 1.99 },
    { countryCode: 'us', packageType: 'weekend_pass', price: 4.99 },
    { countryCode: 'us', packageType: 'weekly_pass', price: 9.99 },
    { countryCode: 'us', packageType: 'special_game', price: 2.5 },
    { countryCode: 'us', packageType: 'monthly_sub', price: 20 },
  ]

  for (const pkg of packagePrices) {
    const country = await prisma.country.findUnique({ where: { code: pkg.countryCode } })
    if (!country) continue
    await prisma.packageCountryPrice.upsert({
      where: { countryId_packageType: { countryId: country.id, packageType: pkg.packageType } },
      update: { price: pkg.price },
      create: { countryId: country.id, packageType: pkg.packageType, price: pkg.price },
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