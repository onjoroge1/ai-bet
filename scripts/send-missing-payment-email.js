#!/usr/bin/env node

/**
 * Send Missing Payment Email Script
 * 
 * This script manually sends a payment confirmation email for recent purchases
 */

const { PrismaClient } = require('@prisma/client')
const { EmailService } = require('../lib/email-service')

const prisma = new PrismaClient()

async function sendMissingPaymentEmail() {
  console.log('📧 Sending Missing Payment Email...\n')
  
  try {
    // Get the most recent package purchase
    const recentPurchase = await prisma.packagePurchase.findFirst({
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
    
    if (!recentPurchase) {
      console.log('❌ No recent package purchases found')
      return
    }
    
    if (!recentPurchase.user?.email) {
      console.log('❌ No user email found for recent purchase')
      return
    }
    
    console.log(`📦 Found recent purchase:`)
    console.log(`   - User: ${recentPurchase.user.fullName} (${recentPurchase.user.email})`)
    console.log(`   - Amount: $${recentPurchase.amount}`)
    console.log(`   - Created: ${recentPurchase.createdAt}`)
    
    // Send payment confirmation email
    console.log('\n📧 Sending payment confirmation email...')
    const emailResult = await EmailService.sendPaymentConfirmation({
      userName: recentPurchase.user.email,
      packageName: 'Premium Package',
      amount: parseFloat(recentPurchase.amount),
      currencySymbol: '$',
      transactionId: `TXN-${Date.now()}`,
      tipsCount: 5
    })
    
    console.log('✅ Email result:', emailResult)
    
    if (emailResult.success) {
      console.log('🎉 Payment confirmation email sent successfully!')
      console.log(`   - Message ID: ${emailResult.messageId}`)
      console.log(`   - Sent to: ${recentPurchase.user.email}`)
    } else {
      console.log('❌ Failed to send email:', emailResult.error)
    }
    
  } catch (error) {
    console.error('❌ Error sending payment email:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
sendMissingPaymentEmail()
  .then(() => {
    console.log('\n✅ Missing payment email script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Missing payment email script failed:', error)
    process.exit(1)
  }) 