#!/usr/bin/env node

/**
 * Check Webhook Processing Script
 * 
 * This script checks if webhook processing is working correctly
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkWebhookProcessing() {
  console.log('🔍 Checking Webhook Processing...\n')
  
  try {
    // Check recent package purchases and their metadata
    console.log('📦 Recent Package Purchases with Metadata:')
    const recentPurchases = await prisma.packagePurchase.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            fullName: true
          }
        }
      }
    })
    
    recentPurchases.forEach((purchase, index) => {
      console.log(`\n${index + 1}. Purchase:`)
      console.log(`   - ID: ${purchase.id}`)
      console.log(`   - User: ${purchase.user?.fullName || 'Unknown'} (${purchase.user?.email || 'No email'})`)
      console.log(`   - Amount: $${purchase.amount}`)
      console.log(`   - Status: ${purchase.status}`)
      console.log(`   - Created: ${purchase.createdAt}`)
      console.log(`   - Payment Intent ID: ${purchase.paymentIntentId || 'Not set'}`)
      console.log(`   - Package Offer Country Price ID: ${purchase.packageOfferCountryPriceId || 'Not set'}`)
    })
    
    // Check if there are any user packages created
    console.log('\n📋 Recent User Packages:')
    const userPackages = await prisma.userPackage.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            fullName: true
          }
        },
        packageOffer: true
      }
    })
    
    if (userPackages.length > 0) {
      userPackages.forEach((userPackage, index) => {
        console.log(`\n${index + 1}. User Package:`)
        console.log(`   - ID: ${userPackage.id}`)
        console.log(`   - User: ${userPackage.user?.fullName || 'Unknown'} (${userPackage.user?.email || 'No email'})`)
        console.log(`   - Package: ${userPackage.packageOffer?.name || 'Unknown'}`)
        console.log(`   - Tips Remaining: ${userPackage.tipsRemaining}`)
        console.log(`   - Status: ${userPackage.status}`)
        console.log(`   - Created: ${userPackage.createdAt}`)
      })
    } else {
      console.log('No UserPackage records found')
    }
    
    // Check for any recent notifications
    console.log('\n🔔 Recent Notifications:')
    const notifications = await prisma.userNotification.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: {
        type: 'payment'
      },
      include: {
        user: {
          select: {
            email: true,
            fullName: true
          }
        }
      }
    })
    
    if (notifications.length > 0) {
      notifications.forEach((notification, index) => {
        console.log(`\n${index + 1}. Notification:`)
        console.log(`   - ID: ${notification.id}`)
        console.log(`   - User: ${notification.user?.fullName || 'Unknown'} (${notification.user?.email || 'No email'})`)
        console.log(`   - Title: ${notification.title}`)
        console.log(`   - Type: ${notification.type}`)
        console.log(`   - Created: ${notification.createdAt}`)
      })
    } else {
      console.log('No payment notifications found')
    }
    
    // Check application logs for webhook processing
    console.log('\n📝 Webhook Processing Analysis:')
    console.log('   Based on the data above, here\'s what should happen:')
    console.log('   1. Payment succeeds → Webhook triggered')
    console.log('   2. UserPackage created → Package activated')
    console.log('   3. Notification created → In-app notification')
    console.log('   4. Email sent → Payment confirmation email')
    console.log('')
    console.log('   If notifications exist but emails don\'t, the issue is in the email sending logic.')
    console.log('   If no notifications exist, the webhook processing is failing.')
    
  } catch (error) {
    console.error('❌ Error checking webhook processing:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the check
checkWebhookProcessing()
  .then(() => {
    console.log('\n✅ Webhook processing check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Webhook processing check failed:', error)
    process.exit(1)
  }) 