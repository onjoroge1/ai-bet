#!/usr/bin/env node

/**
 * Debug Script: Package Pricing Issue
 * 
 * This script debugs the package pricing issue by checking the exact data
 * in the database and comparing it with what the payment system expects.
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function debugPackagePricing() {
  console.log('🔍 Debugging Package Pricing Issue...\n')
  
  try {
    // Test the exact scenario from the logs
    const testItemId = 'cmcryayjw0007vb8kbrn9vyh1_weekend_pass'
    console.log(`Test Item ID: ${testItemId}`)
    
    // Parse the item ID
    const firstUnderscoreIndex = testItemId.indexOf('_')
    if (firstUnderscoreIndex === -1) {
      console.log('❌ No underscore found in package ID')
      return
    }
    
    const countryId = testItemId.substring(0, firstUnderscoreIndex)
    const packageType = testItemId.substring(firstUnderscoreIndex + 1)
    
    console.log(`Parsed - Country ID: ${countryId}, Package Type: ${packageType}`)
    
    // Check if the country exists
    console.log('\n1. Checking Country:')
    const country = await prisma.country.findUnique({
      where: { id: countryId }
    })
    
    if (country) {
      console.log(`✅ Country found: ${country.name} (${country.code})`)
    } else {
      console.log(`❌ Country not found with ID: ${countryId}`)
    }
    
    // Check PackageCountryPrice records for this country
    console.log('\n2. Checking PackageCountryPrice records:')
    const countryPrices = await prisma.packageCountryPrice.findMany({
      where: { countryId },
      include: {
        country: {
          select: {
            name: true,
            code: true
          }
        }
      }
    })
    
    console.log(`Found ${countryPrices.length} price records for this country:`)
    countryPrices.forEach(price => {
      console.log(`  - ${price.packageType}: ${price.currencySymbol}${price.price}`)
    })
    
    // Check specific package type
    console.log(`\n3. Checking specific package type '${packageType}':`)
    const specificPrice = await prisma.packageCountryPrice.findFirst({
      where: {
        countryId,
        packageType
      },
      include: {
        country: {
          select: {
            name: true,
            code: true,
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })
    
    if (specificPrice) {
      console.log(`✅ Found price for ${packageType}: ${specificPrice.currencySymbol}${specificPrice.price}`)
      console.log(`   - Country: ${specificPrice.country.name} (${specificPrice.country.code})`)
      console.log(`   - Currency: ${specificPrice.country.currencyCode} (${specificPrice.country.currencySymbol})`)
      console.log(`   - Price: ${specificPrice.price}`)
      console.log(`   - Is Active: ${specificPrice.isActive}`)
    } else {
      console.log(`❌ No price found for ${packageType}`)
      
      // Check what package types are available
      console.log('\n4. Available package types for this country:')
      const availableTypes = await prisma.packageCountryPrice.findMany({
        where: { countryId },
        select: { packageType: true },
        distinct: ['packageType']
      })
      
      availableTypes.forEach(type => {
        console.log(`  - ${type.packageType}`)
      })
    }
    
    // Check PackageOffer records
    console.log('\n5. Checking PackageOffer records:')
    const packageOffers = await prisma.packageOffer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        packageType: true,
        tipCount: true
      }
    })
    
    console.log(`Found ${packageOffers.length} active package offers:`)
    packageOffers.forEach(offer => {
      console.log(`  - ${offer.packageType}: ${offer.name} (${offer.tipCount} tips)`)
    })
    
    // Check if there's a PackageOffer with the specific packageType
    const matchingOffer = packageOffers.find(offer => offer.packageType === packageType)
    if (matchingOffer) {
      console.log(`✅ Found PackageOffer for ${packageType}: ${matchingOffer.name}`)
    } else {
      console.log(`❌ No PackageOffer found for ${packageType}`)
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the debug
debugPackagePricing()
  .then(() => {
    console.log('\n✅ Debug completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Debug failed:', error)
    process.exit(1)
  }) 