import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Calendar, Clock, Bell } from "lucide-react"
import Link from "next/link"

export function DailyTipsHeader() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // For now, we'll assume user is not logged in
  // This can be replaced with actual auth state later
  const isLoggedIn = false

  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center space-x-2">
            <Calendar className="w-8 h-8 text-emerald-400" />
            <span>Daily Tips</span>
          </h1>
          <p className="text-slate-300">{today}</p>
        </div>

        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse">
            <Clock className="w-4 h-4 mr-2" />
            Updated 5 min ago
          </Badge>
          {isLoggedIn ? (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Bell className="w-4 h-4 mr-2" />
              Get Alerts
            </Button>
          ) : (
            <Link href="/signup">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Bell className="w-4 h-4 mr-2" />
                Get Alerts
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Today's Summary */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">12</div>
            <div className="text-slate-400 text-sm">Today's Tips</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">89%</div>
            <div className="text-slate-400 text-sm">Avg Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">8</div>
            <div className="text-slate-400 text-sm">High Value</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">5</div>
            <div className="text-slate-400 text-sm">Live Now</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
