#!/usr/bin/env node

/**
 * Test Email Sending Script
 * 
 * This script tests email sending to diagnose the issue
 */

const { EmailService } = require('./lib/email-service')

async function testEmailSending() {
  console.log('📧 Testing Email Sending...\n')
  
  try {
    // Test payment confirmation email
    console.log('1. Testing Payment Confirmation Email...')
    const paymentResult = await EmailService.sendPaymentConfirmation({
      userName: 'kim.njo@gmail.com', // Your email
      packageName: 'Weekend Package',
      amount: 19.99,
      currencySymbol: '$',
      transactionId: 'test_txn_' + Date.now(),
      tipsCount: 5
    })
    
    console.log('Payment confirmation result:', paymentResult)
    
    // Test welcome email
    console.log('\n2. Testing Welcome Email...')
    const welcomeResult = await EmailService.sendWelcomeEmail({
      to: 'kim.njo@gmail.com',
      userName: 'obadiah kimani njoroge',
      appUrl: 'https://snapbet.com',
      supportEmail: 'support@snapbet.com'
    })
    
    console.log('Welcome email result:', welcomeResult)
    
  } catch (error) {
    console.error('❌ Error testing email sending:', error)
  }
}

// Run the test
testEmailSending()
  .then(() => {
    console.log('\n✅ Email testing completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Email testing failed:', error)
    process.exit(1)
  }) 