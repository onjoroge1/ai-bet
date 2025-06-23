"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Radio, Zap } from "lucide-react"
import Link from "next/link"

export function LivePredictionsHeader() {
  const [liveCount, setLiveCount] = useState(8)
  const [activeUsers, setActiveUsers] = useState(1247)

  // For now, we'll assume user is not logged in
  // This can be replaced with actual auth state later
  const isLoggedIn = false

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveUsers((prev) => prev + Math.floor(Math.random() * 5 - 2))
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center space-x-2">
            <Radio className="w-8 h-8 text-red-400 animate-pulse" />
            <span>Live Predictions</span>
          </h1>
          <p className="text-slate-300">Real-time AI predictions for ongoing matches</p>
        </div>

        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
            <Radio className="w-4 h-4 mr-2" />
            {liveCount} Live Now
          </Badge>
          {isLoggedIn ? (
            <Button className="bg-red-600 hover:bg-red-700 text-white">
              <Zap className="w-4 h-4 mr-2" />
              Enable Alerts
            </Button>
          ) : (
            <Link href="/signup">
              <Button className="bg-red-600 hover:bg-red-700 text-white">
                <Zap className="w-4 h-4 mr-2" />
                Enable Alerts
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Live Overview */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400 animate-pulse">{liveCount}</div>
            <div className="text-slate-400 text-sm">Live Matches</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{activeUsers.toLocaleString()}</div>
            <div className="text-slate-400 text-sm">Watching Live</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">23</div>
            <div className="text-slate-400 text-sm">Live Predictions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">91%</div>
            <div className="text-slate-400 text-sm">Live Accuracy</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
