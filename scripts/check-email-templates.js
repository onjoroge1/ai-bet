#!/usr/bin/env node

/**
 * Check Email Templates Script
 * 
 * This script checks if email templates are properly configured
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkEmailTemplates() {
  console.log('📧 Checking Email Templates...\n')
  
  try {
    // Check all email templates
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { updatedAt: 'desc' }
    })
    
    console.log(`Found ${templates.length} email templates:`)
    
    if (templates.length === 0) {
      console.log('❌ No email templates found!')
      console.log('   This means the email template system is not set up.')
      console.log('   The system will fall back to hardcoded templates.')
    } else {
      templates.forEach((template, index) => {
        console.log(`\n${index + 1}. Template:`)
        console.log(`   - Name: ${template.name}`)
        console.log(`   - Slug: ${template.slug}`)
        console.log(`   - Category: ${template.category}`)
        console.log(`   - Active: ${template.isActive ? '✅ Yes' : '❌ No'}`)
        console.log(`   - Subject: ${template.subject}`)
        console.log(`   - Updated: ${template.updatedAt}`)
      })
    }
    
    // Specifically check for payment confirmation template
    console.log('\n🔍 Checking Payment Confirmation Template...')
    const paymentTemplate = await prisma.emailTemplate.findFirst({
      where: {
        OR: [
          { slug: 'payment-successful' },
          { slug: 'payment-confirmation' },
          { name: { contains: 'payment', mode: 'insensitive' } }
        ]
      }
    })
    
    if (paymentTemplate) {
      console.log('✅ Payment confirmation template found:')
      console.log(`   - Name: ${paymentTemplate.name}`)
      console.log(`   - Slug: ${paymentTemplate.slug}`)
      console.log(`   - Active: ${paymentTemplate.isActive ? '✅ Yes' : '❌ No'}`)
      console.log(`   - Subject: ${paymentTemplate.subject}`)
      
      if (!paymentTemplate.isActive) {
        console.log('\n⚠️  WARNING: Payment template is INACTIVE!')
        console.log('   This means payment confirmation emails will use the hardcoded fallback template.')
      }
    } else {
      console.log('❌ No payment confirmation template found!')
      console.log('   The system will use the hardcoded fallback template.')
    }
    
    // Check if templates are seeded
    console.log('\n🌱 Checking if templates need to be seeded...')
    if (templates.length === 0) {
      console.log('   No templates found - they need to be seeded.')
      console.log('   You can seed them by running the email template service.')
    }
    
  } catch (error) {
    console.error('❌ Error checking email templates:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the check
checkEmailTemplates()
  .then(() => {
    console.log('\n✅ Email templates check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Email templates check failed:', error)
    process.exit(1)
  }) 