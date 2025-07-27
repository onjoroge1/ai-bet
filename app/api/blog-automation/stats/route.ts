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

    // Get date range for statistics
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const thisWeek = new Date()
    thisWeek.setDate(thisWeek.getDate() - 7)
    
    const thisMonth = new Date()
    thisMonth.setMonth(thisMonth.getMonth() - 1)

    // Fetch comprehensive statistics
    const [
      totalGenerated,
      publishedCount,
      draftCount,
      todayGenerated,
      thisWeekGenerated,
      thisMonthGenerated,
      categoryBreakdown,
      qualityStats,
      recentPosts
    ] = await Promise.all([
      // Total AI-generated posts
      prisma.blogPost.count({
        where: { aiGenerated: true }
      }),
      
      // Published posts
      prisma.blogPost.count({
        where: { 
          aiGenerated: true,
          isPublished: true
        }
      }),
      
      // Draft posts
      prisma.blogPost.count({
        where: { 
          aiGenerated: true,
          isPublished: false
        }
      }),
      
      // Generated today
      prisma.blogPost.count({
        where: { 
          aiGenerated: true,
          createdAt: { gte: today }
        }
      }),
      
      // Generated this week
      prisma.blogPost.count({
        where: { 
          aiGenerated: true,
          createdAt: { gte: thisWeek }
        }
      }),
      
      // Generated this month
      prisma.blogPost.count({
        where: { 
          aiGenerated: true,
          createdAt: { gte: thisMonth }
        }
      }),
      
      // Category breakdown
      prisma.blogPost.groupBy({
        by: ['category'],
        where: { aiGenerated: true },
        _count: { category: true }
      }),
      
      // Quality statistics
      prisma.blogPost.findMany({
        where: { aiGenerated: true },
        select: {
          content: true,
          excerpt: true,
          seoTitle: true,
          seoDescription: true
        },
        take: 100 // Sample for quality calculation
      }),
      
      // Recent posts
      prisma.blogPost.findMany({
        where: { aiGenerated: true },
        select: {
          id: true,
          title: true,
          category: true,
          isPublished: true,
          createdAt: true,
          publishedAt: true,
          viewCount: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ])

    // Calculate quality metrics
    const qualityMetrics = calculateQualityMetrics(qualityStats)
    
    // Calculate average quality score
    const averageQuality = qualityMetrics.averageQuality

    // Format category breakdown
    const categoryStats = categoryBreakdown.map(item => ({
      category: item.category,
      count: item._count?.category || 0
    }))

    // Calculate engagement metrics
    const engagementStats = calculateEngagementMetrics(recentPosts)

    return NextResponse.json({
      // Basic counts
      total: totalGenerated,
      published: publishedCount,
      draft: draftCount,
      averageQuality: Math.round(averageQuality),
      
      // Time-based statistics
      today: todayGenerated,
      thisWeek: thisWeekGenerated,
      thisMonth: thisMonthGenerated,
      
      // Category breakdown
      categories: categoryStats,
      
      // Quality metrics
      quality: qualityMetrics,
      
      // Engagement metrics
      engagement: engagementStats,
      
      // Recent activity
      recentPosts: recentPosts.map(post => ({
        ...post,
        daysAgo: Math.floor((Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      }))
    })

  } catch (error) {
    console.error('Error fetching automation stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateQualityMetrics(posts: any[]) {
  let totalQuality = 0
  let totalSeo = 0
  let totalReadability = 0
  let validPosts = 0

  posts.forEach(post => {
    const wordCount = post.content?.split(' ').length || 0
    const hasExcerpt = post.excerpt && post.excerpt.length > 50
    const hasSeoTitle = post.seoTitle && post.seoTitle.length > 30
    const hasSeoDescription = post.seoDescription && post.seoDescription.length > 120
    
    // Quality score calculation
    let qualityScore = 70 // Base score
    if (wordCount >= 800) qualityScore += 10
    if (wordCount >= 1200) qualityScore += 5
    if (hasExcerpt) qualityScore += 5
    if (hasSeoTitle) qualityScore += 5
    if (hasSeoDescription) qualityScore += 5
    
    // SEO score
    let seoScore = 70
    if (hasSeoTitle) seoScore += 10
    if (hasSeoDescription) seoScore += 10
    if (wordCount >= 800) seoScore += 10
    
    // Readability score (simplified)
    let readabilityScore = 85
    if (wordCount > 1500) readabilityScore -= 10
    if (wordCount < 500) readabilityScore -= 15
    
    totalQuality += qualityScore
    totalSeo += seoScore
    totalReadability += readabilityScore
    validPosts++
  })

  return {
    averageQuality: validPosts > 0 ? totalQuality / validPosts : 0,
    averageSeo: validPosts > 0 ? totalSeo / validPosts : 0,
    averageReadability: validPosts > 0 ? totalReadability / validPosts : 0,
    totalAnalyzed: validPosts
  }
}

function calculateEngagementMetrics(posts: any[]) {
  const publishedPosts = posts.filter(post => post.isPublished)
  const totalViews = publishedPosts.reduce((sum, post) => sum + (post.viewCount || 0), 0)
  const averageViews = publishedPosts.length > 0 ? totalViews / publishedPosts.length : 0

  return {
    totalViews,
    averageViews: Math.round(averageViews),
    publishedCount: publishedPosts.length,
    engagementRate: publishedPosts.length > 0 ? (totalViews / publishedPosts.length) : 0
  }
} 