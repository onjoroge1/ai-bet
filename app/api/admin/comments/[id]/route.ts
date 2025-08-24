import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

// PATCH /api/admin/comments/[id] - Update comment status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    // Check if user is admin
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action } = body

    if (!action || !['approve', 'reject', 'spam', 'delete'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    let updateData: any = {}
    let message = ''

    switch (action) {
      case 'approve':
        updateData = { isApproved: true, isSpam: false }
        message = 'Comment approved successfully'
        break
      
      case 'reject':
        updateData = { isApproved: false, isSpam: false }
        message = 'Comment rejected successfully'
        break
      
      case 'spam':
        updateData = { isApproved: false, isSpam: true }
        message = 'Comment marked as spam successfully'
        break
      
      case 'delete':
        // Delete the comment and all its replies
        await prisma.blogComment.deleteMany({
          where: {
            OR: [
              { id },
              { parentId: id }
            ]
          }
        })
        
        logger.info('Comment deleted successfully', {
          tags: ['api', 'admin', 'comments', 'deleted'],
          data: { commentId: id, adminUserId: session.user.id }
        })
        
        return NextResponse.json({
          success: true,
          message: 'Comment deleted successfully'
        })
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    // Update the comment
    const updatedComment = await prisma.blogComment.update({
      where: { id },
      data: updateData,
      include: {
        blogPost: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    logger.info('Comment status updated successfully', {
      tags: ['api', 'admin', 'comments', 'updated'],
      data: { 
        commentId: id, 
        action, 
        adminUserId: session.user.id,
        newStatus: updateData
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedComment,
      message
    })
  } catch (error) {
    logger.error('Failed to update comment status', {
      tags: ['api', 'admin', 'comments', 'error'],
      data: { 
        commentId: params, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    })

    return NextResponse.json(
      { success: false, error: 'Failed to update comment' },
      { status: 500 }
    )
  }
}
