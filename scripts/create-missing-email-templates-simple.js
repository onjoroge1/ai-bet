#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function createMissingEmailTemplates() {
  console.log('📧 Creating Missing Email Templates...\n')

  try {
    // 1. Password Reset Email
    console.log('1️⃣ Creating Password Reset Email...')
    await prisma.emailTemplate.create({
      data: {
        name: 'Password Reset',
        slug: 'password-reset',
        subject: 'Reset Your SnapBet Password',
        category: 'security',
        description: 'Sent when a user requests a password reset',
        isActive: true,
        version: 1,
        htmlContent: '<div>Password Reset Email Template</div>',
        textContent: 'Password Reset Email Template',
        variables: [
          { name: 'userName', type: 'string', description: 'User\'s display name', required: true, defaultValue: 'John Doe' },
          { name: 'resetUrl', type: 'string', description: 'Password reset URL', required: true, defaultValue: 'https://snapbet.com/reset' }
        ],
        createdBy: 'system'
      }
    })
    console.log('✅ Password Reset template created')

    // 2. Email Verification Email
    console.log('\n2️⃣ Creating Email Verification Email...')
    await prisma.emailTemplate.create({
      data: {
        name: 'Email Verification',
        slug: 'email-verification',
        subject: 'Verify Your SnapBet Email Address',
        category: 'security',
        description: 'Sent when users need to verify their email address',
        isActive: true,
        version: 1,
        htmlContent: '<div>Email Verification Template</div>',
        textContent: 'Email Verification Template',
        variables: [
          { name: 'userName', type: 'string', description: 'User\'s display name', required: true, defaultValue: 'John Doe' },
          { name: 'verificationUrl', type: 'string', description: 'Email verification URL', required: true, defaultValue: 'https://snapbet.com/verify' }
        ],
        createdBy: 'system'
      }
    })
    console.log('✅ Email Verification template created')

    // 3. High-Confidence Prediction Alert
    console.log('\n3️⃣ Creating High-Confidence Prediction Alert...')
    await prisma.emailTemplate.create({
      data: {
        name: 'High-Confidence Prediction Alert',
        slug: 'prediction-alert',
        subject: '⚽ High-Confidence Predictions Available',
        category: 'marketing',
        description: 'Sent when new high-confidence predictions are available',
        isActive: true,
        version: 1,
        htmlContent: '<div>Prediction Alert Template</div>',
        textContent: 'Prediction Alert Template',
        variables: [
          { name: 'userName', type: 'string', description: 'User\'s display name', required: true, defaultValue: 'John Doe' },
          { name: 'predictionCount', type: 'number', description: 'Number of predictions', required: true, defaultValue: 3 }
        ],
        createdBy: 'system'
      }
    })
    console.log('✅ High-Confidence Prediction Alert template created')

    // 4. Daily Digest Email
    console.log('\n4️⃣ Creating Daily Digest Email...')
    await prisma.emailTemplate.create({
      data: {
        name: 'Daily Digest',
        slug: 'daily-digest',
        subject: '📊 Your Daily SnapBet Digest',
        category: 'marketing',
        description: 'Daily summary of predictions, results, and notifications',
        isActive: true,
        version: 1,
        htmlContent: '<div>Daily Digest Template</div>',
        textContent: 'Daily Digest Template',
        variables: [
          { name: 'userName', type: 'string', description: 'User\'s display name', required: true, defaultValue: 'John Doe' },
          { name: 'newPredictions', type: 'number', description: 'Number of new predictions', required: true, defaultValue: 5 }
        ],
        createdBy: 'system'
      }
    })
    console.log('✅ Daily Digest template created')

    // 5. Achievement Notification
    console.log('\n5️⃣ Creating Achievement Notification...')
    await prisma.emailTemplate.create({
      data: {
        name: 'Achievement Notification',
        slug: 'achievement-notification',
        subject: '🏆 Achievement Unlocked',
        category: 'marketing',
        description: 'Sent when users unlock achievements',
        isActive: true,
        version: 1,
        htmlContent: '<div>Achievement Notification Template</div>',
        textContent: 'Achievement Notification Template',
        variables: [
          { name: 'userName', type: 'string', description: 'User\'s display name', required: true, defaultValue: 'John Doe' },
          { name: 'achievementName', type: 'string', description: 'Achievement name', required: true, defaultValue: 'First Win' }
        ],
        createdBy: 'system'
      }
    })
    console.log('✅ Achievement Notification template created')

    // 6. Referral Bonus Email
    console.log('\n6️⃣ Creating Referral Bonus Email...')
    await prisma.emailTemplate.create({
      data: {
        name: 'Referral Bonus',
        slug: 'referral-bonus',
        subject: '👥 Referral Bonus Earned!',
        category: 'marketing',
        description: 'Sent when users earn referral bonuses',
        isActive: true,
        version: 1,
        htmlContent: '<div>Referral Bonus Template</div>',
        textContent: 'Referral Bonus Template',
        variables: [
          { name: 'userName', type: 'string', description: 'User\'s display name', required: true, defaultValue: 'John Doe' },
          { name: 'referredUserName', type: 'string', description: 'Referred user name', required: true, defaultValue: 'Jane Smith' },
          { name: 'bonusAmount', type: 'number', description: 'Bonus amount', required: true, defaultValue: 10.00 }
        ],
        createdBy: 'system'
      }
    })
    console.log('✅ Referral Bonus template created')

    console.log('\n🎉 All missing email templates created successfully!')
    console.log('\n📋 Summary:')
    console.log('   • Password Reset (password-reset)')
    console.log('   • Email Verification (email-verification)')
    console.log('   • High-Confidence Prediction Alert (prediction-alert)')
    console.log('   • Daily Digest (daily-digest)')
    console.log('   • Achievement Notification (achievement-notification)')
    console.log('   • Referral Bonus (referral-bonus)')
    console.log('\n💡 Next steps:')
    console.log('   1. Visit /admin/email to review and customize the templates')
    console.log('   2. Update the test email endpoint to include these new types')
    console.log('   3. Test the email sending functionality')

  } catch (error) {
    console.error('❌ Error creating email templates:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createMissingEmailTemplates() 