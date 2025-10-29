import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { TemplateBlogGenerator, type QuickPurchaseLite } from '@/lib/blog/template-blog-generator'

// GET /api/admin/template-blogs - Get eligible QuickPurchase matches
export async function GET() {
  try {
    const matches = await TemplateBlogGenerator.getEligibleQuickPurchases()
    
    return NextResponse.json({
      success: true,
      data: matches,
    })
  } catch (error) {
    console.error('Error fetching eligible matches:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch matches' },
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

    const body = await req.json() as { action?: 'generate_all' | 'generate_single'; matchId?: string }

    if (body.action === 'generate_all') {
      const result = await generateAllTemplateDrafts()
      return NextResponse.json({ success: true, data: result })
    }

    if (body.action === 'generate_single') {
      if (!body.matchId) {
        return NextResponse.json(
          { success: false, error: 'matchId required' },
          { status: 400 }
        )
      }

      const matches = await TemplateBlogGenerator.getEligibleQuickPurchases()
      const target = matches.find((m) => m.id === body.matchId)
      
      if (!target) {
        return NextResponse.json(
          { success: false, error: 'Match not eligible or not found' },
          { status: 404 }
        )
      }

      const result = await generateDraftForQuickPurchase(target)
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
 * Check if draft already exists for QuickPurchase
 */
async function hasExistingDraftForQP(quickPurchaseId: string): Promise<boolean> {
  const existing = await prisma.blogPost.findFirst({
    where: { 
      sourceUrl: quickPurchaseId,
      isActive: true // Only check for active blogs
    },
    select: { id: true },
  })
  return Boolean(existing)
}

/**
 * Generate and save draft for a single QuickPurchase
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
 * Generate all eligible template drafts
 */
async function generateAllTemplateDrafts(): Promise<{ success: number; skipped: number }> {
  const matches = await TemplateBlogGenerator.getEligibleQuickPurchases()
  let success = 0
  let skipped = 0

  for (const qp of matches) {
    const result = await generateDraftForQuickPurchase(qp)
    if (result.created) {
      success += 1
    } else {
      skipped += 1
    }
  }

  return { success, skipped }
}
