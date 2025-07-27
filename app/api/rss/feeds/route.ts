import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rssFeedManager } from '@/lib/rss/rss-feed-manager'
import { logger } from '@/lib/logger'

// GET /api/rss/feeds - Get all RSS feeds
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is admin
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const feeds = await rssFeedManager.getFeeds()
    const health = await rssFeedManager.getFeedHealth()

    logger.info('RSS feeds retrieved successfully', {
      tags: ['api', 'rss', 'feeds'],
      data: { 
        totalFeeds: feeds.length,
        activeFeeds: health.activeFeeds
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        feeds,
        health
      }
    })
  } catch (error) {
    logger.error('Failed to get RSS feeds', {
      tags: ['api', 'rss', 'feeds', 'error'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { success: false, error: 'Failed to get RSS feeds' },
      { status: 500 }
    )
  }
}

// POST /api/rss/feeds - Add new RSS feed
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is admin
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.id || !body.name || !body.url) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, name, url' },
        { status: 400 }
      )
    }

    // Validate category
    const validCategories = ['sports', 'betting', 'football', 'general']
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category. Must be one of: sports, betting, football, general' },
        { status: 400 }
      )
    }

    // Validate priority
    const validPriorities = ['high', 'medium', 'low']
    if (!validPriorities.includes(body.priority)) {
      return NextResponse.json(
        { success: false, error: 'Invalid priority. Must be one of: high, medium, low' },
        { status: 400 }
      )
    }

    // Create feed object
    const feed = {
      id: body.id,
      name: body.name,
      url: body.url,
      category: body.category,
      priority: body.priority,
      isActive: body.isActive ?? true,
      checkInterval: body.checkInterval ?? 30
    }

    await rssFeedManager.addFeed(feed)

    logger.info('RSS feed added successfully', {
      tags: ['api', 'rss', 'feeds'],
      data: { 
        feedId: feed.id,
        feedName: feed.name,
        feedUrl: feed.url
      }
    })

    return NextResponse.json({
      success: true,
      data: feed,
      message: 'RSS feed added successfully'
    })
  } catch (error) {
    logger.error('Failed to add RSS feed', {
      tags: ['api', 'rss', 'feeds', 'error'],
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        body: await request.json().catch(() => 'Unable to parse body')
      }
    })

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add RSS feed' 
      },
      { status: 500 }
    )
  }
}

// PUT /api/rss/feeds - Update RSS feed
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is admin
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    // Validate category if provided
    if (body.category) {
      const validCategories = ['sports', 'betting', 'football', 'general']
      if (!validCategories.includes(body.category)) {
        return NextResponse.json(
          { success: false, error: 'Invalid category. Must be one of: sports, betting, football, general' },
          { status: 400 }
        )
      }
    }

    // Validate priority if provided
    if (body.priority) {
      const validPriorities = ['high', 'medium', 'low']
      if (!validPriorities.includes(body.priority)) {
        return NextResponse.json(
          { success: false, error: 'Invalid priority. Must be one of: high, medium, low' },
          { status: 400 }
        )
      }
    }

    // Get existing feed to merge with updates
    const existingFeed = await rssFeedManager.getFeed(body.id)
    if (!existingFeed) {
      return NextResponse.json(
        { success: false, error: 'Feed not found' },
        { status: 404 }
      )
    }

    // Update feed
    const updatedFeed = {
      ...existingFeed,
      ...body
    }

    await rssFeedManager.updateFeed(updatedFeed)

    logger.info('RSS feed updated successfully', {
      tags: ['api', 'rss', 'feeds'],
      data: { 
        feedId: body.id,
        updatedFields: Object.keys(body)
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedFeed,
      message: 'RSS feed updated successfully'
    })
  } catch (error) {
    logger.error('Failed to update RSS feed', {
      tags: ['api', 'rss', 'feeds', 'error'],
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        body: await request.json().catch(() => 'Unable to parse body')
      }
    })

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update RSS feed' 
      },
      { status: 500 }
    )
  }
}

// DELETE /api/rss/feeds - Remove RSS feed
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is admin
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const feedId = searchParams.get('id')

    if (!feedId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: id' },
        { status: 400 }
      )
    }

    await rssFeedManager.removeFeed(feedId)

    logger.info('RSS feed removed successfully', {
      tags: ['api', 'rss', 'feeds'],
      data: { feedId }
    })

    return NextResponse.json({
      success: true,
      message: 'RSS feed removed successfully'
    })
  } catch (error) {
    logger.error('Failed to remove RSS feed', {
      tags: ['api', 'rss', 'feeds', 'error'],
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        feedId: new URL(request.url).searchParams.get('id')
      }
    })

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to remove RSS feed' 
      },
      { status: 500 }
    )
  }
} 