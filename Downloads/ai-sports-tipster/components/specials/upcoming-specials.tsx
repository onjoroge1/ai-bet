import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Bell } from "lucide-react"

export function UpcomingSpecials() {
  const upcoming = [
    {
      title: "Champions League Special",
      date: "Next Tuesday",
      time: "20:00",
      type: "Multi-bet",
      confidence: "95%",
    },
    {
      title: "Derby Day Accumulator",
      date: "This Saturday",
      time: "15:00",
      type: "Accumulator",
      confidence: "88%",
    },
    {
      title: "International Break Picks",
      date: "Next Week",
      time: "TBD",
      type: "Multiple",
      confidence: "90%",
    },
  ]

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-emerald-400" />
          <span>Upcoming Specials</span>
        </h3>
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
          <Bell className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {upcoming.map((special, index) => (
          <div key={index} className="bg-slate-900/50 rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-white font-medium text-sm">{special.title}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-400 text-xs">{special.date}</span>
                  {special.time !== "TBD" && <span className="text-slate-400 text-xs">• {special.time}</span>}
                </div>
              </div>
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                {special.confidence}
              </Badge>
            </div>
            <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
              {special.type}
            </Badge>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Button variant="outline" size="sm" className="w-full border-slate-600 text-slate-300 hover:bg-slate-800">
          <Bell className="w-4 h-4 mr-2" />
          Get Notified
        </Button>
      </div>
    </Card>
  )
}
