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
    const status = searchParams.get('status') || 'scheduled,posted'
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

    return NextResponse.json({
      success: true,
      data: posts,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch posts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

