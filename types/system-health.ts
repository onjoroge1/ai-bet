export type SystemHealth = {
  id: string
  serverStatus: "healthy" | "degraded" | "down"
  apiResponseTime: number
  databaseStatus: "healthy" | "degraded" | "down"
  errorRate: number
  activeConnections: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  lastCheckedAt: Date
  createdAt: Date
  updatedAt: Date
}

export const EVENT_SYSTEM_METRICS = 'system-metrics'

export const HEALTH_THRESHOLDS = {
  CPU: { warning: 70, critical: 90 },
  ERROR_RATE: { warning: 2, critical: 5 },
  MEMORY: { warning: 80, critical: 90 },
  DISK: { warning: 80, critical: 90 }
} as const 