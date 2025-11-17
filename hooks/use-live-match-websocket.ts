"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import type { LiveMatchDelta } from '@/types/live-match'

/**
 * Custom hook for WebSocket connection to live match updates
 * 
 * Features:
 * - Auto-connects when match is live
 * - Delta update processing
 * - Automatic reconnection on disconnect
 * - Fallback to HTTP polling if WebSocket fails
 * - Cleanup on unmount
 * 
 * @param matchId - The match ID to subscribe to
 * @param isLive - Whether the match is currently live
 * @returns Delta updates from the WebSocket
 */
export function useLiveMatchWebSocket(matchId: string, isLive: boolean) {
  const [delta, setDelta] = useState<LiveMatchDelta | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const pollingIntervalRef = useRef<NodeJS.Timeout>()
  const shouldConnectRef = useRef(isLive)

  // Update ref when isLive changes
  useEffect(() => {
    shouldConnectRef.current = isLive
  }, [isLive])

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

      console.log(`[WebSocket] Connecting to ${wsUrl}`)
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[WebSocket] Connected')
        setIsConnected(true)
        // Clear any polling interval if WebSocket connects
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = undefined
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as LiveMatchDelta
          console.log('[WebSocket] Received delta update:', {
            match_id: data.match_id,
            minute: data.minute,
            score: data.live_data?.current_score,
            hasLiveData: !!data.live_data,
            hasMomentum: !!data.momentum,
            hasModelMarkets: !!data.model_markets,
            hasAIAnalysis: !!data.ai_analysis,
            timestamp: new Date().toISOString()
          })
          setDelta(data)
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error)
        }
      }

      ws.onerror = () => {
        // Silently handle WebSocket errors (connection refused is expected when backend WS isn't running)
        // HTTP polling fallback will handle updates
        setIsConnected(false)
        // Fallback to HTTP polling if WebSocket fails
        startPolling()
      }

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        setIsConnected(false)
        
        // Only reconnect if match is still live
        if (shouldConnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, 5000) // Reconnect after 5s
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error)
      startPolling()
    }
  }, [matchId])

  /**
   * Fallback HTTP polling
   */
  const startPolling = useCallback(() => {
    console.log('[WebSocket] Starting HTTP polling fallback')
    
    // Clear existing polling if any
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // Poll every 30 seconds for faster updates
    pollingIntervalRef.current = setInterval(async () => {
      if (!shouldConnectRef.current) return

      try {
        const response = await fetch(`/api/match/${matchId}?t=${Date.now()}`) // Cache bust
        if (!response.ok) {
          throw new Error('Polling failed')
        }
        const data = await response.json()
        
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
      } catch (error) {
        console.error('[WebSocket] Polling error:', error)
      }
    }, 10000) // 10 seconds for faster live updates
  }, [matchId])

  /**
   * Main effect - connect when match is live
   */
  useEffect(() => {
    if (isLive && matchId) {
      connect()
    } else {
      // Disconnect if not live
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setIsConnected(false)
    }

    // Cleanup
    return () => {
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
    }
  }, [matchId, isLive, connect])

  return {
    delta,
    isConnected,
    // Helper to clear delta after processing
    clearDelta: () => setDelta(null)
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




