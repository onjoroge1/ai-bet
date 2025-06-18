"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Loader2, Server, Database, Activity, Cpu, HardDrive, HardDriveIcon } from "lucide-react"
import { toast } from "sonner"
import { useSystemMonitoring } from "@/hooks/use-system-monitoring"

type SystemHealth = {
  id: string
  serverStatus: string
  apiResponseTime: number
  databaseStatus: string
  errorRate: number
  activeConnections: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  lastCheckedAt: string
  createdAt: string
  updatedAt: string
}

export function AdminSystemMonitoring() {
  const { metrics: currentMetrics, isLoading, lastError, fetchHistoricalData } = useSystemMonitoring()
  const [historicalData, setHistoricalData] = useState<SystemHealth[]>([])
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(true)

  useEffect(() => {
    const loadHistoricalData = async () => {
      const data = await fetchHistoricalData()
      setHistoricalData(data)
      setIsLoadingHistorical(false)
    }

    loadHistoricalData()
  }, [fetchHistoricalData])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  if (isLoading || isLoadingHistorical) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-emerald-400 flex items-center">
          <Server className="w-6 h-6 mr-3 text-emerald-500" />
          System Monitoring
          {lastError && (
            <Badge variant="outline" className="ml-2 bg-red-500/20 text-red-400 border-red-500/30">
              Error
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Server Status */}
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Server className="w-5 h-5 mr-2 text-emerald-400" />
                  <span className="text-slate-300">Server Status</span>
                </div>
                <Badge className={getStatusColor(currentMetrics?.serverStatus || '')}>
                  {currentMetrics?.serverStatus || 'Unknown'}
                </Badge>
              </div>
              <Progress
                value={currentMetrics?.cpuUsage || 0}
                className="h-2 bg-slate-700"
              />
              <div className="mt-2 text-sm text-slate-400">
                CPU Usage: {currentMetrics?.cpuUsage.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          {/* Database Status */}
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Database className="w-5 h-5 mr-2 text-emerald-400" />
                  <span className="text-slate-300">Database Status</span>
                </div>
                <Badge className={getStatusColor(currentMetrics?.databaseStatus || '')}>
                  {currentMetrics?.databaseStatus || 'Unknown'}
                </Badge>
              </div>
              <Progress
                value={currentMetrics?.errorRate || 0}
                className="h-2 bg-slate-700"
              />
              <div className="mt-2 text-sm text-slate-400">
                Error Rate: {currentMetrics?.errorRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          {/* System Resources */}
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-emerald-400" />
                  <span className="text-slate-300">System Resources</span>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <Cpu className="w-4 h-4 mr-2 text-slate-400" />
                      <span className="text-sm text-slate-400">CPU</span>
                    </div>
                    <span className="text-sm text-slate-400">{currentMetrics?.cpuUsage.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={currentMetrics?.cpuUsage || 0}
                    className="h-1 bg-slate-700"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <HardDriveIcon className="w-4 h-4 mr-2 text-slate-400" />
                      <span className="text-sm text-slate-400">Memory</span>
                    </div>
                    <span className="text-sm text-slate-400">{currentMetrics?.memoryUsage.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={currentMetrics?.memoryUsage || 0}
                    className="h-1 bg-slate-700"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <HardDrive className="w-4 h-4 mr-2 text-slate-400" />
                      <span className="text-sm text-slate-400">Disk</span>
                    </div>
                    <span className="text-sm text-slate-400">{currentMetrics?.diskUsage.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={currentMetrics?.diskUsage || 0}
                    className="h-1 bg-slate-700"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Historical Data Chart */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-300">
              System Performance (Last 24 Hours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="createdAt"
                    stroke="#94a3b8"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.375rem',
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cpuUsage"
                    stroke="#10b981"
                    name="CPU Usage"
                  />
                  <Line
                    type="monotone"
                    dataKey="memoryUsage"
                    stroke="#3b82f6"
                    name="Memory Usage"
                  />
                  <Line
                    type="monotone"
                    dataKey="errorRate"
                    stroke="#ef4444"
                    name="Error Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
} 