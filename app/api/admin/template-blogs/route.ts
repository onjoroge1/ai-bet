import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { TemplateBlogGenerator, type QuickPurchaseLite, type MarketMatchWithQP } from '@/lib/blog/template-blog-generator'

// GET /api/admin/template-blogs - Get eligible MarketMatch records
export async function GET() {
  try {
    console.log('[TemplateBlog API] Starting fetch...')
    const matches = await TemplateBlogGenerator.getEligibleMarketMatches()
    console.log(`[TemplateBlog API] Returning ${matches.length} matches`)
    
    return NextResponse.json({
      success: true,
      data: matches,
    })
  } catch (error) {
    console.error('[TemplateBlog API] Error fetching eligible matches:', error)
    console.error('[TemplateBlog API] Error details:', error instanceof Error ? error.stack : error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch matches', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/template-blogs - Generate template blogs
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json() as { action?: 'generate_all' | 'generate_single'; marketMatchId?: string }

    if (body.action === 'generate_all') {
      const result = await generateAllTemplateDrafts()
      return NextResponse.json({ success: true, data: result })
    }

    if (body.action === 'generate_single') {
      if (!body.marketMatchId) {
        return NextResponse.json(
          { success: false, error: 'marketMatchId required' },
          { status: 400 }
        )
      }

      const matches = await TemplateBlogGenerator.getEligibleMarketMatches()
      const target = matches.find((m) => m.id === body.marketMatchId)
      
      if (!target) {
        return NextResponse.json(
          { success: false, error: 'Match not eligible or not found' },
          { status: 404 }
        )
      }

      const result = await generateDraftForMarketMatch(target)
      return NextResponse.json({ success: true, data: result })
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in template blog generation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate blogs' },
      { status: 500 }
    )
  }
}

/**
 * Check if draft already exists for MarketMatch
 */
async function hasExistingDraftForMarketMatch(marketMatchId: string): Promise<boolean> {
  const existing = await prisma.blogPost.findFirst({
    where: { 
      marketMatchId: marketMatchId,
      isActive: true // Only check for active blogs
    },
    select: { id: true },
  })
  return Boolean(existing)
}

/**
 * Generate and save draft for a single MarketMatch
 */
async function generateDraftForMarketMatch(marketMatch: MarketMatchWithQP): Promise<{ created: boolean; error?: string }> {
  if (!marketMatch.id) {
    console.error('[TemplateBlog] No MarketMatch ID provided')
    return { created: false, error: 'No MarketMatch ID' }
  }

  console.log(`[TemplateBlog] Processing: ${marketMatch.homeTeam} vs ${marketMatch.awayTeam} (${marketMatch.id})`)

  const exists = await hasExistingDraftForMarketMatch(marketMatch.id)
  if (exists) {
    console.log(`[TemplateBlog] Draft already exists for MarketMatch ${marketMatch.id}`)
    return { created: false, error: 'Draft already exists' }
  }

  // Get QuickPurchase data for blog generation
  const quickPurchase = marketMatch.quickPurchases[0]
  if (!quickPurchase || !quickPurchase.id) {
    console.error('[TemplateBlog] No QuickPurchase data available')
    return { created: false, error: 'No QuickPurchase data available' }
  }

  try {
    console.log(`[TemplateBlog] Starting draft generation for ${marketMatch.homeTeam} vs ${marketMatch.awayTeam}`)
    const draft = TemplateBlogGenerator.generateTemplateOnlyDraft(quickPurchase, marketMatch)
    console.log(`[TemplateBlog] Draft generated successfully`)

    // Generate slug from title
    const slug = draft.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // Check if slug already exists
    const existingSlug = await prisma.blogPost.findFirst({
      where: { slug },
      select: { id: true },
    })

    let finalSlug = slug
    if (existingSlug) {
      finalSlug = `${slug}-${marketMatch.id.slice(-6)}`
    }

    console.log(`[TemplateBlog] Creating blog post with slug: ${finalSlug}`)
    await prisma.blogPost.create({
      data: {
        title: draft.title,
        slug: finalSlug,
        excerpt: draft.excerpt,
        content: draft.contentHtml,
        author: 'AI System',
        category: 'Predictions',
        tags: draft.tags,
        readTime: draft.readTimeMinutes,
        seoTitle: draft.title,
        seoDescription: draft.excerpt,
        isPublished: true, // Auto-publish template blogs (they use predefined data, no manual review needed)
        isActive: true,
        aiGenerated: false, // Key: No AI badge for templates
        marketMatchId: marketMatch.id, // Link to MarketMatch
        sourceUrl: quickPurchase.id, // Keep QuickPurchase reference for backward compatibility
      },
    })

    console.log(`[TemplateBlog] Blog post created successfully: ${finalSlug}`)
    return { created: true }
  } catch (error) {
    console.error(`[TemplateBlog] Error generating blog for MarketMatch ${marketMatch.id}:`, error)
    return { created: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Generate and save draft for a single QuickPurchase (legacy method, kept for backward compatibility)
 * @deprecated Use generateDraftForMarketMatch instead
 */
async function generateDraftForQuickPurchase(qp: QuickPurchaseLite): Promise<{ created: boolean; error?: string }> {
  if (!qp.id) {
    console.error('[TemplateBlog] No QuickPurchase ID provided')
    return { created: false, error: 'No QuickPurchase ID' }
  }

  console.log(`[TemplateBlog] Processing: ${qp.name} (${qp.id})`)

  const exists = await hasExistingDraftForQP(qp.id)
  if (exists) {
    console.log(`[TemplateBlog] Draft already exists for ${qp.id}`)
    return { created: false, error: 'Draft already exists' }
  }

  try {
        console.log(`[TemplateBlog] Starting draft generation for ${qp.name}`)
        const draft = TemplateBlogGenerator.generateTemplateOnlyDraft(qp)
        console.log(`[TemplateBlog] Draft generated successfully for ${qp.name}`)

  // Generate slug from title
  const slug = draft.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  // Check if slug already exists
  const existingSlug = await prisma.blogPost.findFirst({
    where: { slug },
    select: { id: true },
  })

  let finalSlug = slug
  if (existingSlug) {
    finalSlug = `${slug}-${qp.id.slice(-6)}`
  }

    console.log(`[TemplateBlog] Creating blog post with slug: ${finalSlug}`)
    await prisma.blogPost.create({
      data: {
        title: draft.title,
        slug: finalSlug,
        excerpt: draft.excerpt,
        content: draft.contentHtml,
        author: 'AI System',
        category: 'Predictions',
        tags: draft.tags,
        readTime: draft.readTimeMinutes,
        seoTitle: draft.title,
        seoDescription: draft.excerpt,
        isPublished: false, // Always start as draft
        isActive: true,
        aiGenerated: false, // Key: No AI badge for templates
        sourceUrl: qp.id, // Link back to QuickPurchase
      },
    })

    console.log(`[TemplateBlog] Blog post created successfully: ${finalSlug}`)
    return { created: true }
  } catch (error) {
    console.error(`[TemplateBlog] Error generating blog for ${qp.name}:`, error)
    return { created: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Generate all eligible template drafts from MarketMatch
 */
async function generateAllTemplateDrafts(): Promise<{ success: number; skipped: number }> {
  const matches = await TemplateBlogGenerator.getEligibleMarketMatches()
  let success = 0
  let skipped = 0

  for (const match of matches) {
    const result = await generateDraftForMarketMatch(match)
    if (result.created) {
      success += 1
    } else {
      skipped += 1
    }
  }

  return { success, skipped }
}
