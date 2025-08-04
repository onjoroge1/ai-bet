#!/usr/bin/env node

/**
 * Check Payment Webhooks Script
 * 
 * This script checks recent payment webhook events to see if emails were triggered
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkPaymentWebhooks() {
  console.log('💳 Checking Payment Webhook Events...\n')
  
  try {
    // Check recent package purchases
    console.log('📦 Recent Package Purchases:')
    const recentPurchases = await prisma.packagePurchase.findMany({
      take: 5,
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
    })
    
    // Check if there are any webhook logs or payment intent records
    console.log('\n🔍 Checking for Payment Intent Records...')
    const paymentIntents = await prisma.$queryRaw`
      SELECT 
        pi.id,
        pi.amount,
        pi.status,
        pi.created_at,
        pi.metadata
      FROM "PaymentIntent" pi
      ORDER BY pi.created_at DESC
      LIMIT 5
    `.catch(() => [])
    
    if (paymentIntents.length > 0) {
      console.log(`Found ${paymentIntents.length} payment intents:`)
      paymentIntents.forEach((pi, index) => {
        console.log(`\n${index + 1}. Payment Intent:`)
        console.log(`   - ID: ${pi.id}`)
        console.log(`   - Amount: $${(pi.amount / 100).toFixed(2)}`)
        console.log(`   - Status: ${pi.status}`)
        console.log(`   - Created: ${pi.created_at}`)
        console.log(`   - Metadata: ${JSON.stringify(pi.metadata)}`)
      })
    } else {
      console.log('No PaymentIntent records found (table might not exist)')
    }
    
    // Check for any error logs or failed webhook attempts
    console.log('\n⚠️  Checking for Recent Errors...')
    console.log('   (Check the application logs for webhook processing errors)')
    
    // Check if the webhook endpoint is being called
    console.log('\n🔗 Webhook Endpoint Status:')
    console.log('   - Endpoint: /api/payments/webhook')
    console.log('   - Should be called by Stripe when payment succeeds')
    console.log('   - Check Stripe dashboard for webhook delivery status')
    
  } catch (error) {
    console.error('❌ Error checking payment webhooks:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the check
checkPaymentWebhooks()
  .then(() => {
    console.log('\n✅ Payment webhook check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Payment webhook check failed:', error)
    process.exit(1)
  }) 