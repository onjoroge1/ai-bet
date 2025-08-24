import { MatchResultsService } from './match-results.service'

export class CronService {
  private static intervals: NodeJS.Timeout[] = []

  /**
   * Start all scheduled tasks
   */
  static startScheduledTasks() {
    console.log('Starting scheduled tasks...')
    
    // Sync match results every 2 hours
    this.intervals.push(
      setInterval(async () => {
        try {
          console.log('Running scheduled match results sync...')
          await this.syncMatchResults()
        } catch (error) {
          console.error('Error in scheduled match results sync:', error)
        }
      }, 2 * 60 * 60 * 1000) // 2 hours
    )

    // Clean up expired news every hour
    this.intervals.push(
      setInterval(async () => {
        try {
          console.log('Running scheduled cleanup of expired news...')
          await MatchResultsService.cleanupExpiredNews()
        } catch (error) {
          console.error('Error in scheduled cleanup:', error)
        }
      }, 60 * 60 * 1000) // 1 hour
    )

    console.log('Scheduled tasks started successfully')
  }

  /**
   * Stop all scheduled tasks
   */
  static stopScheduledTasks() {
    console.log('Stopping scheduled tasks...')
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals = []
    console.log('Scheduled tasks stopped')
  }

  /**
   * Run match results sync manually
   */
  private static async syncMatchResults() {
    try {
      // Fetch new matches from RapidAPI
      const matches = await MatchResultsService.fetchCompletedMatches()
      await MatchResultsService.storeCompletedMatches(matches)
      
      // Sync to breaking news
      await MatchResultsService.syncToBreakingNews()
      
      console.log(`Scheduled sync completed: ${matches.length} matches processed`)
    } catch (error) {
      console.error('Error in scheduled sync:', error)
    }
  }

  /**
   * Get status of scheduled tasks
   */
  static getStatus() {
    return {
      isRunning: this.intervals.length > 0,
      activeIntervals: this.intervals.length,
      nextSyncIn: this.intervals.length > 0 ? '2 hours' : 'Not running',
      nextCleanupIn: this.intervals.length > 0 ? '1 hour' : 'Not running'
    }
  }
}
