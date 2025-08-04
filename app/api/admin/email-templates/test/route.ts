import { NextRequest, NextResponse } from 'next/server'
import { EmailTemplateService } from '@/lib/email-template-service'
import { EmailService } from '@/lib/email-service'
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

    // Prepare variables for this recipient
    const recipientVariables = {
      ...variables,
      userName: variables?.userName || email.split('@')[0],
      userEmail: email
    }

    // Send email based on template type
    let emailResult
    
    // For all templates, use the database template content
    const renderedEmail = await EmailTemplateService.renderTemplate(
      template.slug, 
      recipientVariables
    )
    
    // Use the public sendGenericEmail method with the database template
    emailResult = await EmailService.sendGenericEmail({
      to: email,
      subject: renderedEmail.subject,
      html: renderedEmail.html
    })

    if (emailResult.success) {
      // Log the email
      await EmailTemplateService.logEmail({
        templateId,
        recipient: email,
        subject: template.subject,
        status: 'sent',
        metadata: {
          testEmail: true,
          variables: recipientVariables,
          renderedAt: new Date().toISOString(),
          messageId: emailResult.messageId
        }
      })

      logger.info('Test email sent successfully', { 
        templateId, 
        templateSlug: template.slug,
        recipient: email, 
        subject: template.subject,
        messageId: emailResult.messageId
      })

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        data: {
          templateId,
          templateSlug: template.slug,
          recipient: email,
          subject: template.subject,
          messageId: emailResult.messageId,
          renderedAt: new Date().toISOString()
        }
      })
    } else {
      // Log the failure
      await EmailTemplateService.logEmail({
        templateId,
        recipient: email,
        subject: template.subject,
        status: 'failed',
        errorMessage: emailResult.error?.toString(),
        metadata: {
          testEmail: true,
          variables: recipientVariables,
          renderedAt: new Date().toISOString()
        }
      })

      logger.error('Test email failed', { 
        templateId, 
        templateSlug: template.slug,
        recipient: email, 
        error: emailResult.error
      })

      return NextResponse.json({
        success: false,
        error: `Failed to send test email: ${emailResult.error}`,
        data: {
          templateId,
          templateSlug: template.slug,
          recipient: email,
          error: emailResult.error
        }
      })
    }

  } catch (error) {
    logger.error('Failed to send test email', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to send test email' },
      { status: 500 }
    )
  }
} 