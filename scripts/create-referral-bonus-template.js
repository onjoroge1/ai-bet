#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function createReferralBonusTemplate() {
  console.log('📧 Creating Referral Bonus Email Template...\n')

  try {
    await prisma.emailTemplate.create({
      data: {
        name: 'Referral Bonus',
        slug: 'referral-bonus',
        subject: '👥 Referral Bonus Earned! {{referredUserName}} joined SnapBet',
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
    console.log('✅ Referral Bonus template created successfully!')

  } catch (error) {
    console.error('❌ Error creating referral bonus template:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createReferralBonusTemplate() 