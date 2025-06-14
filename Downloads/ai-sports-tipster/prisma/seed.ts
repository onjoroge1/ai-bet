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