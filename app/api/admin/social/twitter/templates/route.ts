import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TwitterGenerator } from '@/lib/social/twitter-generator'

/**
 * GET /api/admin/social/twitter/templates - Get available templates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const postType = searchParams.get('postType') || 'match' // 'match', 'parlay', 'brand', 'upcoming'

    const templates = TwitterGenerator.getAvailableTemplates(postType as any)

    // Group templates by category for easier UI display
    const templatesByCategory = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = []
      }
      acc[template.category].push(template)
      return acc
    }, {} as Record<string, typeof templates>)

    return NextResponse.json({
      success: true,
      data: {
        templates,
        templatesByCategory,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

