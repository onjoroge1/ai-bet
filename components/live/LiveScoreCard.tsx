"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Radio } from "lucide-react"
import type { LiveData } from "@/types/live-match"

interface LiveScoreCardProps {
  score: LiveData['current_score']
  minute: number
  period: string
  status: string
}

/**
 * Displays live match score with minute and period
 * Features pulsing red indicator and live badge
 */
export function LiveScoreCard({ score, minute, period, status }: LiveScoreCardProps) {
  if (status !== 'LIVE') return null

  return (
    <Card className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30 mb-6">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Badge className="bg-red-500/20 text-red-400 border-red-500/40 animate-pulse">
            <Radio className="w-3 h-3 mr-1" />
            LIVE
          </Badge>
          
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">{minute}'</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-slate-400 text-xs mb-1">Current Score</div>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-white">
                {score.home}
              </div>
              <div className="text-2xl text-slate-500">-</div>
              <div className="text-4xl font-bold text-white">
                {score.away}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-slate-400 text-xs mb-1">Period</div>
            <div className="text-lg font-semibold text-white">
              {period}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

