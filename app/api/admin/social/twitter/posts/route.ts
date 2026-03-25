import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

/**
 * GET /api/admin/social/twitter/posts - Get scheduled and posted Twitter posts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'scheduled,posted,failed'
    const limit = parseInt(searchParams.get('limit') || '50')
    const statusArray = status.split(',').map(s => s.trim())

    const posts = await prisma.socialMediaPost.findMany({
      where: {
        platform: 'twitter',
        status: { in: statusArray },
      },
      orderBy: [
        { scheduledAt: 'desc' },
        { postedAt: 'desc' },
      ],
      take: limit,
    })

    // Stats summary
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const [postedToday, postedHour, scheduledCount, failedCount] = await Promise.all([
      prisma.socialMediaPost.count({
        where: { platform: 'twitter', status: 'posted', postedAt: { gte: oneDayAgo } },
      }),
      prisma.socialMediaPost.count({
        where: { platform: 'twitter', status: 'posted', postedAt: { gte: oneHourAgo } },
      }),
      prisma.socialMediaPost.count({
        where: { platform: 'twitter', status: 'scheduled' },
      }),
      prisma.socialMediaPost.count({
        where: { platform: 'twitter', status: 'failed' },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: posts,
      stats: {
        postedToday,
        postedHour,
        scheduledCount,
        failedCount,
        hourlyLimit: 5,
        dailyLimit: 30,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch posts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/social/twitter/posts - Manage individual posts (retry, cancel, edit)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { postId, action, content } = body

    if (!postId || !action) {
      return NextResponse.json({ success: false, error: 'postId and action are required' }, { status: 400 })
    }

    const post = await prisma.socialMediaPost.findUnique({ where: { id: postId } })
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
    }

    switch (action) {
      case 'retry': {
        if (post.status !== 'failed') {
          return NextResponse.json({ success: false, error: 'Can only retry failed posts' }, { status: 400 })
        }
        const updated = await prisma.socialMediaPost.update({
          where: { id: postId },
          data: {
            status: 'scheduled',
            scheduledAt: new Date(),
            errorMessage: null,
          },
        })
        return NextResponse.json({ success: true, data: updated, message: 'Post queued for retry' })
      }

      case 'cancel': {
        if (post.status !== 'scheduled') {
          return NextResponse.json({ success: false, error: 'Can only cancel scheduled posts' }, { status: 400 })
        }
        const updated = await prisma.socialMediaPost.update({
          where: { id: postId },
          data: { status: 'cancelled' },
        })
        return NextResponse.json({ success: true, data: updated, message: 'Post cancelled' })
      }

      case 'edit': {
        if (post.status !== 'scheduled') {
          return NextResponse.json({ success: false, error: 'Can only edit scheduled posts' }, { status: 400 })
        }
        if (!content || typeof content !== 'string') {
          return NextResponse.json({ success: false, error: 'content is required for edit action' }, { status: 400 })
        }
        if (content.length > 280) {
          return NextResponse.json({ success: false, error: 'Content exceeds 280 character limit' }, { status: 400 })
        }
        const updated = await prisma.socialMediaPost.update({
          where: { id: postId },
          data: { content },
        })
        return NextResponse.json({ success: true, data: updated, message: 'Post updated' })
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update post', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

