import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const countryPricing = [
  { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KES', base: 80, original: 120 },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦', base: 250, original: 375 },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R', base: 20, original: 30 },
  { code: 'GH', name: 'Ghana', currency: 'GHS', symbol: 'GH₵', base: 5, original: 7.5 },
  { code: 'UG', name: 'Uganda', currency: 'UGX', symbol: 'UGX', base: 300, original: 450 },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', symbol: 'TSh', base: 200, original: 300 },
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$', base: 2.99, original: 4.99 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£', base: 2.50, original: 3.99 },
  { code: 'IT', name: 'Italy', currency: 'EUR', symbol: '€', base: 2.99, original: 4.99 },
  { code: 'BR', name: 'Brazil', currency: 'BRL', symbol: 'R$', base: 3.00, original: 4.50 },
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹', base: 80, original: 120 },
  { code: 'DE', name: 'Germany', currency: 'EUR', symbol: '€', base: 2.99, original: 4.99 },
  { code: 'PH', name: 'Philippines', currency: 'PHP', symbol: '₱', base: 50, original: 75 },
  { code: 'TR', name: 'Turkey', currency: 'TRY', symbol: '₺', base: 10, original: 15 },
  { code: 'ES', name: 'Spain', currency: 'EUR', symbol: '€', base: 2.99, original: 4.99 }
]

async function seedPricing() {
  try {
    console.log('🌱 Starting pricing seed...')

    // Get all countries from the database
    const countries = await prisma.country.findMany({
      select: { id: true, code: true, name: true }
    })

    console.log(`Found ${countries.length} countries in database`)

    let createdCount = 0
    let updatedCount = 0

    for (const pricing of countryPricing) {
      // Find the country in the database
      const country = countries.find(c => c.code === pricing.code)
      
      if (!country) {
        console.log(`⚠️  Country ${pricing.code} (${pricing.name}) not found in database, skipping...`)
        continue
      }

      // Check if pricing already exists for this country and package type
      const existingPricing = await prisma.packageCountryPrice.findUnique({
        where: {
          countryId_packageType: {
            countryId: country.id,
            packageType: 'prediction'
          }
        }
      })

      if (existingPricing) {
        // Update existing pricing
        await prisma.packageCountryPrice.update({
          where: { id: existingPricing.id },
          data: {
            price: pricing.base,
            originalPrice: pricing.original
          }
        })
        updatedCount++
        console.log(`✅ Updated pricing for ${pricing.name} (${pricing.code}): ${pricing.symbol}${pricing.base}`)
      } else {
        // Create new pricing
        await prisma.packageCountryPrice.create({
          data: {
            countryId: country.id,
            packageType: 'prediction',
            price: pricing.base,
            originalPrice: pricing.original
          }
        })
        createdCount++
        console.log(`✅ Created pricing for ${pricing.name} (${pricing.code}): ${pricing.symbol}${pricing.base}`)
      }
    }

    console.log(`\n🎉 Pricing seed completed!`)
    console.log(`📊 Created: ${createdCount} pricing configurations`)
    console.log(`📊 Updated: ${updatedCount} pricing configurations`)
    console.log(`📊 Total: ${createdCount + updatedCount} pricing configurations`)

    // Display summary of all pricing configurations
    console.log('\n📋 Current Pricing Summary:')
    const allPricing = await prisma.packageCountryPrice.findMany({
      include: {
        country: {
          select: { name: true, code: true, currencySymbol: true }
        }
      },
      orderBy: { country: { name: 'asc' } }
    })

    allPricing.forEach(pricing => {
      console.log(`  ${pricing.country.name} (${pricing.country.code}): ${pricing.country.currencySymbol}${pricing.price} / ${pricing.country.currencySymbol}${pricing.originalPrice}`)
    })

  } catch (error) {
    console.error('❌ Error seeding pricing:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seed function
seedPricing()
  .then(() => {
    console.log('✅ Pricing seed completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Pricing seed failed:', error)
    process.exit(1)
  }) 