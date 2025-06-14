"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Server, Database, Wifi, HardDrive, Cpu, Activity, AlertTriangle, CheckCircle } from "lucide-react"
import { useSystemMonitoring } from "@/hooks/use-system-monitoring"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

export function SystemMonitoring() {
  const { metrics: currentMetrics, connected: isConnected, lastError } = useSystemMonitoring()
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    if (currentMetrics) {
      setLastUpdated(new Date())
    }
  }, [currentMetrics])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'degraded':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'down':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  if (lastError) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-center p-8">
          <div className="text-red-400">
            <AlertTriangle className="w-8 h-8 mb-2" />
            <p>Error loading system metrics: {lastError.message}</p>
          </div>
        </div>
      </Card>
    )
  }

  if (!currentMetrics) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="ml-2 text-slate-400">Loading system metrics...</span>
        </div>
      </Card>
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
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold text-white">System Status</h2>
          <Activity className="w-5 h-5 text-emerald-400" />
          {!isConnected && (
            <Badge variant="outline" className="ml-2 bg-red-500/20 text-red-400 border-red-500/30">
              Disconnected
            </Badge>
          )}
        </div>
        <div className="text-slate-400 text-sm">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

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
    </Card>
  )
}
