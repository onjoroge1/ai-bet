import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { matchBlogGeneratorService } from '@/lib/services/match-blog-generator.service'
import { logger } from '@/lib/logger'

// GET /api/admin/match-blog-generation - Get upcoming matches and generation status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'upcoming-matches') {
      // Get upcoming matches for preview
      const matches = await matchBlogGeneratorService.getUpcomingMatches()
      
      logger.info('Retrieved upcoming matches for admin preview', {
        tags: ['api', 'admin', 'match-blog-generation'],
        data: { count: matches.length }
      })

      return NextResponse.json({
        success: true,
        data: {
          matches,
          total: matches.length
        }
      })
    }

    // Default: return generation status
    return NextResponse.json({
      success: true,
      data: {
        message: 'Match blog generation service is ready',
        service: 'MatchBlogGeneratorService',
        availableActions: ['upcoming-matches', 'generate-blogs', 'generate-single']
      }
    })

  } catch (error) {
    logger.error('Failed to get match blog generation data', {
      tags: ['api', 'admin', 'match-blog-generation', 'error'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { success: false, error: 'Failed to get match blog generation data' },
      { status: 500 }
    )
  }
}

// POST /api/admin/match-blog-generation - Generate blog posts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, matchId } = body

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      )
    }

    let result: any

    switch (action) {
      case 'generate-blogs':
        // Generate blogs for all upcoming matches
        result = await matchBlogGeneratorService.generateAndSaveMatchBlogs()
        
        logger.info('Batch blog generation completed via API', {
          tags: ['api', 'admin', 'match-blog-generation', 'batch-generation'],
          data: { 
            userId: session.user.id,
            result 
          }
        })
        break

      case 'generate-single':
        // Generate blog for a specific match
        if (!matchId) {
          return NextResponse.json(
            { success: false, error: 'Match ID is required for single generation' },
            { status: 400 }
          )
        }

        // Get the specific match
        const matches = await matchBlogGeneratorService.getUpcomingMatches()
        const targetMatch = matches.find(m => m.id === matchId || m.matchId === matchId)
        
        if (!targetMatch) {
          return NextResponse.json(
            { success: false, error: 'Match not found' },
            { status: 404 }
          )
        }

        const blogData = await matchBlogGeneratorService.generateMatchBlog(targetMatch)
        const blogId = await matchBlogGeneratorService.saveBlogPost(blogData)
        
        result = {
          success: 1,
          failed: 0,
          total: 1,
          generatedBlog: {
            id: blogId,
            title: blogData.title,
            slug: blogData.slug
          }
        }

        logger.info('Single blog generation completed via API', {
          tags: ['api', 'admin', 'match-blog-generation', 'single-generation'],
          data: { 
            userId: session.user.id,
            matchId: targetMatch.id,
            blogId,
            title: blogData.title
          }
        })
        break

      case 'preview-match':
        // Preview blog content for a specific match without saving
        if (!matchId) {
          return NextResponse.json(
            { success: false, error: 'Match ID is required for preview' },
            { status: 400 }
          )
        }

        const previewMatches = await matchBlogGeneratorService.getUpcomingMatches()
        const previewMatch = previewMatches.find(m => m.id === matchId || m.matchId === matchId)
        
        if (!previewMatch) {
          return NextResponse.json(
            { success: false, error: 'Match not found' },
            { status: 404 }
          )
        }

        const previewBlogData = await matchBlogGeneratorService.generateMatchBlog(previewMatch)
        
        result = {
          preview: true,
          blogData: previewBlogData
        }

        logger.info('Blog preview generated via API', {
          tags: ['api', 'admin', 'match-blog-generation', 'preview'],
          data: { 
            userId: session.user.id,
            matchId: previewMatch.id,
            title: previewBlogData.title
          }
        })
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Supported actions: generate-blogs, generate-single, preview-match' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `Action '${action}' completed successfully`
    })

  } catch (error) {
    logger.error('Failed to execute match blog generation action', {
      tags: ['api', 'admin', 'match-blog-generation', 'error'],
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    })

    return NextResponse.json(
      { success: false, error: 'Failed to execute match blog generation action' },
      { status: 500 }
    )
  }
}
