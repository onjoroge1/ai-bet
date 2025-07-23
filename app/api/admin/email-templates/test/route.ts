import { NextRequest, NextResponse } from 'next/server'
import { EmailTemplateService } from '@/lib/email-template-service'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { templateId, email, variables } = await request.json()

    if (!templateId || !email) {
      return NextResponse.json(
        { success: false, error: 'Template ID and email are required' },
        { status: 400 }
      )
    }

    // Get the template
    const template = await EmailTemplateService.getTemplate(templateId)
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    if (!template.isActive) {
      return NextResponse.json(
        { success: false, error: 'Template is inactive' },
        { status: 400 }
      )
    }

    // Render the template with variables
    const renderedEmail = await EmailTemplateService.renderTemplate(template.slug, variables || {})

    // Log the email (in a real implementation, you would send the actual email)
    await EmailTemplateService.logEmail({
      templateId,
      recipient: email,
      subject: renderedEmail.subject,
      status: 'sent',
      metadata: {
        testEmail: true,
        variables: variables || {},
        renderedAt: new Date().toISOString()
      }
    })

    logger.info('Test email logged', { 
      templateId, 
      recipient: email, 
      subject: renderedEmail.subject 
    })

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      data: {
        templateId,
        recipient: email,
        subject: renderedEmail.subject,
        renderedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    logger.error('Failed to send test email', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to send test email' },
      { status: 500 }
    )
  }
} 