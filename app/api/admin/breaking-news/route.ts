import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - Fetch all breaking news
export async function GET() {
  try {
    const breakingNews = await prisma.breakingNews.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
      take: 10
    })

    return NextResponse.json({
      success: true,
      data: breakingNews
    })
  } catch (error) {
    console.error('[BreakingNews] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch breaking news' },
      { status: 500 }
    )
  }
}

// POST - Create new breaking news (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, message, priority = 1, isActive = true, expiresAt } = body

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: 'Title and message are required' },
        { status: 400 }
      )
    }

    const breakingNews = await prisma.breakingNews.create({
      data: {
        title,
        message,
        priority,
        isActive,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: session.user.id
      }
    })

    return NextResponse.json({
      success: true,
      data: breakingNews
    })
  } catch (error) {
    console.error('[BreakingNews] POST Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create breaking news' },
      { status: 500 }
    )
  }
}

// PUT - Update breaking news (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, title, message, priority, isActive, expiresAt } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      )
    }

    const breakingNews = await prisma.breakingNews.update({
      where: { id },
      data: {
        title,
        message,
        priority,
        isActive,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: breakingNews
    })
  } catch (error) {
    console.error('[BreakingNews] PUT Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update breaking news' },
      { status: 500 }
    )
  }
}

// DELETE - Remove breaking news (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      )
    }

    await prisma.breakingNews.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Breaking news deleted successfully'
    })
  } catch (error) {
    console.error('[BreakingNews] DELETE Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete breaking news' },
      { status: 500 }
    )
  }
}
