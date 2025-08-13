import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

const prisma = new PrismaClient()

// GET /api/support/tickets/[id] - Get ticket details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id

    // Get ticket with responses
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id // Ensure user can only access their own tickets
      },
      include: {
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

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: ticket
    })

  } catch (error) {
    logger.error('Error fetching support ticket', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json({ 
      error: 'Internal server error. Please try again later.' 
    }, { status: 500 })
  }
}

// PUT /api/support/tickets/[id] - Update ticket
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id
    const body = await request.json()
    const { subject, description, category, priority, tags, attachments } = body

    // Check if ticket exists and belongs to user
    const existingTicket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id
      }
    })

    if (!existingTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Only allow updates if ticket is open
    if (existingTicket.status !== 'open') {
      return NextResponse.json({ 
        error: 'Cannot update ticket that is not open' 
      }, { status: 400 })
    }

    // Validate priority if provided
    if (priority) {
      const validPriorities = ['Low', 'Medium', 'High', 'Urgent']
      if (!validPriorities.includes(priority)) {
        return NextResponse.json({ error: 'Invalid priority level' }, { status: 400 })
      }
    }

    // Validate category if provided
    if (category) {
      const validCategories = ['Technical', 'Billing', 'Account', 'Feature', 'General']
      if (!validCategories.includes(category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
    }

    // Update ticket
    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(subject && { subject: subject.trim() }),
        ...(description && { description: description.trim() }),
        ...(category && { category }),
        ...(priority && { priority }),
        ...(tags && { tags }),
        ...(attachments && { attachments }),
        updatedAt: new Date()
      },
      include: {
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

    // Log ticket update
    logger.info('Support ticket updated successfully', {
      user: session.user.id,
      ticketId,
      updatedFields: Object.keys(body)
    })

    return NextResponse.json({ 
      success: true,
      message: 'Ticket updated successfully',
      data: updatedTicket
    })

  } catch (error) {
    logger.error('Error updating support ticket', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json({ 
      error: 'Internal server error. Please try again later.' 
    }, { status: 500 })
  }
}

// DELETE /api/support/tickets/[id] - Close ticket
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id

    // Check if ticket exists and belongs to user
    const existingTicket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id
      }
    })

    if (!existingTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Close the ticket (soft delete by changing status)
    const closedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'closed',
        resolvedAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Log ticket closure
    logger.info('Support ticket closed successfully', {
      user: session.user.id,
      ticketId
    })

    return NextResponse.json({ 
      success: true,
      message: 'Ticket closed successfully',
      data: closedTicket
    })

  } catch (error) {
    logger.error('Error closing support ticket', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json({ 
      error: 'Internal server error. Please try again later.' 
    }, { status: 500 })
  }
} 