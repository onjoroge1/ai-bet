import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { generateEvergreenDraft, excerptFromHtml, readTimeFromHtml } from '@/lib/evergreen-prompt'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

/**
 * POST /api/admin/blogs/generate-evergreen
 *
 * Body: { topicId: string, regenerate?: boolean }
 *
 * Generates (or fetches cached) an evergreen blog draft for the given
 * EvergreenTopic row. Creates a corresponding BlogPost with isPublished=false
 * if one doesn't already exist for the topic. Returns the BlogPost so the
 * admin UI can open the editor.
 *
 * Admin-session OR CRON_SECRET auth.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const session = await getServerSession(authOptions)
    const isAdmin = session?.user?.role?.toLowerCase() === 'admin'
    const cronSecret = process.env.CRON_SECRET
    const cronAuth = cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`
    if (!isAdmin && !cronAuth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const topicId = body?.topicId as string | undefined
    const regenerate = body?.regenerate === true

    if (!topicId) {
      return NextResponse.json({ success: false, error: 'topicId required' }, { status: 400 })
    }

    const topic = await prisma.evergreenTopic.findUnique({ where: { id: topicId } })
    if (!topic) {
      return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 })
    }

    // If already published and not asking for regeneration, return the existing blog
    if (topic.status === 'published' && topic.blogPostId && !regenerate) {
      const blogPost = await prisma.blogPost.findUnique({ where: { id: topic.blogPostId } })
      return NextResponse.json({
        success: true,
        topic,
        blogPost,
        cached: true,
        message: 'Topic already published. Pass regenerate:true to re-draft.',
      })
    }

    // ── Generate the draft (or hit AI cache) ────────────────────
    const draft = await generateEvergreenDraft({
      title: topic.title,
      targetQuery: topic.targetQuery ?? topic.title.toLowerCase(),
      bucket: topic.bucket as any,
      productAnchor: topic.productAnchor,
      promptHint: topic.promptHint,
      seoKeywords: topic.seoKeywords,
    })

    // ── Upsert the BlogPost ────────────────────────────────────
    const seoTitleBase = topic.title
    const seoDescription = excerptFromHtml(draft.html)
    const author = session?.user?.name ?? session?.user?.email ?? 'SnapBet AI Team'
    const readTime = readTimeFromHtml(draft.html)

    let blogPost
    if (topic.blogPostId) {
      // Update existing draft
      blogPost = await prisma.blogPost.update({
        where: { id: topic.blogPostId },
        data: {
          title: topic.title,
          slug: topic.slug,
          content: draft.html,
          excerpt: seoDescription,
          author,
          category: topic.bucket,
          tags: [topic.bucket, ...(topic.productAnchor ? [topic.productAnchor] : [])],
          readTime,
          seoTitle: seoTitleBase,
          seoDescription,
          seoKeywords: topic.seoKeywords,
          aiGenerated: true,
          isPublished: false, // admin must review before publish
          isActive: true,
        },
      })
    } else {
      blogPost = await prisma.blogPost.create({
        data: {
          title: topic.title,
          slug: topic.slug,
          content: draft.html,
          excerpt: seoDescription,
          author,
          category: topic.bucket,
          tags: [topic.bucket, ...(topic.productAnchor ? [topic.productAnchor] : [])],
          geoTarget: ['worldwide'],
          featured: false,
          readTime,
          seoTitle: seoTitleBase,
          seoDescription,
          seoKeywords: topic.seoKeywords,
          aiGenerated: true,
          isPublished: false,
          isActive: true,
        },
      })
      await prisma.evergreenTopic.update({
        where: { id: topic.id },
        data: { blogPostId: blogPost.id, status: 'drafted' },
      })
    }

    return NextResponse.json({
      success: true,
      topic: { ...topic, status: 'drafted', blogPostId: blogPost.id },
      blogPost,
      cached: draft.cached,
      generatedAt: draft.generatedAt,
    })
  } catch (error) {
    console.error('[Generate Evergreen] error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
