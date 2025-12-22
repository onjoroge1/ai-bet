import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { TemplateBlogGenerator } from '@/lib/blog/template-blog-generator'
import prisma from '@/lib/db'

/**
 * GET /api/admin/template-blogs/scheduled - Scheduled blog generation (for cron jobs)
 * 
 * This endpoint is called by Vercel Cron to automatically generate blog posts
 * for upcoming matches that don't have blogs yet.
 * It uses CRON_SECRET for authentication instead of user sessions.
 * 
 * Schedule: Nightly at 2 AM (recommended frequency)
 * - Runs after matches and predictions have been synced
 * - Generates blogs for matches in the next 24-48 hours
 * - Auto-publishes since template blogs use predefined data
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('🕐 CRON: Unauthorized blog generation attempt', {
        tags: ['api', 'admin', 'template-blogs', 'cron', 'security'],
        data: { hasAuthHeader: !!authHeader },
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('🕐 CRON: Starting scheduled blog generation', {
      tags: ['api', 'admin', 'template-blogs', 'cron', 'generation'],
      data: { startTime: new Date(startTime).toISOString() },
    })

    // Get eligible matches (matches without blogs)
    const eligibleMatches = await TemplateBlogGenerator.getEligibleMarketMatches()
    
    logger.info('🕐 CRON: Found eligible matches for blog generation', {
      tags: ['api', 'admin', 'template-blogs', 'cron'],
      data: { 
        eligibleCount: eligibleMatches.length,
        matchIds: eligibleMatches.slice(0, 10).map(m => m.id)
      },
    })

    if (eligibleMatches.length === 0) {
      logger.info('🕐 CRON: No eligible matches found for blog generation', {
        tags: ['api', 'admin', 'template-blogs', 'cron'],
      })
      return NextResponse.json({
        success: true,
        message: 'No eligible matches found',
        generated: 0,
        skipped: 0,
        errors: [],
        duration: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      })
    }

    // Generate blogs for all eligible matches
    let generated = 0
    let skipped = 0
    const errors: string[] = []

    for (const match of eligibleMatches) {
      try {
        // Check if blog already exists
        const existingBlog = await prisma.blogPost.findFirst({
          where: { 
            marketMatchId: match.id,
            isActive: true 
          },
          select: { id: true },
        })

        if (existingBlog) {
          logger.debug('🕐 CRON: Blog already exists, skipping', {
            tags: ['api', 'admin', 'template-blogs', 'cron'],
            data: { marketMatchId: match.id },
          })
          skipped++
          continue
        }

        // Generate blog draft (will auto-publish)
        const quickPurchase = match.quickPurchases[0]
        if (!quickPurchase) {
          logger.warn('🕐 CRON: No QuickPurchase found for match', {
            tags: ['api', 'admin', 'template-blogs', 'cron'],
            data: { marketMatchId: match.id },
          })
          skipped++
          continue
        }

        const draft = TemplateBlogGenerator.generateTemplateOnlyDraft(quickPurchase, match)

        // Generate slug
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
          finalSlug = `${slug}-${match.id.slice(-6)}`
        }

        // Create blog post (auto-published)
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
            isPublished: true, // Auto-publish template blogs
            isActive: true,
            aiGenerated: false,
            marketMatchId: match.id,
            sourceUrl: quickPurchase.id,
          },
        })

        generated++
        logger.info('🕐 CRON: Blog generated successfully', {
          tags: ['api', 'admin', 'template-blogs', 'cron'],
          data: { 
            marketMatchId: match.id,
            slug: finalSlug,
            title: draft.title,
          },
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Match ${match.id}: ${errorMessage}`)
        logger.error('🕐 CRON: Error generating blog for match', {
          tags: ['api', 'admin', 'template-blogs', 'cron', 'error'],
          error: error instanceof Error ? error : undefined,
          data: { marketMatchId: match.id },
        })
      }
    }

    const duration = Date.now() - startTime

    logger.info('🕐 CRON: Scheduled blog generation completed', {
      tags: ['api', 'admin', 'template-blogs', 'cron', 'generation'],
      data: {
        generated,
        skipped,
        errors: errors.length,
        duration: `${duration}ms`,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Scheduled blog generation completed',
      summary: {
        generated,
        skipped,
        total: eligibleMatches.length,
        errors: errors.length,
      },
      errors: errors.slice(0, 10), // Return first 10 errors
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('🕐 CRON: Blog generation failed', {
      tags: ['api', 'admin', 'template-blogs', 'cron', 'generation', 'error'],
      error: error instanceof Error ? error : undefined,
      data: { duration: `${duration}ms` },
    })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  }
}

