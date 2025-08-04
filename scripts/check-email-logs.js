#!/usr/bin/env node

/**
 * Check Email Logs Script
 * 
 * This script checks email logs to diagnose email delivery issues
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkEmailLogs() {
  console.log('📧 Checking Email Logs...\n')
  
  try {
    // Check if EmailLog table exists
    const logs = await prisma.emailLog.findMany({
      take: 10,
      orderBy: { sentAt: 'desc' }
    })
    
    console.log(`Found ${logs.length} recent email logs:`)
    
    if (logs.length === 0) {
      console.log('❌ No email logs found - this suggests emails are not being sent or logged')
    } else {
      logs.forEach((log, index) => {
        console.log(`\n${index + 1}. Email Log:`)
        console.log(`   - ID: ${log.id}`)
        console.log(`   - Template: ${log.templateId}`)
        console.log(`   - Recipient: ${log.recipient}`)
        console.log(`   - Subject: ${log.subject}`)
        console.log(`   - Status: ${log.status}`)
        console.log(`   - Sent At: ${log.sentAt}`)
        if (log.errorMessage) {
          console.log(`   - Error: ${log.errorMessage}`)
        }
      })
    }
    
    // Check recent package purchases
    console.log('\n📦 Checking Recent Package Purchases...')
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
    
    console.log(`Found ${recentPurchases.length} recent package purchases:`)
    recentPurchases.forEach((purchase, index) => {
      console.log(`\n${index + 1}. Purchase:`)
      console.log(`   - ID: ${purchase.id}`)
      console.log(`   - User: ${purchase.user?.fullName || 'Unknown'} (${purchase.user?.email || 'No email'})`)
      console.log(`   - Amount: $${purchase.amount}`)
      console.log(`   - Status: ${purchase.status}`)
      console.log(`   - Created: ${purchase.createdAt}`)
    })
    
    // Check environment variables
    console.log('\n🔧 Checking Email Configuration...')
    console.log(`   - RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Not set'}`)
    console.log(`   - FROM_EMAIL: ${process.env.FROM_EMAIL || '❌ Not set'}`)
    
    if (!process.env.RESEND_API_KEY) {
      console.log('\n❌ RESEND_API_KEY is not configured!')
      console.log('   This is why emails are not being sent.')
      console.log('   Please add RESEND_API_KEY to your .env file')
    }
    
  } catch (error) {
    console.error('❌ Error checking email logs:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the check
checkEmailLogs()
  .then(() => {
    console.log('\n✅ Email logs check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Email logs check failed:', error)
    process.exit(1)
  }) 