"use client"

import { useEffect, useState } from "react"
import { Trophy, TrendingUp, Star, Activity } from "lucide-react"

interface TickerItem {
  id: string
  text: string
  icon?: string
}

interface MarketMatch {
  id: string | number
  status: "upcoming" | "live" | "finished"
  kickoff_utc: string
  home: { name: string }
  away: { name: string }
  league: { name: string }
  predictions?: {
    free?: { side: string; confidence: number }
  }
}

const defaultTickerItems: TickerItem[] = [
  { id: "1", text: "🔥 Arsenal vs Manchester City - Live predictions available", icon: "🎯" },
  { id: "2", text: "⚡ Barcelona wins 3-1 - Prediction accuracy: 92%", icon: "✅" },
  { id: "3", text: "💎 Real Madrid upcoming match - Premium tips ready", icon: "⭐" },
  { id: "4", text: "📊 Liverpool vs Chelsea - AI prediction: Over 2.5 goals", icon: "🤖" },
  { id: "5", text: "🏆 Current win streak: 15/18 successful predictions", icon: "📈" },
]

export function MarqueeTicker() {
  const [items, setItems] = useState<TickerItem[]>(defaultTickerItems)
  const [loading, setLoading] = useState(false)

  const fetchLiveMatches = async () => {
    try {
      setLoading(true)
      // Use lite mode for fast loading (50x+ speedup)
      const response = await fetch('/api/market?status=live&mode=lite&limit=5')
      const data = await response.json()
      
      if (data.matches && data.matches.length > 0) {
        const liveItems: TickerItem[] = data.matches
          .filter((match: any) => match.home?.name && match.away?.name && 
                 match.home.name.toUpperCase() !== "TBD" && 
                 match.away.name.toUpperCase() !== "TBD")
          .map((match: any) => {
            const confidence = match.models?.v1_consensus?.confidence 
              ? Math.round(match.models.v1_consensus.confidence * 100)
              : 0
            
            return {
              id: `live-${match.match_id}`,
              text: `🔥 ${match.home.name} vs ${match.away.name} - LIVE (${confidence}% confidence)`,
              icon: "⚡"
            }
          })
        
        if (liveItems.length > 0) {
          setItems(liveItems)
        }
      }
    } catch (error) {
      console.error('Error fetching live matches for ticker:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fetch live matches immediately
    fetchLiveMatches()
    
    // Update every 30 seconds
    const interval = setInterval(fetchLiveMatches, 30000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Rotate items every 5 seconds
    const rotationInterval = setInterval(() => {
      setItems((prev) => {
        if (prev.length <= 1) return prev
        const newItems = [...prev]
        const firstItem = newItems.shift()
        if (firstItem) {
          newItems.push(firstItem)
        }
        return newItems
      })
    }, 5000)

    return () => clearInterval(rotationInterval)
  }, [items])

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-y border-slate-700 py-2 overflow-hidden">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border-r border-emerald-500/30">
          {loading ? (
            <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
          ) : (
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          )}
          <span className="text-sm font-semibold text-emerald-400 whitespace-nowrap">
            {loading ? "UPDATING" : "LIVE"}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap flex">
            {items.map((item, index) => (
              <span key={item.id} className="inline-block text-slate-300 text-sm px-8">
                <span className="inline-block mr-2">{item.icon}</span>
                {item.text}
              </span>
            ))}
            {items.map((item) => (
              <span key={`duplicate-${item.id}`} className="inline-block text-slate-300 text-sm px-8">
                <span className="inline-block mr-2">{item.icon}</span>
                {item.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

