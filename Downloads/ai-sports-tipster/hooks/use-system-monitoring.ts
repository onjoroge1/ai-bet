"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { EVENT_SYSTEM_METRICS } from '@/types/system-health'

type SystemStatus = "healthy" | "degraded" | "down"

type SystemHealth = {
  id: string
  serverStatus: SystemStatus
  apiResponseTime: number
  databaseStatus: SystemStatus
  errorRate: number
  activeConnections: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  lastCheckedAt: Date
  createdAt: Date
  updatedAt: Date
}

export function useSystemMonitoring() {
  const [metrics, setMetrics] = useState<SystemHealth | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastError, setLastError] = useState<Error | null>(null)
  
  const socketRef = useRef<Socket | null>(null)
  const toastIdRef = useRef<string | number | null>(null)
  const metricsRef = useRef<SystemHealth | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  // Throttled metrics update
  const updateMetrics = useCallback((data: SystemHealth) => {
    metricsRef.current = data
    if (!updateTimeoutRef.current) {
      updateTimeoutRef.current = setTimeout(() => {
        setMetrics(metricsRef.current)
        updateTimeoutRef.current = null
      }, 1000) // Update UI at most once per second
    }
  }, [])

  // Connection status toast
  const showConnectionToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current)
    }
    toastIdRef.current = toast[type](message, {
      id: 'connection-status',
      duration: 3000,
    })
  }, [])

  useEffect(() => {
    console.log('[SystemMonitoring] Initializing system monitoring hook...')
    const socketUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    console.log('[SystemMonitoring] Connecting to WebSocket server at:', socketUrl)

    // Initialize socket connection
    const socketInstance = io(socketUrl, {
      path: '/api/socket/io',
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
      autoConnect: true
    })

    // Log connection events
    socketInstance.on('connect', () => {
      console.log('[SystemMonitoring] WebSocket connected successfully')
      setConnected(true)
      setLastError(null)
      reconnectAttemptsRef.current = 0
      showConnectionToast('System monitoring connected', 'success')
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('[SystemMonitoring] WebSocket disconnected:', reason)
      setConnected(false)
      showConnectionToast('System monitoring disconnected', 'error')
    })

    socketInstance.on('connect_error', (error) => {
      console.error('[SystemMonitoring] WebSocket connection error:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      })
      setConnected(false)
      setLastError(error)
      reconnectAttemptsRef.current++
      
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log('[SystemMonitoring] Max reconnect attempts reached, continuing to retry...')
        showConnectionToast('Retrying indefinitely...', 'error')
        reconnectAttemptsRef.current = 0 // Reset and keep trying
      } else {
        console.log(`[SystemMonitoring] Connection attempt ${reconnectAttemptsRef.current} of ${maxReconnectAttempts} failed`)
        showConnectionToast(`Connection attempt ${reconnectAttemptsRef.current} of ${maxReconnectAttempts} failed`, 'error')
      }
    })

    socketInstance.on('reconnect', () => {
      console.log('[SystemMonitoring] WebSocket reconnected successfully')
      setConnected(true)
      setLastError(null)
      showConnectionToast('System monitoring reconnected', 'success')
    })

    socketInstance.on('error', (error) => {
      console.error('[SystemMonitoring] WebSocket error:', error)
      setLastError(error)
    })

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log('[SystemMonitoring] Attempting to reconnect:', attemptNumber)
    })

    socketInstance.on('reconnect_failed', () => {
      console.error('[SystemMonitoring] Failed to reconnect after all attempts')
      showConnectionToast('Failed to reconnect to system monitoring', 'error')
    })

    // Listen for system metrics
    socketInstance.on(EVENT_SYSTEM_METRICS, (data: SystemHealth) => {
      console.log('[SystemMonitoring] Received system metrics:', {
        id: data.id,
        serverStatus: data.serverStatus,
        cpuUsage: data.cpuUsage.toFixed(2) + '%',
        memoryUsage: data.memoryUsage.toFixed(2) + '%',
        diskUsage: data.diskUsage.toFixed(2) + '%',
        activeConnections: data.activeConnections,
        timestamp: new Date().toISOString()
      })
      
      // Convert string dates to Date objects with null safety
      const metrics = {
        ...data,
        lastCheckedAt: new Date(data.lastCheckedAt ?? Date.now()),
        createdAt: new Date(data.createdAt ?? Date.now()),
        updatedAt: new Date(data.updatedAt ?? Date.now())
      }
      console.log('[SystemMonitoring] Processing metrics update...')
      updateMetrics(metrics)
    })

    socketRef.current = socketInstance

    // Cleanup on unmount
    return () => {
      console.log('[SystemMonitoring] Cleaning up WebSocket connection...')
      if (socketInstance.connected) {
        console.log('[SystemMonitoring] Disconnecting active WebSocket connection')
        socketInstance.disconnect()
      }
      
      // Remove all listeners
      console.log('[SystemMonitoring] Removing event listeners...')
      socketInstance.off('connect')
      socketInstance.off('disconnect')
      socketInstance.off('connect_error')
      socketInstance.off('error')
      socketInstance.off(EVENT_SYSTEM_METRICS)
      socketInstance.off('reconnect')
      socketInstance.off('reconnect_attempt')
      socketInstance.off('reconnect_failed')
      
      // Clear any pending updates
      if (updateTimeoutRef.current) {
        console.log('[SystemMonitoring] Clearing pending metrics update')
        clearTimeout(updateTimeoutRef.current)
        updateTimeoutRef.current = null
      }
      
      // Clear any active toasts
      if (toastIdRef.current) {
        console.log('[SystemMonitoring] Clearing active toast')
        toast.dismiss(toastIdRef.current)
      }
    }
  }, [showConnectionToast, updateMetrics])

  const fetchHistoricalData = useCallback(async (hours: number = 24) => {
    try {
      console.log('Fetching historical data...')
      const response = await fetch(`/api/admin/system-health?hours=${hours}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch historical data: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      console.log('Fetched historical data:', data)
      return data.historical.map((item: any) => ({
        ...item,
        lastCheckedAt: new Date(item.lastCheckedAt),
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      }))
    } catch (error) {
      console.error('Error fetching historical data:', error)
      setLastError(error instanceof Error ? error : new Error('Unknown error'))
      toast.error('Failed to fetch historical data')
      return []
    }
  }, [])

  return {
    metrics,
    connected,
    lastError,
    fetchHistoricalData,
    socket: socketRef.current
  }
} 