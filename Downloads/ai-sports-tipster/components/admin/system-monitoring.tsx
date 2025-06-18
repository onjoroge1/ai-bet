"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Server, Database, Wifi, HardDrive, Cpu, Activity, AlertTriangle, CheckCircle } from "lucide-react"
import { useSystemMonitoring } from "@/hooks/use-system-monitoring"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { HardDriveIcon } from "lucide-react"
import { toast } from "sonner"

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

  if (!currentMetrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-400">No metrics available</div>
      </div>
    )
  }

  const systemMetrics = [
    {
      name: "API Server",
      status: currentMetrics.serverStatus || 'unknown',
      uptime: `${currentMetrics.apiResponseTime.toFixed(0)}ms`,
      icon: Server,
      color: currentMetrics.serverStatus === 'healthy' ? 'emerald' : 
             currentMetrics.serverStatus === 'degraded' ? 'yellow' : 'red',
    },
    {
      name: "Database",
      status: currentMetrics.databaseStatus || 'unknown',
      uptime: `${currentMetrics.errorRate.toFixed(1)}% error rate`,
      icon: Database,
      color: currentMetrics.databaseStatus === 'healthy' ? 'emerald' : 
             currentMetrics.databaseStatus === 'degraded' ? 'yellow' : 'red',
    },
    {
      name: "System Resources",
      status: (currentMetrics.cpuUsage ?? 0) > 90 ? 'down' : 
              (currentMetrics.cpuUsage ?? 0) > 70 ? 'degraded' : 'healthy',
      uptime: `${(currentMetrics.cpuUsage ?? 0).toFixed(1)}% CPU, ${(currentMetrics.memoryUsage ?? 0).toFixed(1)}% Memory`,
      icon: Cpu,
      color: (currentMetrics.cpuUsage ?? 0) > 90 ? 'red' : 
             (currentMetrics.cpuUsage ?? 0) > 70 ? 'yellow' : 'emerald',
    },
    {
      name: "Active Connections",
      status: (currentMetrics.activeConnections ?? 0) > 90 ? 'degraded' : 'healthy',
      uptime: `${currentMetrics.activeConnections ?? 0} connections`,
      icon: Wifi,
      color: (currentMetrics.activeConnections ?? 0) > 90 ? 'yellow' : 'emerald',
    },
    {
      name: "Storage",
      status: (currentMetrics.diskUsage ?? 0) > 90 ? 'down' : 
              (currentMetrics.diskUsage ?? 0) > 70 ? 'degraded' : 'healthy',
      uptime: `${(currentMetrics.diskUsage ?? 0).toFixed(1)}% used`,
      icon: HardDrive,
      color: (currentMetrics.diskUsage ?? 0) > 90 ? 'red' : 
             (currentMetrics.diskUsage ?? 0) > 70 ? 'yellow' : 'emerald',
    },
  ]

  const alerts = [
    ...(currentMetrics.errorRate > 2 ? [{
      type: "warning",
      message: `High error rate detected: ${currentMetrics.errorRate.toFixed(1)}%`,
      time: "Just now",
    }] : []),
    ...(currentMetrics.cpuUsage > 70 ? [{
      type: "warning",
      message: `High CPU usage: ${currentMetrics.cpuUsage.toFixed(1)}%`,
      time: "Just now",
    }] : []),
    ...(currentMetrics.memoryUsage > 90 ? [{
      type: "warning",
      message: `High memory usage: ${currentMetrics.memoryUsage.toFixed(1)}%`,
      time: "Just now",
    }] : []),
    ...(currentMetrics.diskUsage > 85 ? [{
      type: "warning",
      message: `Storage usage approaching limit: ${currentMetrics.diskUsage.toFixed(1)}%`,
      time: "Just now",
    }] : []),
  ]

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
                <Badge className={getStatusColor(currentMetrics.serverStatus)}>
                  {currentMetrics.serverStatus}
                </Badge>
              </div>
              <Progress
                value={currentMetrics.cpuUsage}
                className="h-2 bg-slate-700"
              />
              <div className="mt-2 text-sm text-slate-400">
                CPU Usage: {currentMetrics.cpuUsage.toFixed(1)}%
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
                <Badge className={getStatusColor(currentMetrics.databaseStatus)}>
                  {currentMetrics.databaseStatus}
                </Badge>
              </div>
              <Progress
                value={currentMetrics.errorRate}
                className="h-2 bg-slate-700"
              />
              <div className="mt-2 text-sm text-slate-400">
                Error Rate: {currentMetrics.errorRate.toFixed(1)}%
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
                    <span className="text-sm text-slate-400">{currentMetrics.cpuUsage.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={currentMetrics.cpuUsage}
                    className="h-1 bg-slate-700"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <HardDriveIcon className="w-4 h-4 mr-2 text-slate-400" />
                      <span className="text-sm text-slate-400">Memory</span>
                    </div>
                    <span className="text-sm text-slate-400">{currentMetrics.memoryUsage.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={currentMetrics.memoryUsage}
                    className="h-1 bg-slate-700"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <HardDrive className="w-4 h-4 mr-2 text-slate-400" />
                      <span className="text-sm text-slate-400">Disk</span>
                    </div>
                    <span className="text-sm text-slate-400">{currentMetrics.diskUsage.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={currentMetrics.diskUsage}
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
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="memoryUsage"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="diskUsage"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* System Metrics */}
        <div className="space-y-3 mb-6">
          {systemMetrics.map((metric, index) => (
            <div key={index} className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      metric.color === "emerald"
                        ? "bg-emerald-500/20"
                        : metric.color === "yellow"
                          ? "bg-yellow-500/20"
                          : "bg-red-500/20"
                    }`}
                  >
                    <metric.icon
                      className={`w-4 h-4 ${
                        metric.color === "emerald"
                          ? "text-emerald-400"
                          : metric.color === "yellow"
                            ? "text-yellow-400"
                            : "text-red-400"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{metric.name}</div>
                    <div className="text-slate-400 text-xs">{metric.uptime}</div>
                  </div>
                </div>

                <Badge
                  className={getStatusColor(metric.status)}
                >
                  {metric.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <div>
            <h3 className="text-white font-medium mb-3">Recent Alerts</h3>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    {alert.type === "warning" && <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />}
                    {alert.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5" />}
                    {alert.type === "info" && <Activity className="w-4 h-4 text-blue-400 mt-0.5" />}
                    <div className="flex-1">
                      <div className="text-white text-sm">{alert.message}</div>
                      <div className="text-slate-400 text-xs">{alert.time}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-6 space-y-2">
          <Button variant="outline" size="sm" className="w-full border-slate-600 text-slate-300 hover:bg-slate-800">
            View All Metrics
          </Button>
          <Button variant="outline" size="sm" className="w-full border-slate-600 text-slate-300 hover:bg-slate-800">
            System Health Report
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
