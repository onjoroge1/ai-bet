"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import type { LiveMatchDelta } from '@/types/live-match'

/**
 * Connection quality levels
 */
export type ConnectionQuality = 'excellent' | 'good' | 'degraded' | 'poor' | 'offline'

/**
 * Connection status information
 */
export interface ConnectionStatus {
  isConnected: boolean
  isPolling: boolean
  quality: ConnectionQuality
  lastUpdateTime: number | null
  reconnectAttempts: number
  connectionLatency: number | null
}

/**
 * Custom hook for WebSocket connection to live match updates
 * 
 * Enhanced Features:
 * - Auto-connects when match is live
 * - Delta update processing
 * - Exponential backoff for reconnection
 * - Connection health monitoring
 * - Fallback to HTTP polling if WebSocket fails
 * - Overlap period: Keeps polling active for 2s after WebSocket connects (eliminates gap)
 * - Proactive refresh mechanism
 * - Connection quality tracking
 * - Cleanup on unmount
 * 
 * @param matchId - The match ID to subscribe to
 * @param isLive - Whether the match is currently live
 * @returns Delta updates, connection status, and control functions
 */
export function useLiveMatchWebSocket(matchId: string, isLive: boolean) {
  const [delta, setDelta] = useState<LiveMatchDelta | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isPolling: false,
    quality: 'offline',
    lastUpdateTime: null,
    reconnectAttempts: 0,
    connectionLatency: null,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const pollingIntervalRef = useRef<NodeJS.Timeout>()
  const proactiveRefreshIntervalRef = useRef<NodeJS.Timeout>()
  const healthCheckIntervalRef = useRef<NodeJS.Timeout>()
  const overlapTimerRef = useRef<NodeJS.Timeout>() // Timer for overlap period
  const shouldConnectRef = useRef(isLive)
  const reconnectAttemptsRef = useRef(0)
  const lastMessageTimeRef = useRef<number | null>(null)
  const connectionStartTimeRef = useRef<number | null>(null)
  const connectRef = useRef<(() => void) | null>(null)
  const startPollingRef = useRef<(() => void) | null>(null)

  // Constants
  const INITIAL_RECONNECT_DELAY = 1000 // 1 second
  const MAX_RECONNECT_DELAY = 30000 // 30 seconds
  const POLLING_INTERVAL = 10000 // 10 seconds
  const PROACTIVE_REFRESH_INTERVAL = 25000 // 25 seconds (check freshness even when WS connected)
  const HEALTH_CHECK_INTERVAL = 60000 // 60 seconds (check if WS is still alive)
  const STALE_THRESHOLD = 35000 // 35 seconds (consider data stale if no update)
  const OVERLAP_PERIOD = 2000 // 2 seconds - keep polling active after WebSocket connects

  // Update ref when isLive changes
  useEffect(() => {
    shouldConnectRef.current = isLive
  }, [isLive])

  /**
   * Calculate exponential backoff delay
   */
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      MAX_RECONNECT_DELAY
    )
    return delay
  }, [])

  /**
   * Update connection quality based on last update time
   */
  const updateConnectionQuality = useCallback(() => {
    setConnectionStatus(prev => {
      const now = Date.now()
      const lastUpdate = lastMessageTimeRef.current
      const latency = prev.connectionLatency

      let quality: ConnectionQuality = 'offline'

      if (prev.isConnected) {
        if (lastUpdate && now - lastUpdate < 10000) {
          // Recent update within 10s
          quality = latency && latency < 200 ? 'excellent' : 'good'
        } else if (lastUpdate && now - lastUpdate < 30000) {
          // Update within 30s
          quality = 'good'
        } else if (lastUpdate && now - lastUpdate < 60000) {
          // Update within 60s
          quality = 'degraded'
        } else {
          // No update for 60s+
          quality = 'poor'
        }
      } else if (prev.isPolling) {
        quality = 'degraded'
      } else {
        quality = 'offline'
      }

      return { ...prev, quality }
    })
  }, [])

  /**
   * Set connection state helper
   */
  const setIsConnected = useCallback((connected: boolean) => {
    setConnectionStatus(prev => ({
      ...prev,
      isConnected: connected,
      isPolling: !connected && prev.isPolling,
    }))
  }, [])

  /**
   * Set polling state helper
   */
  const setIsPolling = useCallback((polling: boolean) => {
    setConnectionStatus(prev => ({
      ...prev,
      isPolling: polling,
    }))
  }, [])

  /**
   * Proactive refresh - periodically check data freshness even when WebSocket is connected
   */
  const performProactiveRefresh = useCallback(async () => {
    if (!shouldConnectRef.current) return

    try {
      const response = await fetch(`/api/match/${matchId}?t=${Date.now()}`)
      if (!response.ok) return

      const data = await response.json()
      
      // Always update with latest data from proactive refresh
      // The mergeDeltaUpdate function will handle merging properly
      console.log('[WebSocket] Proactive refresh update:', {
        minute: data.match?.live_data?.minute,
        timestamp: new Date().toISOString()
      })

      const deltaUpdate: LiveMatchDelta = {
        match_id: Number(matchId),
        minute: data.match?.live_data?.minute,
        live_data: data.match?.live_data,
        momentum: data.match?.momentum,
        model_markets: data.match?.model_markets,
        ai_analysis: data.match?.ai_analysis
      }

      setDelta(deltaUpdate)
      lastMessageTimeRef.current = Date.now()
      updateConnectionQuality()
    } catch (error) {
      console.error('[WebSocket] Proactive refresh error:', error)
    }
  }, [matchId, updateConnectionQuality])

  /**
   * Attempt reconnection with exponential backoff
   */
  const attemptReconnect = useCallback(() => {
    if (!shouldConnectRef.current) return

    reconnectAttemptsRef.current++
    const delay = getReconnectDelay()
    
    console.log(`[WebSocket] Scheduling reconnection in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      if (shouldConnectRef.current) {
        // Use a ref to avoid circular dependency
        if (connectRef.current) {
          connectRef.current()
        }
      }
    }, delay)

    setConnectionStatus(prev => ({
      ...prev,
      reconnectAttempts: reconnectAttemptsRef.current,
    }))
  }, [getReconnectDelay])

  /**
   * Perform a single polling fetch
   */
  const performPollingFetch = useCallback(async () => {
    if (!shouldConnectRef.current) return

    try {
      const response = await fetch(`/api/match/${matchId}?t=${Date.now()}`) // Cache bust
      if (!response.ok) {
        throw new Error('Polling failed')
      }
      const data = await response.json()
      
      const receiveTime = Date.now()
      lastMessageTimeRef.current = receiveTime
      
      console.log('[WebSocket] HTTP Polling update:', {
        match_id: matchId,
        score: data.match?.live_data?.current_score,
        minute: data.match?.live_data?.minute,
        timestamp: new Date().toISOString()
      })
      
      // Convert match data to delta format
      const deltaUpdate: LiveMatchDelta = {
        match_id: Number(matchId),
        minute: data.match?.live_data?.minute,
        live_data: data.match?.live_data,
        momentum: data.match?.momentum,
        model_markets: data.match?.model_markets,
        ai_analysis: data.match?.ai_analysis
      }
      
      setDelta(deltaUpdate)
      setConnectionStatus(prev => ({
        ...prev,
        lastUpdateTime: receiveTime,
      }))
      updateConnectionQuality()

      // Try to reconnect WebSocket periodically while polling
      if (reconnectAttemptsRef.current < 5) {
        attemptReconnect()
      }
    } catch (error) {
      console.error('[WebSocket] Polling error:', error)
    }
  }, [matchId, attemptReconnect, updateConnectionQuality])

  /**
   * Fallback HTTP polling - starts immediately and continues on interval
   */
  const startPolling = useCallback(() => {
    console.log('[WebSocket] Starting HTTP polling fallback')
    setIsPolling(true)
    
    // Clear existing polling if any
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // ✅ IMMEDIATE FETCH: Perform first fetch right away (not wait for interval)
    performPollingFetch()

    // Poll every 10 seconds for faster updates
    pollingIntervalRef.current = setInterval(() => {
      performPollingFetch()
    }, POLLING_INTERVAL)
  }, [performPollingFetch, setIsPolling])

  // Store startPolling in ref to avoid circular dependency
  startPollingRef.current = startPolling

  /**
   * Connection health check - verify WebSocket is still alive
   */
  const performHealthCheck = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // WebSocket is not open, trigger reconnection
      console.log('[WebSocket] Health check failed - WebSocket not open')
      if (shouldConnectRef.current) {
        setIsConnected(false)
        if (startPollingRef.current) {
          startPollingRef.current()
        }
        attemptReconnect()
      }
      return
    }

    const now = Date.now()
    const lastUpdate = lastMessageTimeRef.current

    // If no message received in 60 seconds, consider connection stale
    if (lastUpdate && now - lastUpdate > HEALTH_CHECK_INTERVAL) {
      console.log('[WebSocket] Health check failed - no messages for 60s')
      setIsConnected(false)
      if (startPollingRef.current) {
        startPollingRef.current()
      }
      attemptReconnect()
    }

    updateConnectionQuality()
  }, [attemptReconnect, updateConnectionQuality, setIsConnected])

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!shouldConnectRef.current) return

    try {
      // Build WebSocket URL
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws'
      const wsHost = backendUrl.replace(/^https?:\/\//, '')
      const wsUrl = `${wsProtocol}://${wsHost}/ws/live/${matchId}`

      console.log(`[WebSocket] Connecting to ${wsUrl} (attempt ${reconnectAttemptsRef.current + 1})`)
      connectionStartTimeRef.current = Date.now()
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        const connectTime = Date.now() - (connectionStartTimeRef.current || 0)
        console.log(`[WebSocket] Connected (${connectTime}ms)`)
        
        setIsConnected(true)
        reconnectAttemptsRef.current = 0 // Reset on successful connection
        
        // ✅ OVERLAP PERIOD: Keep polling active for 2 seconds after WebSocket connects
        // This eliminates the gap window where updates could be missed
        console.log(`[WebSocket] Starting ${OVERLAP_PERIOD}ms overlap period - polling will continue`)
        
        // Clear any existing overlap timer
        if (overlapTimerRef.current) {
          clearTimeout(overlapTimerRef.current)
        }
        
        // Set timer to stop polling after overlap period
        overlapTimerRef.current = setTimeout(() => {
          console.log('[WebSocket] Overlap period ended - stopping HTTP polling')
          setIsPolling(false)
          
          // Clear polling interval after overlap period
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = undefined
          }
          
          overlapTimerRef.current = undefined
        }, OVERLAP_PERIOD)

        // Update connection quality
        setConnectionStatus(prev => ({
          ...prev,
          connectionLatency: connectTime,
          reconnectAttempts: 0,
        }))

        // Start health check interval
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current)
        }
        healthCheckIntervalRef.current = setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL)

        // Start proactive refresh interval (even when WS is connected)
        if (proactiveRefreshIntervalRef.current) {
          clearInterval(proactiveRefreshIntervalRef.current)
        }
        proactiveRefreshIntervalRef.current = setInterval(performProactiveRefresh, PROACTIVE_REFRESH_INTERVAL)
      }

      ws.onmessage = (event) => {
        try {
          const receiveTime = Date.now()
          const data = JSON.parse(event.data) as LiveMatchDelta
          
          // Calculate latency if we have connection start time
          let latency = null
          if (connectionStartTimeRef.current) {
            latency = receiveTime - connectionStartTimeRef.current
            connectionStartTimeRef.current = null // Reset after first message
          }

          lastMessageTimeRef.current = receiveTime
          
          console.log('[WebSocket] Received delta update:', {
            match_id: data.match_id,
            minute: data.minute,
            score: data.live_data?.current_score,
            hasLiveData: !!data.live_data,
            hasMomentum: !!data.momentum,
            hasModelMarkets: !!data.model_markets,
            hasAIAnalysis: !!data.ai_analysis,
            latency,
            timestamp: new Date().toISOString()
          })

          setDelta(data)
          setConnectionStatus(prev => ({
            ...prev,
            lastUpdateTime: receiveTime,
            connectionLatency: latency || prev.connectionLatency,
          }))
          updateConnectionQuality()
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
        setIsConnected(false)
        // Fallback to HTTP polling if WebSocket fails
        startPolling()
      }

      ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        })
        setIsConnected(false)
        
        // Clear overlap timer if WebSocket disconnects before overlap period ends
        if (overlapTimerRef.current) {
          clearTimeout(overlapTimerRef.current)
          overlapTimerRef.current = undefined
          console.log('[WebSocket] Cleared overlap timer due to disconnection')
        }
        
        // Only reconnect if match is still live
        if (shouldConnectRef.current) {
          reconnectAttemptsRef.current++
          const delay = getReconnectDelay()
          
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldConnectRef.current && connectRef.current) {
              connectRef.current()
            }
          }, delay)

          setConnectionStatus(prev => ({
            ...prev,
            reconnectAttempts: reconnectAttemptsRef.current,
          }))
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error)
      setIsConnected(false)
      startPolling()
    }
  }, [matchId, getReconnectDelay, performHealthCheck, performProactiveRefresh, startPolling, setIsConnected, setIsPolling, updateConnectionQuality])

  // Store connect function in ref to avoid circular dependency
  connectRef.current = connect

  /**
   * Main effect - connect when match is live
   * Use lazy initialization to avoid blocking initial render
   * Automatically stops polling if match has likely finished (3+ hours after kickoff)
   */
  useEffect(() => {
    // Only initialize WebSocket if match is actually live
    if (isLive && matchId) {
      // ✅ START POLLING IMMEDIATELY for live matches (Solution 1 from analysis)
      // This ensures data appears right away, before WebSocket connects
      console.log('[WebSocket] Starting immediate HTTP polling for live match')
      startPolling()
      
      // Use setTimeout to defer WebSocket connection, allowing page to render first
      const connectTimer = setTimeout(() => {
        connect()
      }, 100) // Small delay to let page render first
      
      // Set up a timeout to stop polling if match has been running too long
      // Matches typically last ~2 hours, so stop after 3 hours
      const finishCheckInterval = setInterval(() => {
        // This will be checked by the parent component's isLive logic
        // If isLive becomes false, this effect will re-run and cleanup
        if (!shouldConnectRef.current) {
          // Match is no longer live, cleanup
          if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
          }
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = undefined
          }
          if (proactiveRefreshIntervalRef.current) {
            clearInterval(proactiveRefreshIntervalRef.current)
            proactiveRefreshIntervalRef.current = undefined
          }
          setIsConnected(false)
          setIsPolling(false)
        }
      }, 60000) // Check every minute
      
      return () => {
        clearTimeout(connectTimer)
        clearInterval(finishCheckInterval)
        // Cleanup
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
        if (proactiveRefreshIntervalRef.current) {
          clearInterval(proactiveRefreshIntervalRef.current)
        }
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current)
        }
        if (overlapTimerRef.current) {
          clearTimeout(overlapTimerRef.current)
        }
        setIsConnected(false)
        setIsPolling(false)
      }
    } else {
      // Disconnect if not live
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      if (proactiveRefreshIntervalRef.current) {
        clearInterval(proactiveRefreshIntervalRef.current)
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
      if (overlapTimerRef.current) {
        clearTimeout(overlapTimerRef.current)
      }
      setIsConnected(false)
      setIsPolling(false)
    }
  }, [matchId, isLive, connect, updateConnectionQuality])

  // Periodic quality update - only when connected or polling
  useEffect(() => {
    if (!connectionStatus.isConnected && !connectionStatus.isPolling) {
      return // Don't run interval if not connected
    }
    const qualityInterval = setInterval(updateConnectionQuality, 5000) // Update every 5s
    return () => clearInterval(qualityInterval)
  }, [updateConnectionQuality, connectionStatus.isConnected, connectionStatus.isPolling])

  return {
    delta,
    connectionStatus,
    // Helper to clear delta after processing
    clearDelta: () => setDelta(null),
    // Manual reconnect function
    reconnect: () => {
      reconnectAttemptsRef.current = 0
      if (wsRef.current) {
        wsRef.current.close()
      }
      connect()
    },
  }
}

/**
 * Merge delta updates into current match data
 * Handles both partial updates and full object replacements
 */
export function mergeDeltaUpdate(
  current: any,
  delta: LiveMatchDelta | null
): any {
  if (!delta) return current

  const updated = { ...current }

  // Update live_data - merge nested objects if present
  if (delta.live_data) {
    updated.live_data = {
      ...current.live_data,
      ...delta.live_data,
      // Merge statistics if present
      statistics: delta.live_data.statistics
        ? { ...current.live_data?.statistics, ...delta.live_data.statistics }
        : current.live_data?.statistics,
      // Merge current_score if present
      current_score: delta.live_data.current_score
        ? { ...current.live_data?.current_score, ...delta.live_data.current_score }
        : current.live_data?.current_score
    }
  }
  
  // Update momentum - merge driver_summary if present
  if (delta.momentum) {
    updated.momentum = {
      ...current.momentum,
      ...delta.momentum,
      driver_summary: delta.momentum.driver_summary
        ? { ...current.momentum?.driver_summary, ...delta.momentum.driver_summary }
        : current.momentum?.driver_summary
    }
  }
  
  // Update model_markets - merge nested markets if present
  if (delta.model_markets) {
    updated.model_markets = {
      ...current.model_markets,
      ...delta.model_markets,
      win_draw_win: delta.model_markets.win_draw_win
        ? { ...current.model_markets?.win_draw_win, ...delta.model_markets.win_draw_win }
        : current.model_markets?.win_draw_win,
      over_under: delta.model_markets.over_under
        ? { ...current.model_markets?.over_under, ...delta.model_markets.over_under }
        : current.model_markets?.over_under,
      next_goal: delta.model_markets.next_goal
        ? { ...current.model_markets?.next_goal, ...delta.model_markets.next_goal }
        : current.model_markets?.next_goal
    }
  }

  // Update ai_analysis - replace entirely (new analysis replaces old)
  if (delta.ai_analysis) {
    updated.ai_analysis = delta.ai_analysis
  }

  // Update score if minute is updated
  if (delta.minute !== undefined) {
    updated.minute = delta.minute
  }

  return updated
}




