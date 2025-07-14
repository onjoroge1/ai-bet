import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/blogs - Get all blog posts with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const category = searchParams.get('category')
    const geoTarget = searchParams.get('geoTarget')
    const featured = searchParams.get('featured')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')

    // If slug is provided, fetch a single post
    if (slug) {
      const post = await prisma.blogPost.findUnique({
        where: { 
          slug,
          isPublished: true,
          isActive: true
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          content: true,
          author: true,
          category: true,
          tags: true,
          geoTarget: true,
          featured: true,
          publishedAt: true,
          viewCount: true,
          shareCount: true,
          readTime: true,
          seoTitle: true,
          seoDescription: true,
          seoKeywords: true,
          isPublished: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      })

      if (!post) {
        return NextResponse.json(
          { success: false, error: 'Blog post not found' },
          { status: 404 }
        )
      }

      // Increment view count
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { viewCount: { increment: 1 } }
      })

      return NextResponse.json({
        success: true,
        data: post
      })
    }

    // Build where clause for list query
    const where: any = {
      isPublished: true,
      isActive: true,
    }

    if (category && category !== 'all') {
      where.category = category
    }

    if (geoTarget) {
      where.geoTarget = {
        has: geoTarget
      }
    }

    if (featured === 'true') {
      where.featured = true
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get blog posts
    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: [
          { featured: 'desc' },
          { publishedAt: 'desc' }
        ],
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          author: true,
          category: true,
          tags: true,
          geoTarget: true,
          featured: true,
          publishedAt: true,
          viewCount: true,
          shareCount: true,
          readTime: true,
        }
      }),
      prisma.blogPost.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: posts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('Error fetching blog posts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch blog posts' },
      { status: 500 }
    )
  }
}

// POST /api/blogs - Create a new blog post (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      title,
      slug,
      excerpt,
      content,
      author,
      category,
      tags,
      geoTarget,
      featured,
      readTime,
      seoTitle,
      seoDescription,
      seoKeywords,
      isPublished
    } = body

    // Validate required fields
    if (!title || !slug || !content || !category) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug }
    })

    if (existingPost) {
      return NextResponse.json(
        { success: false, error: 'Blog post with this slug already exists' },
        { status: 409 }
      )
    }

    // Create blog post
    const blogPost = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        author: author || 'SnapBet AI Team',
        category,
        tags: tags || [],
        geoTarget: geoTarget || ['worldwide'],
        featured: featured || false,
        readTime: readTime || 5,
        seoTitle,
        seoDescription,
        seoKeywords: seoKeywords || [],
        isPublished: isPublished !== undefined ? isPublished : true,
      }
    })

    return NextResponse.json({
      success: true,
      data: blogPost
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating blog post:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create blog post' },
      { status: 500 }
    )
  }
} 