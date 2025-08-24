import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/blogs/[id]/comments - Get comments for a blog post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Get approved comments with replies
    const comments = await prisma.blogComment.findMany({
      where: {
        blogPostId: id,
        isApproved: true,
        isSpam: false,
        parentId: null // Only top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        replies: {
          where: {
            isApproved: true,
            isSpam: false
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    })

    // Get total count for pagination
    const totalComments = await prisma.blogComment.count({
      where: {
        blogPostId: id,
        isApproved: true,
        isSpam: false,
        parentId: null
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        comments,
        pagination: {
          page,
          limit,
          total: totalComments,
          pages: Math.ceil(totalComments / limit)
        }
      }
    })
  } catch (error) {
    logger.error('Failed to fetch blog comments', {
      tags: ['api', 'blog-comments', 'error'],
      data: { blogPostId: params, error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// POST /api/blogs/[id]/comments - Add a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const body = await request.json()

    const { content, parentId, userName, userEmail } = body

    // Validate required fields
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment content is required' },
        { status: 400 }
      )
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Comment is too long (max 1000 characters)' },
        { status: 400 }
      )
    }

    // Check if blog post exists
    const blogPost = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, isPublished: true, isActive: true }
    })

    if (!blogPost || !blogPost.isPublished || !blogPost.isActive) {
      return NextResponse.json(
        { success: false, error: 'Blog post not found or not published' },
        { status: 404 }
      )
    }

    // If user is authenticated, use their info
    let commentData: any = {
      blogPostId: id,
      content: content.trim(),
      isApproved: false, // Require approval for new comments
      parentId: parentId || null
    }

    if (session?.user) {
      // Authenticated user
      commentData.userId = session.user.id
      // Use the userName from request body (which should be first name) or fallback to fullName
      commentData.userName = userName || session.user.fullName || session.user.email
      commentData.userEmail = session.user.email
      commentData.isApproved = true // Auto-approve authenticated users
    } else {
      // Guest user - require name and email
      if (!userName || userName.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Name is required for guest comments' },
          { status: 400 }
        )
      }

      if (!userEmail || userEmail.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Email is required for guest comments' },
          { status: 400 }
        )
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(userEmail)) {
        return NextResponse.json(
          { success: false, error: 'Invalid email format' },
          { status: 400 }
        )
      }

      commentData.userName = userName.trim()
      commentData.userEmail = userEmail.trim()
    }

    // Create the comment
    const comment = await prisma.blogComment.create({
      data: commentData,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    logger.info('Blog comment created successfully', {
      tags: ['api', 'blog-comments', 'created'],
      data: { 
        commentId: comment.id, 
        blogPostId: id, 
        userId: comment.userId,
        isAuthenticated: !!session?.user 
      }
    })

    return NextResponse.json({
      success: true,
      data: comment,
      message: comment.isApproved 
        ? 'Comment posted successfully' 
        : 'Comment submitted and awaiting approval'
    })
  } catch (error) {
    logger.error('Failed to create blog comment', {
      tags: ['api', 'blog-comments', 'error'],
      data: { blogPostId: params, error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { success: false, error: 'Failed to post comment' },
      { status: 500 }
    )
  }
}

// DELETE /api/blogs/[id]/comments - Delete a comment (only by the author)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: 'Comment ID is required' },
        { status: 400 }
      )
    }

    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Find the comment to check ownership
    const comment = await prisma.blogComment.findUnique({
      where: { id: commentId },
      select: { 
        id: true, 
        userId: true, 
        blogPostId: true,
        parentId: true 
      }
    })

    if (!comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      )
    }

    // Check if comment belongs to the current user
    if (comment.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own comments' },
        { status: 403 }
      )
    }

    // Check if comment belongs to the specified blog post
    if (comment.blogPostId !== id) {
      return NextResponse.json(
        { success: false, error: 'Comment does not belong to this blog post' },
        { status: 400 }
      )
    }

    // Delete the comment (this will also delete any replies due to cascade)
    await prisma.blogComment.delete({
      where: { id: commentId }
    })

    logger.info('Blog comment deleted successfully', {
      tags: ['api', 'blog-comments', 'deleted'],
      data: { 
        commentId, 
        blogPostId: id, 
        userId: session.user.id 
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully'
    })
  } catch (error) {
    logger.error('Failed to delete blog comment', {
      tags: ['api', 'blog-comments', 'error'],
      data: { blogPostId: params, error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { success: false, error: 'Failed to delete comment' },
      { status: 500 }
    )
  }
}
