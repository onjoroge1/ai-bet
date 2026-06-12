"use client"

/**
 * Live predictions page header. Previously fabricated social proof —
 * a randomly-jittered "watching live" counter, hardcoded "8 Live Now",
 * "23 Live Predictions" and "91% Live Accuracy". Edge pivot P0: no
 * invented numbers; state what the page does and point at the audited
 * tracker for performance claims.
 */
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Radio, Zap, ExternalLink } from "lucide-react"
import Link from "next/link"

export function LivePredictionsHeader() {
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
            Live
          </Badge>
          <Link href="/signup?source=live_predictions_header_v2">
            <Button className="bg-red-600 hover:bg-red-700 text-white">
              <Zap className="w-4 h-4 mr-2" />
              Enable Alerts
            </Button>
          </Link>
        </div>
      </div>

      {/* Honest overview — what this page is, where the proof lives */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
            Predictions update as matches progress. Every pick we publish — live or
            pre-match — is logged to a public flat-stake tracker, wins and losses included.
          </p>
          <Link
            href="/performance"
            className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 flex-shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            See audited results
          </Link>
        </div>
      </Card>
    </div>
  )
}
