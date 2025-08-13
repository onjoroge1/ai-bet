import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

const prisma = new PrismaClient()

// POST /api/support/tickets/[id]/responses - Add a response to a ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const { message } = await request.json()

    // Validate message
    if (!message || message.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Message is required' 
      }, { status: 400 })
    }

    // Check if ticket exists and user has access
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { id: true } } }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Only ticket owner or staff can add responses
    const isOwner = ticket.user.id === session.user.id
    const isStaff = session.user.role === 'admin' || session.user.role === 'staff'
    
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if ticket is closed
    if (ticket.status === 'closed') {
      return NextResponse.json({ 
        error: 'Cannot add responses to closed tickets' 
      }, { status: 400 })
    }

    // Create the response
    const response = await prisma.supportTicketResponse.create({
      data: {
        ticketId,
        userId: session.user.id,
        message: message.trim(),
        isStaff: isStaff
      }
    })

    // Update ticket's updatedAt timestamp
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() }
    })

    // If staff is responding, optionally update ticket status
    if (isStaff && ticket.status === 'open') {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'in_progress' }
      })
    }

    logger.info('Support ticket response added successfully', { 
      ticketId, 
      userId: session.user.id, 
      isStaff,
      responseId: response.id,
      userInfo: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Response added successfully',
      response: {
        id: response.id,
        message: response.message,
        isStaff: response.isStaff,
        createdAt: response.createdAt,
        user: {
          id: session.user.id,
          fullName: session.user.name || 'Unknown User',
          role: session.user.role
        }
      }
    })

  } catch (error) {
    logger.error('Error adding support ticket response', { 
      error, 
      ticketId: (await params).id, 
      userId: (await getServerSession(authOptions))?.user?.id 
    })
    return NextResponse.json({ error: 'Failed to add response' }, { status: 500 })
  }
}

// GET /api/support/tickets/[id]/responses - Get all responses for a ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: ticketId } = await params

    // Check if ticket exists and user has access
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { id: true } } }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Only ticket owner or staff can view responses
    const isOwner = ticket.user.id === session.user.id
    const isStaff = session.user.role === 'admin' || session.user.role === 'staff'
    
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get all responses for the ticket
    const responses = await prisma.supportTicketResponse.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      }
    })

    return NextResponse.json({ 
      success: true, 
      responses 
    })

  } catch (error) {
    logger.error('Error fetching support ticket responses', { 
      error, 
      ticketId: (await params).id, 
      userId: (await getServerSession(authOptions))?.user?.id 
    })
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 })
  }
} 