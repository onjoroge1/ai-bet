import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EmailTemplateService } from '@/lib/email-template-service'
import { EmailService } from '@/lib/email-service'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      templateId, 
      recipientType, // 'all', 'specific', 'filtered'
      recipientEmails, // Array of specific emails
      filters, // User filters (country, subscription, etc.)
      variables, // Template variables
      dryRun = false // If true, don't actually send emails
    } = await request.json()

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
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

    // Get recipients based on type
    let recipients: Array<{ id: string; email: string; fullName?: string }> = []

    switch (recipientType) {
      case 'all':
        const allUsers = await prisma.user.findMany({
          where: { 
            isActive: true,
            emailNotifications: true // Only users who have opted in
          },
          select: { id: true, email: true, fullName: true }
        })
        recipients = allUsers.map(user => ({
          id: user.id,
          email: user.email,
          fullName: user.fullName || undefined
        }))
        break

      case 'specific':
        if (!recipientEmails || !Array.isArray(recipientEmails)) {
          return NextResponse.json(
            { success: false, error: 'Recipient emails array is required for specific sending' },
            { status: 400 }
          )
        }
        const specificUsers = await prisma.user.findMany({
          where: { 
            email: { in: recipientEmails },
            isActive: true,
            emailNotifications: true
          },
          select: { id: true, email: true, fullName: true }
        })
        recipients = specificUsers.map(user => ({
          id: user.id,
          email: user.email,
          fullName: user.fullName || undefined
        }))
        break

      case 'filtered':
        const whereClause: any = { 
          isActive: true,
          emailNotifications: true
        }
        
        if (filters?.countryId && filters.countryId !== 'all') {
          whereClause.countryId = filters.countryId
        }
        if (filters?.subscriptionPlan && filters.subscriptionPlan !== 'all') {
          whereClause.subscriptionPlan = filters.subscriptionPlan
        }
        if (filters?.role) {
          whereClause.role = filters.role
        }
        if (filters?.createdAfter) {
          whereClause.createdAt = { gte: new Date(filters.createdAfter) }
        }

        const filteredUsers = await prisma.user.findMany({
          where: whereClause,
          select: { id: true, email: true, fullName: true }
        })
        recipients = filteredUsers.map(user => ({
          id: user.id,
          email: user.email,
          fullName: user.fullName || undefined
        }))
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid recipient type' },
          { status: 400 }
        )
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No recipients found matching criteria' },
        { status: 400 }
      )
    }

    // If dry run, just return the count
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: `Dry run: Would send to ${recipients.length} recipients`,
        data: {
          recipientCount: recipients.length,
          recipients: recipients.map(r => ({ email: r.email, name: r.fullName }))
        }
      })
    }

    // Send emails
    const results = {
      total: recipients.length,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const recipient of recipients) {
      try {
        // Prepare variables for this recipient
        const recipientVariables = {
          ...variables,
          userName: recipient.fullName || recipient.email.split('@')[0],
          userEmail: recipient.email,
          userId: recipient.id
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
          to: recipient.email,
          subject: renderedEmail.subject,
          html: renderedEmail.html
        })

        if (emailResult.success) {
          results.sent++
          
          // Log the email
          await EmailTemplateService.logEmail({
            templateId,
            recipient: recipient.email,
            subject: template.subject,
            status: 'sent',
            metadata: {
              bulkSend: true,
              recipientId: recipient.id,
              variables: recipientVariables
            }
          })
        } else {
          results.failed++
          results.errors.push(`Failed to send to ${recipient.email}: ${emailResult.error}`)
        }

      } catch (error) {
        results.failed++
        results.errors.push(`Error sending to ${recipient.email}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    logger.info('Bulk email send completed', {
      templateId,
      templateSlug: template.slug,
      results
    })

    return NextResponse.json({
      success: true,
      message: `Bulk email send completed: ${results.sent} sent, ${results.failed} failed`,
      data: results
    })

  } catch (error) {
    logger.error('Failed to send bulk emails', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to send bulk emails' },
      { status: 500 }
    )
  }
} 