import { Card } from "@/components/ui/card"
import {
  Users,
  DollarSign,
  TrendingUp,
  Target,
  AlertTriangle,
  Crown,
  Globe,
  Activity,
  ArrowUp,
  ArrowDown,
} from "lucide-react"

export function AdminStats() {
  const stats = [
    {
      title: "Total Users",
      value: "50,234",
      change: "+12.5%",
      trend: "up",
      icon: Users,
      color: "blue",
      subtitle: "2,341 new this month",
    },
    {
      title: "Revenue",
      value: "KES 8.2M",
      change: "+18.3%",
      trend: "up",
      icon: DollarSign,
      color: "emerald",
      subtitle: "Monthly recurring",
    },
    {
      title: "VIP Members",
      value: "12,567",
      change: "+9.2%",
      trend: "up",
      icon: Crown,
      color: "yellow",
      subtitle: "25% of total users",
    },
    {
      title: "Win Rate",
      value: "87.3%",
      change: "+2.1%",
      trend: "up",
      icon: Target,
      color: "emerald",
      subtitle: "Platform average",
    },
    {
      title: "Active Countries",
      value: "28",
      change: "+3",
      trend: "up",
      icon: Globe,
      color: "cyan",
      subtitle: "Global expansion",
    },
    {
      title: "System Uptime",
      value: "99.9%",
      change: "0%",
      trend: "neutral",
      icon: Activity,
      color: "emerald",
      subtitle: "Last 30 days",
    },
    {
      title: "Support Tickets",
      value: "143",
      change: "-15.2%",
      trend: "down",
      icon: AlertTriangle,
      color: "red",
      subtitle: "Open tickets",
    },
    {
      title: "Daily Predictions",
      value: "1,247",
      change: "+5.8%",
      trend: "up",
      icon: TrendingUp,
      color: "purple",
      subtitle: "AI generated",
    },
  ]

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <h2 className="text-xl font-semibold text-white mb-6">Platform Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  stat.color === "blue"
                    ? "bg-blue-500/20"
                    : stat.color === "emerald"
                      ? "bg-emerald-500/20"
                      : stat.color === "yellow"
                        ? "bg-yellow-500/20"
                        : stat.color === "cyan"
                          ? "bg-cyan-500/20"
                          : stat.color === "purple"
                            ? "bg-purple-500/20"
                            : stat.color === "red"
                              ? "bg-red-500/20"
                              : "bg-slate-500/20"
                }`}
              >
                <stat.icon
                  className={`w-5 h-5 ${
                    stat.color === "blue"
                      ? "text-blue-400"
                      : stat.color === "emerald"
                        ? "text-emerald-400"
                        : stat.color === "yellow"
                          ? "text-yellow-400"
                          : stat.color === "cyan"
                            ? "text-cyan-400"
                            : stat.color === "purple"
                              ? "text-purple-400"
                              : stat.color === "red"
                                ? "text-red-400"
                                : "text-slate-400"
                  }`}
                />
              </div>
              <div className="flex items-center space-x-1">
                {stat.trend === "up" && <ArrowUp className="w-4 h-4 text-emerald-400" />}
                {stat.trend === "down" && <ArrowDown className="w-4 h-4 text-red-400" />}
                <span
                  className={`text-sm font-medium ${
                    stat.trend === "up" ? "text-emerald-400" : stat.trend === "down" ? "text-red-400" : "text-slate-400"
                  }`}
                >
                  {stat.change}
                </span>
              </div>
            </div>

            <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-slate-400 text-sm mb-2">{stat.title}</div>
            <div className="text-slate-500 text-xs">{stat.subtitle}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
