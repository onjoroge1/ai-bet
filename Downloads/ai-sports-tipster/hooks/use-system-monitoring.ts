"use client"

import { useEffect, useState, useCallback } from 'react'
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
  const [isLoading, setIsLoading] = useState(false)
  const [lastError, setLastError] = useState<Error | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/system-health/current')
      if (!response.ok) {
        throw new Error(`Failed to fetch system metrics: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      
      const metrics = {
        ...data,
        lastCheckedAt: new Date(data.lastCheckedAt),
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt)
      }
      
      setMetrics(metrics)
      setLastUpdateTime(new Date())
      setLastError(null)
    } catch (error) {
      console.error('Error fetching system metrics:', error)
      setLastError(error instanceof Error ? error : new Error('Unknown error'))
      toast.error('Failed to fetch system metrics')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchMetrics()

    // Set up polling interval (every 30 seconds)
    const intervalId = setInterval(fetchMetrics, 30000)

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchMetrics])

  const fetchHistoricalData = useCallback(async (hours: number = 24) => {
    try {
      const response = await fetch(`/api/admin/system-health?hours=${hours}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch historical data: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
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
    isLoading,
    lastError,
    lastUpdateTime,
    fetchHistoricalData,
    refreshMetrics: fetchMetrics
  }
} 