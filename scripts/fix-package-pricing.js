#!/usr/bin/env node

/**
 * Fix Script: Package Pricing Issue
 * 
 * This script fixes the package pricing issue by ensuring all
 * PackageCountryPrice records have the isActive field set to true.
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixPackagePricing() {
  console.log('🔧 Fixing Package Pricing Issue...\n')
  
  try {
    // Check current PackageCountryPrice records
    console.log('1. Checking current PackageCountryPrice records:')
    const allPrices = await prisma.packageCountryPrice.findMany({
      include: {
        country: {
          select: {
            name: true,
            code: true
          }
        }
      }
    })
    
    console.log(`Found ${allPrices.length} price records:`)
    
    let inactiveCount = 0
    let nullActiveCount = 0
    
    allPrices.forEach(price => {
      const status = price.isActive === null ? 'NULL' : (price.isActive ? 'ACTIVE' : 'INACTIVE')
      if (price.isActive === false) inactiveCount++
      if (price.isActive === null) nullActiveCount++
      
      console.log(`  - ${price.country.name} (${price.country.code}): ${price.packageType} - ${price.currencySymbol}${price.price} [${status}]`)
    })
    
    console.log(`\nSummary:`)
    console.log(`  - Total records: ${allPrices.length}`)
    console.log(`  - Inactive records: ${inactiveCount}`)
    console.log(`  - NULL isActive records: ${nullActiveCount}`)
    
    // Fix records with NULL isActive
    if (nullActiveCount > 0) {
      console.log(`\n2. Fixing ${nullActiveCount} records with NULL isActive...`)
      
      const updatedPrices = await prisma.packageCountryPrice.updateMany({
        where: {
          isActive: null
        },
        data: {
          isActive: true
        }
      })
      
      console.log(`✅ Updated ${updatedPrices.count} records`)
    }
    
    // Fix inactive records (optional - uncomment if you want to activate all)
    if (inactiveCount > 0) {
      console.log(`\n3. Found ${inactiveCount} inactive records`)
      console.log(`   (Skipping activation - uncomment in script if needed)`)
      
      // Uncomment the following if you want to activate all records:
      /*
      const activatedPrices = await prisma.packageCountryPrice.updateMany({
        where: {
          isActive: false
        },
        data: {
          isActive: true
        }
      })
      
      console.log(`✅ Activated ${activatedPrices.count} records`)
      */
    }
    
    // Verify the fix
    console.log('\n4. Verifying the fix:')
    const testPrice = await prisma.packageCountryPrice.findFirst({
      where: {
        countryId: 'cmcryayjw0007vb8kbrn9vyh1',
        packageType: 'weekend_pass'
      },
      include: {
        country: {
          select: {
            name: true,
            code: true
          }
        }
      }
    })
    
    if (testPrice) {
      console.log(`✅ Test price found:`)
      console.log(`   - Country: ${testPrice.country.name} (${testPrice.country.code})`)
      console.log(`   - Package: ${testPrice.packageType}`)
      console.log(`   - Price: ${testPrice.currencySymbol}${testPrice.price}`)
      console.log(`   - Is Active: ${testPrice.isActive}`)
      
      if (testPrice.isActive === true) {
        console.log(`   - ✅ Status: ACTIVE - Payment should work now!`)
      } else {
        console.log(`   - ❌ Status: ${testPrice.isActive} - Still needs fixing`)
      }
    } else {
      console.log(`❌ Test price not found`)
    }
    
    console.log('\n🎉 Package pricing fix completed!')
    
  } catch (error) {
    console.error('❌ Fix failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixPackagePricing()
  .then(() => {
    console.log('\n✅ Fix script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Fix script failed:', error)
    process.exit(1)
  }) 