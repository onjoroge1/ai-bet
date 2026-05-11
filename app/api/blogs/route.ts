import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"

/**
 * GET /api/blogs
 *
 * Single-blog fetch (legacy path, view-increment now wired):
 *   ?slug=<slug>             — returns one blog by slug
 *
 * List fetch with optional server-side filtering:
 *   ?limit=<n>               — page size (default 50, max 200)
 *   ?page=<n>                — 1-indexed page number (default 1)
 *   ?search=<text>           — fuzzy title/excerpt match (icontains)
 *   ?category=<cat>          — exact match (or 'all')
 *   ?status=published|draft  — admin only filter; ignored for public
 *   ?aiGenerated=true|false  — admin only filter
 *   ?dateFrom=<ISO>          — publishedAt >= dateFrom (filter on date range)
 *   ?dateTo=<ISO>            — publishedAt <= dateTo
 *   ?sortBy=date|views|title — default 'date'
 *   ?sortOrder=asc|desc      — default 'desc'
 *
 * Response shape (list mode):
 *   { success, data: BlogPost[], total, pagination: { page, limit, totalPages },
 *     stats: { totalAll, totalPublished, totalDrafts, totalFeatured, totalViews } }
 *
 * Backward-compat: existing callers reading only `data` continue to work.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    // Check if user is admin
    const session = await getServerSession(authOptions)
    const isAdmin = session?.user?.role?.toLowerCase() === 'admin'

    // ─── Single-blog fetch by slug (with view increment) ──────────────
    if (slug) {
      const whereClause = isAdmin
        ? { slug }
        : { slug, isPublished: true, isActive: true }

      const blog = await prisma.blogPost.findFirst({
        where: whereClause,
        include: {
          media: {
            select: { id: true, type: true, url: true, filename: true, size: true, alt: true, caption: true, uploadedAt: true },
            orderBy: { uploadedAt: 'asc' },
          },
          // Include linked match so the CTA component can render
          // "Read AI Prediction for X vs Y →" without re-fetching.
          marketMatch: {
            select: {
              matchId: true,
              homeTeam: true,
              awayTeam: true,
              league: true,
              kickoffDate: true,
              status: true,
            },
          },
        },
      })
      if (!blog) {
        return NextResponse.json({ success: false, error: 'Blog post not found' }, { status: 404 })
      }

      // Increment viewCount on public reads only (admins previewing don't inflate).
      // Mirrors the existing behavior of /api/blogs/[id] but for slug-based fetches,
      // which is the path /app/blog/[slug]/page.tsx uses for its render.
      if (!isAdmin && blog.isPublished && blog.isActive) {
        prisma.blogPost
          .update({ where: { id: blog.id }, data: { viewCount: { increment: 1 } } })
          .catch(() => { /* non-fatal */ })
      }

      return NextResponse.json({ success: true, data: blog })
    }

    // ─── List mode with server-side filtering ──────────────────────────
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const search = searchParams.get('search')?.trim() || ''
    const category = searchParams.get('category') || 'all'
    const status = searchParams.get('status') || 'all'
    const aiGenerated = searchParams.get('aiGenerated') // 'true' | 'false' | null
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const sortBy = (searchParams.get('sortBy') || 'date') as 'date' | 'views' | 'title'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // Build WHERE — start with admin/public visibility gate
    const where: Prisma.BlogPostWhereInput = isAdmin
      ? { isActive: true }
      : { isPublished: true, isActive: true }

    // Status filter (admin only; public always sees published)
    if (isAdmin && status !== 'all') {
      where.isPublished = status === 'published'
    }

    // Category filter
    if (category && category !== 'all') {
      where.category = category
    }

    // AI-generated filter (admin only — exposes draft pipeline detail)
    if (isAdmin && aiGenerated === 'true') where.aiGenerated = true
    if (isAdmin && aiGenerated === 'false') where.aiGenerated = false

    // Date range filter — applies to publishedAt
    if (dateFrom || dateTo) {
      where.publishedAt = {}
      if (dateFrom) (where.publishedAt as Prisma.DateTimeFilter).gte = new Date(dateFrom)
      if (dateTo) {
        // Inclusive: include the entire dateTo day by pushing to end of day
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        ;(where.publishedAt as Prisma.DateTimeFilter).lte = to
      }
    }

    // Fuzzy search across title and excerpt (case-insensitive)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Build ORDER BY
    const orderBy: Prisma.BlogPostOrderByWithRelationInput = (() => {
      if (sortBy === 'views') return { viewCount: sortOrder }
      if (sortBy === 'title') return { title: sortOrder }
      // 'date' default — use publishedAt with createdAt as tiebreaker
      return { publishedAt: sortOrder }
    })()

    const skip = (page - 1) * limit

    // Query in parallel: filtered page + filtered total + overall stats.
    const [blogs, total, statsAgg] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        include: {
          media: {
            select: { id: true, type: true, url: true, filename: true, size: true, alt: true, caption: true, uploadedAt: true },
            orderBy: { uploadedAt: 'asc' },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.blogPost.count({ where }),
      // Overall stats — scoped to the visibility gate (admin sees all active;
      // public sees only published+active) but NOT scoped to filters, so the
      // stat cards show "total inventory" not "filtered total."
      (async () => {
        const visibilityWhere: Prisma.BlogPostWhereInput = isAdmin
          ? { isActive: true }
          : { isPublished: true, isActive: true }
        const [totalAll, totalPublished, totalDrafts, totalFeatured, viewsAgg] = await Promise.all([
          prisma.blogPost.count({ where: visibilityWhere }),
          prisma.blogPost.count({ where: { ...visibilityWhere, isPublished: true } }),
          isAdmin ? prisma.blogPost.count({ where: { isActive: true, isPublished: false } }) : Promise.resolve(0),
          prisma.blogPost.count({ where: { ...visibilityWhere, featured: true } }),
          prisma.blogPost.aggregate({ where: visibilityWhere, _sum: { viewCount: true } }),
        ])
        return {
          totalAll, totalPublished, totalDrafts, totalFeatured,
          totalViews: viewsAgg._sum.viewCount ?? 0,
        }
      })(),
    ])

    return NextResponse.json({
      success: true,
      data: blogs,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: statsAgg,
    })
  } catch (error) {
    console.error("Error fetching blogs:", error)
    return NextResponse.json({ error: "Failed to fetch blogs" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()

    // Validate required fields
    if (!data.title || !data.content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 })
    }

    // Start a transaction to create blog post and media
    const result = await prisma.$transaction(async (tx) => {
      // Create blog post
      const blogPost = await tx.blogPost.create({
        data: {
          title: data.title,
          content: data.content,
          slug: data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          excerpt: data.excerpt || data.content.substring(0, 150) + '...',
          author: session.user.name || session.user.email || 'SnapBet AI Team',
          category: data.category || 'predictions',
          tags: Array.isArray(data.tags) ? data.tags : [],
          geoTarget: Array.isArray(data.geoTarget) ? data.geoTarget : ['worldwide'],
          featured: !!data.featured,
          readTime: typeof data.readTime === 'number' ? data.readTime : 5,
          seoTitle: data.seoTitle || '',
          seoDescription: data.seoDescription || '',
          seoKeywords: Array.isArray(data.seoKeywords) ? data.seoKeywords : [],
          isPublished: data.isPublished ?? false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      // Add media if provided
      if (data.media && data.media.length > 0) {
        const mediaData = data.media.map((item: any) => ({
          blogPostId: blogPost.id,
          type: item.type,
          url: item.url,
          filename: item.filename,
          size: item.size,
          alt: item.alt || null,
          caption: item.caption || null,
          uploadedAt: item.uploadedAt ? new Date(item.uploadedAt) : new Date(),
        }))

        await tx.blogMedia.createMany({ data: mediaData })
      }

      return blogPost
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Error creating blog post:", error)
    return NextResponse.json({ error: "Failed to create blog post" }, { status: 500 })
  }
}
