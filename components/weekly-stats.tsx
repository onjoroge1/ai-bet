import { Card } from "@/components/ui/card"
import { TrendingUp, Target, Trophy, Star } from "lucide-react"

export function WeeklyStats() {
  const stats = [
    {
      title: "Week Win Rate",
      value: "92%",
      icon: Target,
      color: "emerald",
    },
    {
      title: "Avg Confidence",
      value: "94%",
      icon: TrendingUp,
      color: "yellow",
    },
    {
      title: "Total Specials",
      value: "5",
      icon: Star,
      color: "purple",
    },
    {
      title: "Max Potential",
      value: "KES 65K",
      icon: Trophy,
      color: "orange",
    },
  ]

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
        <Star className="w-5 h-5 text-yellow-400" />
        <span>Weekly Performance</span>
      </h3>

      <div className="space-y-4">
        {stats.map((stat, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  stat.color === "emerald"
                    ? "bg-emerald-500/20"
                    : stat.color === "yellow"
                      ? "bg-yellow-500/20"
                      : stat.color === "purple"
                        ? "bg-purple-500/20"
                        : "bg-orange-500/20"
                }`}
              >
                <stat.icon
                  className={`w-4 h-4 ${
                    stat.color === "emerald"
                      ? "text-emerald-400"
                      : stat.color === "yellow"
                        ? "text-yellow-400"
                        : stat.color === "purple"
                          ? "text-purple-400"
                          : "text-orange-400"
                  }`}
                />
              </div>
              <span className="text-slate-300 text-sm">{stat.title}</span>
            </div>
            <span className="text-white font-semibold">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Premium Indicator */}
      <div className="mt-6 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-center space-x-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 text-sm font-medium">Premium Quality</span>
        </div>
        <div className="text-slate-300 text-xs mt-1">Enhanced analysis and higher confidence picks</div>
      </div>
    </Card>
  )
}
