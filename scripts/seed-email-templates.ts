import { EmailTemplateService } from '../lib/email-template-service'

async function seedTemplates() {
  try {
    console.log('🌱 Seeding default email templates...')
    
    await EmailTemplateService.seedDefaultTemplates()
    
    console.log('✅ Default templates seeded successfully!')
    
    // Get template stats
    const stats = await EmailTemplateService.getTemplateStats()
    console.log('📊 Template Statistics:')
    console.log(`   Total templates: ${stats.total}`)
    console.log(`   Active templates: ${stats.active}`)
    console.log(`   Recent activity: ${stats.recentActivity} emails sent in last 24h`)
    console.log('   By category:', stats.byCategory)
    
    // List all templates
    const templates = await EmailTemplateService.listTemplates()
    console.log('\n📧 Available Templates:')
    templates.forEach(template => {
      console.log(`   - ${template.name} (${template.category}) - ${template.isActive ? 'Active' : 'Inactive'}`)
    })
    
  } catch (error) {
    console.error('❌ Failed to seed templates:', error)
  }
}

// Run the seeding
seedTemplates() 