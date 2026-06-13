import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { wcFixtures } from '@/lib/world-cup/data'
import { wcBlogIdeas } from '@/lib/world-cup/blog-ideas'

/**
 * GET /api/admin/world-cup/blog-ideas
 *
 * Returns ranked, data-grounded World Cup blog angles (see
 * lib/world-cup/blog-ideas). Admin-gated by middleware (/api/admin/*).
 * Feeds the human-review blog flow — does not generate or publish content.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const fixtures = await wcFixtures({ take: 300 })
    const ideas = wcBlogIdeas(fixtures, new Date())
    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      fixturesScanned: fixtures.length,
      count: ideas.length,
      ideas,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
