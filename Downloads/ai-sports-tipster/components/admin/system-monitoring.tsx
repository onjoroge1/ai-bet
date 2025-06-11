import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Server, Database, Wifi, HardDrive, Cpu, Activity, AlertTriangle, CheckCircle } from "lucide-react"

export function SystemMonitoring() {
  const systemMetrics = [
    {
      name: "API Server",
      status: "healthy",
      uptime: "99.9%",
      icon: Server,
      color: "emerald",
    },
    {
      name: "Database",
      status: "healthy",
      uptime: "99.8%",
      icon: Database,
      color: "emerald",
    },
    {
      name: "CDN",
      status: "healthy",
      uptime: "100%",
      icon: Wifi,
      color: "emerald",
    },
    {
      name: "Storage",
      status: "warning",
      uptime: "85% used",
      icon: HardDrive,
      color: "yellow",
    },
    {
      name: "AI Models",
      status: "healthy",
      uptime: "99.9%",
      icon: Cpu,
      color: "emerald",
    },
  ]

  const alerts = [
    {
      type: "warning",
      message: "Storage usage approaching 90%",
      time: "5 min ago",
    },
    {
      type: "info",
      message: "Scheduled maintenance tonight",
      time: "1 hour ago",
    },
    {
      type: "success",
      message: "AI model retrained successfully",
      time: "2 hours ago",
    },
  ]

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold text-white">System Status</h2>
          <Activity className="w-5 h-5 text-emerald-400" />
        </div>
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
          View Logs
        </Button>
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
                className={
                  metric.status === "healthy"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : metric.status === "warning"
                      ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                }
              >
                {metric.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Alerts */}
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
