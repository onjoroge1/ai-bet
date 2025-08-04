#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')
const { NotificationService } = require('../lib/notification-service')
const prisma = new PrismaClient()

async function testNewEmailTemplates() {
  console.log('🧪 Testing New Email Templates...\n')

  try {
    // Test 1: Tip Purchase Confirmation
    console.log('1️⃣ Testing Tip Purchase Confirmation Email...')
    
    // Get a test user
    const testUser = await prisma.user.findFirst({
      where: { email: { not: null } },
      select: { id: true, email: true, fullName: true }
    })

    if (!testUser) {
      console.log('❌ No test user found with email')
      return
    }

    console.log(`Using test user: ${testUser.email}`)

    // Test tip purchase notification
    await NotificationService.createTipPurchaseNotification(
      testUser.id,
      4.99, // amount
      'Premium Tip - Manchester United vs Liverpool', // tipName
      'Manchester United vs Liverpool - Premier League', // matchDetails
      'Manchester United to win', // prediction
      85, // confidence
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // expiresAt
      'txn_test_123456789', // transactionId
      '$' // currencySymbol
    )
    console.log('✅ Tip purchase notification sent')

    // Test 2: Credit Claim Confirmation
    console.log('\n2️⃣ Testing Credit Claim Confirmation Email...')
    await NotificationService.createCreditClaimNotification(
      testUser.id,
      'Premium Tip - Arsenal vs Chelsea', // tipName
      'Arsenal vs Chelsea - Premier League', // matchDetails
      'Arsenal to win', // prediction
      90, // confidence
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // expiresAt
      1, // creditsUsed
      5 // creditsRemaining
    )
    console.log('✅ Credit claim notification sent')

    console.log('\n🎉 All email template tests completed!')
    console.log('\n📧 Check your email inbox for the test emails')
    console.log('\n💡 Next steps:')
    console.log('   1. Verify emails were received')
    console.log('   2. Check email content and formatting')
    console.log('   3. Test with real purchases/claims')

  } catch (error) {
    console.error('❌ Error testing email templates:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testNewEmailTemplates() 