import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { feedMonitor } from '@/lib/rss/feed-monitor'
import { rssFeedManager } from '@/lib/rss/rss-feed-manager'
import { logger } from '@/lib/logger'

// GET /api/rss/monitoring - Get monitoring status and statistics
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

    const monitoringStats = feedMonitor.getMonitoringStats()
    const feedHealth = await rssFeedManager.getFeedHealth()
    
    // Get workflow manager statistics for daily limits
    const { automationWorkflowManager } = await import('@/lib/automation/workflow-manager')
    const workflowStats = await automationWorkflowManager.getStatistics()

    logger.info('RSS monitoring status retrieved', {
      tags: ['api', 'rss', 'monitoring'],
      data: { 
        isActive: monitoringStats.isActive,
        processedItems: monitoringStats.processedItemsCount,
        activeFeeds: feedHealth.activeFeeds,
        dailyLimit: workflowStats.dailyLimit,
        processedToday: workflowStats.processedToday
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        monitoring: {
          ...monitoringStats,
          dailyLimit: workflowStats.dailyLimit,
          processedToday: workflowStats.processedToday,
          remainingSlots: workflowStats.dailyLimit - workflowStats.processedToday
        },
        feedHealth
      }
    })
  } catch (error) {
    logger.error('Failed to get RSS monitoring status', {
      tags: ['api', 'rss', 'monitoring', 'error'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    return NextResponse.json(
      { success: false, error: 'Failed to get monitoring status' },
      { status: 500 }
    )
  }
}

// POST /api/rss/monitoring - Control monitoring
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
    const action = body.action

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: action' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'start':
        feedMonitor.startMonitoring()
        logger.info('RSS monitoring started via API', {
          tags: ['api', 'rss', 'monitoring']
        })
        return NextResponse.json({
          success: true,
          message: 'RSS monitoring started successfully'
        })

      case 'stop':
        feedMonitor.stopMonitoring()
        logger.info('RSS monitoring stopped via API', {
          tags: ['api', 'rss', 'monitoring']
        })
        return NextResponse.json({
          success: true,
          message: 'RSS monitoring stopped successfully'
        })

      case 'clear-cache':
        feedMonitor.clearProcessedItems()
        logger.info('RSS monitoring cache cleared via API', {
          tags: ['api', 'rss', 'monitoring']
        })
        return NextResponse.json({
          success: true,
          message: 'Monitoring cache cleared successfully'
        })

      case 'check-all-feeds':
        const items = await rssFeedManager.checkAllFeeds()
        logger.info('Manual RSS feed check completed', {
          tags: ['api', 'rss', 'monitoring'],
          data: { itemsFound: items.length }
        })
        return NextResponse.json({
          success: true,
          data: { itemsFound: items.length },
          message: `Found ${items.length} RSS items`
        })

      case 'process-feeds':
        // Check feeds and process through blog automation with daily limits
        const feedItems = await rssFeedManager.checkAllFeeds()
        logger.info('RSS feed processing started', {
          tags: ['api', 'rss', 'monitoring'],
          data: { itemsFound: feedItems.length }
        })

        // Import and use the singleton workflow manager to respect daily limits
        const { automationWorkflowManager } = await import('@/lib/automation/workflow-manager')
        
        // Get current statistics
        const stats = await automationWorkflowManager.getStatistics()
        const remainingSlots = stats.dailyLimit - stats.processedToday
        
        if (remainingSlots <= 0) {
          logger.info('Daily limit reached, no processing needed', {
            tags: ['api', 'rss', 'monitoring'],
            data: { 
              processedToday: stats.processedToday,
              dailyLimit: stats.dailyLimit
            }
          })
          
          return NextResponse.json({
            success: true,
            data: { 
              itemsFound: feedItems.length,
              processedCount: 0,
              errorCount: 0,
              dailyLimitReached: true
            },
            message: `Found ${feedItems.length} RSS items, but daily limit of ${stats.dailyLimit} articles has been reached`
          })
        }

        // Process items within daily limit
        let processedCount = 0
        let errorCount = 0
        const itemsToProcess = Math.min(remainingSlots, 5) // Process up to 5 items or remaining slots

        // Import blog automation service
        const { BlogAutomationService } = await import('@/lib/blog/blog-automation-service')
        const blogAutomationService = new BlogAutomationService()

        // Process items through the blog automation workflow
        for (const item of feedItems.slice(0, itemsToProcess)) {
          try {
            const result = await blogAutomationService.processNewsItem(item)
            if (result) {
              processedCount++
              // Update the workflow manager's processed count
              automationWorkflowManager['processedToday'] += 1
              
              logger.info('Blog post generated from RSS item', {
                tags: ['api', 'rss', 'monitoring', 'blog-automation'],
                data: { 
                  title: result.title,
                  source: item.source,
                  processedCount,
                  remainingSlots: remainingSlots - processedCount
                }
              })
            }
          } catch (error) {
            errorCount++
            logger.error('Failed to process RSS item', {
              tags: ['api', 'rss', 'monitoring', 'error'],
              data: { 
                title: item.title,
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCount
              }
            })
          }
        }

        logger.info('RSS feed processing completed', {
          tags: ['api', 'rss', 'monitoring'],
          data: { 
            totalItems: feedItems.length,
            processedCount,
            errorCount,
            remainingSlots: remainingSlots - processedCount
          }
        })

        return NextResponse.json({
          success: true,
          data: { 
            itemsFound: feedItems.length,
            processedCount,
            errorCount,
            dailyLimit: stats.dailyLimit,
            processedToday: stats.processedToday + processedCount,
            remainingSlots: remainingSlots - processedCount
          },
          message: `Found ${feedItems.length} RSS items, processed ${processedCount} into blog posts (${remainingSlots - processedCount} slots remaining today)`
        })

      case 'reset-daily-limit':
        // Reset daily counter for testing/admin purposes
        const { automationWorkflowManager: wm } = await import('@/lib/automation/workflow-manager')
        wm.resetDailyCounterManually()
        
        logger.info('Daily limit reset via API', {
          tags: ['api', 'rss', 'monitoring']
        })
        
        return NextResponse.json({
          success: true,
          message: 'Daily limit reset successfully'
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Must be one of: start, stop, clear-cache, check-all-feeds' },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('Failed to control RSS monitoring', {
      tags: ['api', 'rss', 'monitoring', 'error'],
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        body: await request.json().catch(() => 'Unable to parse body')
      }
    })

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to control monitoring' 
      },
      { status: 500 }
    )
  }
} 