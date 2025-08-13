import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EmailService } from '@/lib/email-service'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Get user session for authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { name, email, subject, priority, category, message } = body

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, email, subject, and message are required' 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate priority
    const validPriorities = ['Low', 'Medium', 'High', 'Urgent']
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority level' }, { status: 400 })
    }

    // Create email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Support Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">🆘 New Support Request</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">A user has submitted a support request</p>
        </div>

        <!-- Content -->
        <div style="padding: 24px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
          <!-- Priority Badge -->
          <div style="display: inline-block; background-color: ${getPriorityColor(priority)}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-bottom: 20px;">
            ${getPriorityLabel(priority)} Priority
          </div>

          <!-- Request Details -->
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">📋 Request Details</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div>
                <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Name</strong>
                <p style="margin: 4px 0 0 0; color: #1f2937;">${name.trim()}</p>
              </div>
              <div>
                <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Email</strong>
                <p style="margin: 4px 0 0 0; color: #1f2937;">${email.trim()}</p>
              </div>
              <div>
                <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Category</strong>
                <p style="margin: 4px 0 0 0; color: #1f2937;">${category || 'Not specified'}</p>
              </div>
              <div>
                <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Submitted</strong>
                <p style="margin: 4px 0 0 0; color: #1f2937;">${new Date().toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short'
                })}</p>
              </div>
            </div>

            <div>
              <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Subject</strong>
              <p style="margin: 4px 0 0 0; color: #1f2937; font-weight: bold;">${subject.trim()}</p>
            </div>
          </div>

          <!-- Message -->
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;">💬 Message</h3>
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; white-space: pre-wrap; color: #374151; line-height: 1.5;">
              ${message.trim()}
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="text-align: center;">
            <a href="mailto:${email.trim()}?subject=Re: ${subject.trim()}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 12px;">
              📧 Reply to User
            </a>
            
            <a href="mailto:${email.trim()}?subject=Support Request #${Date.now()}&body=This support request has been assigned to you." style="display: inline-block; background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              📋 Assign to Team
            </a>
          </div>

          <!-- Footer -->
          <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">
              This email was automatically generated from the SnapBet support system.<br />
              Please respond within 24 hours to maintain our service standards.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    // Helper functions for priority styling
    function getPriorityColor(priority: string) {
      switch (priority.toLowerCase()) {
        case 'urgent': return '#dc2626' // red-600
        case 'high': return '#ea580c' // orange-600
        case 'medium': return '#d97706' // amber-600
        case 'low': return '#059669' // emerald-600
        default: return '#6b7280' // gray-500
      }
    }

    function getPriorityLabel(priority: string) {
      switch (priority.toLowerCase()) {
        case 'urgent': return '🚨 URGENT'
        case 'high': return '🔴 HIGH'
        case 'medium': return '🟡 MEDIUM'
        case 'low': return '🟢 LOW'
        default: return '⚪ MEDIUM'
      }
    }

    // Send email to support team using the existing EmailService
    const supportEmail = 'obadiah.kimani@snapbet.bet'
    const emailResult = await EmailService.sendGenericEmail({
      to: supportEmail,
      subject: `🆘 Support Request: ${subject} [${priority} Priority]`,
      html: emailHtml
    })

    if (!emailResult.success) {
      logger.error('Failed to send support contact email', {
        error: emailResult.error,
        user: session.user.id,
        supportRequest: { name, email, subject, priority, category, message }
      })
      
      return NextResponse.json({ 
        error: 'Failed to send support request. Please try again later.' 
      }, { status: 500 })
    }

    // Log successful submission
    logger.info('Support contact form submitted successfully', {
      user: session.user.id,
      supportRequest: { name, email, subject, priority, category, message },
      messageId: emailResult.messageId
    })

    // Return success response
    return NextResponse.json({ 
      success: true,
      message: 'Your support request has been sent successfully. We will respond within 24 hours.',
      messageId: emailResult.messageId
    })

  } catch (error) {
    logger.error('Error processing support contact form', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json({ 
      error: 'Internal server error. Please try again later.' 
    }, { status: 500 })
  }
} 