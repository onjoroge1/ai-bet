import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { User, CreditCard, Shield, AlertTriangle, Crown, RefreshCw } from "lucide-react"

export function RecentActivity() {
  const activities = [
    {
      id: 1,
      type: "user_signup",
      user: "James Kiprotich",
      country: "🇰🇪",
      action: "New user registration",
      details: "VIP plan selected",
      time: "2 minutes ago",
      icon: User,
      color: "emerald",
    },
    {
      id: 2,
      type: "payment",
      user: "Priya Sharma",
      country: "🇮🇳",
      action: "Payment processed",
      details: "₹2,500 via Paytm",
      time: "5 minutes ago",
      icon: CreditCard,
      color: "blue",
    },
    {
      id: 3,
      type: "admin_action",
      user: "Admin",
      country: "🌍",
      action: "User account suspended",
      details: "Suspicious betting patterns",
      time: "10 minutes ago",
      icon: Shield,
      color: "red",
    },
    {
      id: 4,
      type: "system",
      user: "System",
      country: "🤖",
      action: "AI model retrained",
      details: "Performance improved to 87.3%",
      time: "15 minutes ago",
      icon: RefreshCw,
      color: "purple",
    },
    {
      id: 5,
      type: "upgrade",
      user: "Miguel Rodriguez",
      country: "🇵🇭",
      action: "Plan upgraded",
      details: "Free → VIP membership",
      time: "1 hour ago",
      icon: Crown,
      color: "yellow",
    },
    {
      id: 6,
      type: "alert",
      user: "System",
      country: "⚠️",
      action: "High server load detected",
      details: "Auto-scaling initiated",
      time: "2 hours ago",
      icon: AlertTriangle,
      color: "orange",
    },
  ]

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "user_signup":
        return "User"
      case "payment":
        return "Payment"
      case "admin_action":
        return "Admin"
      case "system":
        return "System"
      case "upgrade":
        return "Upgrade"
      case "alert":
        return "Alert"
      default:
        return "Other"
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "user_signup":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      case "payment":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "admin_action":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      case "system":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      case "upgrade":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "alert":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
            View All
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    activity.color === "emerald"
                      ? "bg-emerald-500/20"
                      : activity.color === "blue"
                        ? "bg-blue-500/20"
                        : activity.color === "red"
                          ? "bg-red-500/20"
                          : activity.color === "purple"
                            ? "bg-purple-500/20"
                            : activity.color === "yellow"
                              ? "bg-yellow-500/20"
                              : activity.color === "orange"
                                ? "bg-orange-500/20"
                                : "bg-slate-500/20"
                  }`}
                >
                  <activity.icon
                    className={`w-5 h-5 ${
                      activity.color === "emerald"
                        ? "text-emerald-400"
                        : activity.color === "blue"
                          ? "text-blue-400"
                          : activity.color === "red"
                            ? "text-red-400"
                            : activity.color === "purple"
                              ? "text-purple-400"
                              : activity.color === "yellow"
                                ? "text-yellow-400"
                                : activity.color === "orange"
                                  ? "text-orange-400"
                                  : "text-slate-400"
                    }`}
                  />
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-white font-medium">{activity.action}</span>
                    <span className="text-lg">{activity.country}</span>
                  </div>
                  <div className="text-slate-400 text-sm mb-2">
                    {activity.user} • {activity.details}
                  </div>
                  <div className="text-slate-500 text-xs">{activity.time}</div>
                </div>
              </div>

              <Badge className={getTypeColor(activity.type)}>{getTypeLabel(activity.type)}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
          Load More Activities
        </Button>
      </div>
    </Card>
  )
}
