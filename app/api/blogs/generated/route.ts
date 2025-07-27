import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const status = searchParams.get('status') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause
    const where: any = {
      aiGenerated: true
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (category && category !== 'all') {
      where.category = category
    }

    if (status && status !== 'all') {
      if (status === 'published') {
        where.isPublished = true
      } else if (status === 'draft') {
        where.isPublished = false
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Get posts with pagination
    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: limit,
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
          readTime: true,
          seoTitle: true,
          seoDescription: true,
          seoKeywords: true,
          isPublished: true,
          sourceUrl: true,
          aiGenerated: true,
          createdAt: true,
          publishedAt: true,
          viewCount: true,
          shareCount: true
        }
      }),
      prisma.blogPost.count({ where })
    ])

    // Calculate quality scores for each post
    const postsWithScores = posts.map(post => {
      // Simple quality scoring based on content length and structure
      const wordCount = post.content.split(' ').length
      const hasExcerpt = post.excerpt && post.excerpt.length > 50
      const hasSeoTitle = post.seoTitle && post.seoTitle.length > 30
      const hasSeoDescription = post.seoDescription && post.seoDescription.length > 120
      
      let qualityScore = 70 // Base score
      
      if (wordCount >= 800) qualityScore += 10
      if (wordCount >= 1200) qualityScore += 5
      if (hasExcerpt) qualityScore += 5
      if (hasSeoTitle) qualityScore += 5
      if (hasSeoDescription) qualityScore += 5
      
      return {
        ...post,
        qualityScore: Math.min(qualityScore, 100),
        seoScore: hasSeoTitle && hasSeoDescription ? 90 : 70,
        readabilityScore: wordCount > 1000 ? 75 : 85
      }
    })

    return NextResponse.json({
      posts: postsWithScores,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('Error fetching generated posts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 