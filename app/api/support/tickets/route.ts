import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'
import { EmailService } from '@/lib/email-service'
import SupportTicketCreatedEmail, { SupportTicketCreatedEmailProps } from '@/app/admin/emails/support-ticket-created'

const prisma = new PrismaClient()
const emailService = new EmailService()

// GET /api/support/tickets - List user's support tickets
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const priority = searchParams.get('priority')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')

    // Build where clause
    const whereClause: any = {
      userId: session.user.id
    }

    if (status) whereClause.status = status
    if (category) whereClause.category = category
    if (priority) whereClause.priority = priority
    if (search) {
      whereClause.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get total count for pagination
    const totalCount = await prisma.supportTicket.count({ where: whereClause })

    // Get tickets with pagination
    const tickets = await prisma.supportTicket.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            fullName: true,
            email: true
          }
        },
        responses: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    logger.error('Error fetching support tickets', { error, userId: session?.user?.id })
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}

// POST /api/support/tickets - Create new support ticket
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, description, category, priority } = body

    // Validate required fields
    if (!subject || !description || !category || !priority) {
      return NextResponse.json({ 
        error: 'Missing required fields: subject, description, category, priority' 
      }, { status: 400 })
    }

    // Validate priority
    const validPriorities = ['Low', 'Medium', 'High', 'Urgent']
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ 
        error: 'Invalid priority. Must be one of: Low, Medium, High, Urgent' 
      }, { status: 400 })
    }

    // Get user details for email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true, email: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create the ticket
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: session.user.id,
        subject,
        description,
        category,
        priority,
        status: 'open',
        tags: [category.toLowerCase()],
        attachments: []
      }
    })

    // Send email notification to support team
    try {
      const emailProps: SupportTicketCreatedEmailProps = {
        ticketId: ticket.id,
        subject,
        description,
        category,
        priority,
        userName: user.fullName || 'Unknown User',
        userEmail: user.email,
        createdAt: new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        })
      }

      // Send to support email
      const supportEmail = 'obadiah.kimani@snapbet.bet'
      const emailResult = await emailService.sendEmail({
        to: supportEmail,
        subject: `🆘 New Support Ticket: ${subject} [${priority} Priority]`,
        html: `
          <h2>New Support Ticket Created</h2>
          <p><strong>Ticket ID:</strong> #${ticket.id}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Priority:</strong> ${priority}</p>
          <p><strong>User:</strong> ${user.fullName} (${user.email})</p>
          <p><strong>Description:</strong></p>
          <p>${description}</p>
          <p><strong>Created:</strong> ${emailProps.createdAt}</p>
        `,
        text: `New Support Ticket #${ticket.id}\nSubject: ${subject}\nCategory: ${category}\nPriority: ${priority}\nUser: ${user.fullName} (${user.email})\nDescription: ${description}\nCreated: ${emailProps.createdAt}`
      })

      if (emailResult.success) {
        logger.info('Support ticket notification email sent successfully', { 
          ticketId: ticket.id, 
          messageId: emailResult.messageId 
        })
      } else {
        logger.warn('Failed to send support ticket notification email', { 
          ticketId: ticket.id, 
          error: emailResult.error 
        })
      }
    } catch (emailError) {
      logger.error('Error sending support ticket notification email', { 
        ticketId: ticket.id, 
        error: emailError 
      })
      // Don't fail the ticket creation if email fails
    }

    logger.info('Support ticket created successfully', { 
      user: session.user.id, 
      ticketId: ticket.id, 
      category, 
      priority 
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Support ticket created successfully',
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt
      }
    })

  } catch (error) {
    logger.error('Error creating support ticket', { error, userId: session?.user?.id })
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
} 