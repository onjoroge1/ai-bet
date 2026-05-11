import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/blogs/evergreen-topics
 *
 * Lists all EvergreenTopic rows for the admin queue UI.
 * Admin-only.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const topics = await prisma.evergreenTopic.findMany({
      orderBy: [
        // queued first, then drafted, then refresh_due, then everything else
        { status: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    return NextResponse.json({ success: true, topics })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
