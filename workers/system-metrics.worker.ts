import { parentPort } from 'worker_threads'
import { getSystemMetrics } from '../lib/metrics'
import { EVENT_SYSTEM_METRICS } from '../types/system-health'

let retryCount = 0
const MAX_RETRIES = 5
const RETRY_DELAY = 5000

// Main worker loop
async function runWorker() {
  console.log('[Worker] Starting system metrics worker...')
  try {
    while (true) {
      console.log('[Worker] Starting metrics collection cycle...')
      const metrics = await getSystemMetrics()
      console.log('[Worker] Metrics gathered successfully:', {
        id: metrics.id,
        serverStatus: metrics.serverStatus,
        cpuUsage: metrics.cpuUsage.toFixed(2) + '%',
        memoryUsage: metrics.memoryUsage.toFixed(2) + '%',
        diskUsage: metrics.diskUsage.toFixed(2) + '%',
        activeConnections: metrics.activeConnections,
        timestamp: new Date().toISOString()
      })
      
      if (parentPort) {
        console.log('[Worker] Sending metrics to parent process...')
        parentPort.postMessage({ type: EVENT_SYSTEM_METRICS, data: metrics })
        console.log('[Worker] Metrics sent successfully')
      } else {
        console.error('[Worker] ERROR: No parent port available to send metrics')
      }
      
      console.log('[Worker] Waiting 5 seconds before next collection...')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  } catch (error) {
    console.error('[Worker] ERROR in metrics collection:', error)
    if (parentPort) {
      console.log('[Worker] Sending error to parent process...')
      parentPort.postMessage({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
    
    // Implement exponential backoff for retries
    if (retryCount < MAX_RETRIES) {
      retryCount++
      const delay = RETRY_DELAY * Math.pow(2, retryCount - 1)
      console.log(`[Worker] Retrying in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, delay))
      runWorker()
    } else {
      console.error('[Worker] Max retries reached, worker stopping')
      process.exit(1)
    }
  }
}

// Start the worker
if (parentPort) {
  console.log('[Worker] Parent port available, starting worker process...')
  runWorker()
} else {
  console.error('[Worker] ERROR: No parent port available, worker cannot start')
} 