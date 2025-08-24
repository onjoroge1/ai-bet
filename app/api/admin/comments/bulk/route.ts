import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

// POST /api/admin/comments/bulk - Bulk comment actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is admin
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { commentIds, action } = body

    if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment IDs are required' },
        { status: 400 }
      )
    }

    if (!action || !['approve', 'reject', 'spam', 'delete'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    let result: any
    let message = ''

    switch (action) {
      case 'approve':
        result = await prisma.blogComment.updateMany({
          where: { id: { in: commentIds } },
          data: { isApproved: true, isSpam: false }
        })
        message = `${result.count} comment(s) approved successfully`
        break
      
      case 'reject':
        result = await prisma.blogComment.updateMany({
          where: { id: { in: commentIds } },
          data: { isApproved: false, isSpam: false }
        })
        message = `${result.count} comment(s) rejected successfully`
        break
      
      case 'spam':
        result = await prisma.blogComment.updateMany({
          where: { id: { in: commentIds } },
          data: { isApproved: false, isSpam: true }
        })
        message = `${result.count} comment(s) marked as spam successfully`
        break
      
      case 'delete':
        // Delete comments and all their replies
        const commentsToDelete = await prisma.blogComment.findMany({
          where: { id: { in: commentIds } },
          select: { id: true }
        })
        
        const commentIdsToDelete = commentsToDelete.map(c => c.id)
        
        // Find all replies to these comments
        const replies = await prisma.blogComment.findMany({
          where: { parentId: { in: commentIdsToDelete } },
          select: { id: true }
        })
        
        const allIdsToDelete = [...commentIdsToDelete, ...replies.map(r => r.id)]
        
        result = await prisma.blogComment.deleteMany({
          where: { id: { in: allIdsToDelete } }
        })
        
        message = `${result.count} comment(s) deleted successfully`
        break
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    logger.info('Bulk comment action completed successfully', {
      tags: ['api', 'admin', 'comments', 'bulk-action'],
      data: { 
        action, 
        commentIds, 
        affectedCount: result.count,
        adminUserId: session.user.id 
      }
    })

    return NextResponse.json({
      success: true,
      data: { affectedCount: result.count },
      message
    })
  } catch (error) {
    logger.error('Failed to perform bulk comment action', {
      tags: ['api', 'admin', 'comments', 'bulk-action', 'error'],
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    })

    return NextResponse.json(
      { success: false, error: 'Failed to perform bulk action' },
      { status: 500 }
    )
  }
}
