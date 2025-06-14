"use client"

import { useState, useEffect } from "react"
import { MobileLive } from "@/components/mobile/mobile-live"
import { LivePredictionsHeader } from "@/components/live/live-predictions-header"
import { LiveMatches } from "@/components/live/live-matches"
import { LiveStats } from "@/components/live/live-stats"
import { LiveChat } from "@/components/live/live-chat"

export default function LivePredictionsPage() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Set initial state
    setIsMobile(window.innerWidth < 768)

    // Add resize listener
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Mobile view
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <MobileLive />
      </div>
    )
  }

  // Desktop view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6">
      <LivePredictionsHeader />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveMatches />
        </div>

        <div className="space-y-6">
          <LiveStats />
          <LiveChat />
        </div>
      </div>
    </div>
  )
}
