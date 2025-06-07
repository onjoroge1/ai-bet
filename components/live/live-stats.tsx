import { Card } from "@/components/ui/card"
import { Radio, Target, TrendingUp, Users } from "lucide-react"

export function LiveStats() {
  const stats = [
    {
      title: "Live Accuracy",
      value: "91%",
      icon: Target,
      color: "emerald",
    },
    {
      title: "Active Predictions",
      value: "23",
      icon: Radio,
      color: "red",
    },
    {
      title: "Live Viewers",
      value: "12.4K",
      icon: Users,
      color: "blue",
    },
    {
      title: "Avg Confidence",
      value: "82%",
      icon: TrendingUp,
      color: "purple",
    },
  ]

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
        <Radio className="w-5 h-5 text-red-400 animate-pulse" />
        <span>Live Stats</span>
      </h3>

      <div className="space-y-4">
        {stats.map((stat, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  stat.color === "emerald"
                    ? "bg-emerald-500/20"
                    : stat.color === "red"
                      ? "bg-red-500/20"
                      : stat.color === "blue"
                        ? "bg-blue-500/20"
                        : "bg-purple-500/20"
                }`}
              >
                <stat.icon
                  className={`w-4 h-4 ${
                    stat.color === "emerald"
                      ? "text-emerald-400"
                      : stat.color === "red"
                        ? "text-red-400"
                        : stat.color === "blue"
                          ? "text-blue-400"
                          : "text-purple-400"
                  }`}
                />
              </div>
              <span className="text-slate-300 text-sm">{stat.title}</span>
            </div>
            <span className="text-white font-semibold">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Live Indicator */}
      <div className="mt-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
        <div className="flex items-center space-x-2">
          <Radio className="w-4 h-4 text-red-400 animate-pulse" />
          <span className="text-red-400 text-sm font-medium">Live Tracking Active</span>
        </div>
        <div className="text-slate-300 text-xs mt-1">Real-time updates every 30 seconds</div>
      </div>
    </Card>
  )
}
