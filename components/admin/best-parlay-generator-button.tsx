/**
 * Curated Parlay Generator Button Component
 *
 * Allows admin to manually trigger the curated parlay generation.
 * Expires old AI parlays first, then creates a fresh set.
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface GenerationResult {
  success: boolean
  message: string
  expired: number
  parlaysGenerated: number
  parlaysCreated: number
  parlaysSkipped: number
  errors: number
  summary?: {
    multiGame: number
    singleGame: number
    byLegCount: Record<string, number>
  }
}

export function BestParlayGeneratorButton() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastResult, setLastResult] = useState<GenerationResult | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setLastResult(null)

    try {
      const response = await fetch("/api/admin/parlays/generate-best", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            maxResults: 15,
            parlayType: "both",
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate parlays")
      }

      setLastResult(data)
      toast.success("Curated parlays generated!", {
        description: `${data.parlaysCreated} created, ${data.expired} old expired`,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error"
      toast.error("Failed to generate parlays", { description: msg })
      console.error("Error generating parlays:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Sparkles className="w-6 h-6 text-emerald-500" />
          <div>
            <h3 className="text-lg font-semibold text-white">
              Curated Parlay Generator
            </h3>
            <p className="text-sm text-slate-400">
              Generate a fresh set of high-quality AI parlays
            </p>
          </div>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Parlays
            </>
          )}
        </Button>
      </div>

      {lastResult && (
        <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
          <div className="flex items-start space-x-3">
            {lastResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            )}
            <div className="flex-1 space-y-2">
              <p className="text-sm text-white font-medium">{lastResult.message}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                <div>
                  <p className="text-xs text-slate-400">Old Expired</p>
                  <p className="text-lg font-semibold text-slate-300">{lastResult.expired}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Generated</p>
                  <p className="text-lg font-semibold text-white">{lastResult.parlaysGenerated}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Created</p>
                  <p className="text-lg font-semibold text-emerald-500">{lastResult.parlaysCreated}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Errors</p>
                  <p className="text-lg font-semibold text-red-500">{lastResult.errors}</p>
                </div>
              </div>

              {lastResult.summary && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Breakdown:</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Cross-Match</p>
                      <p className="text-sm font-semibold text-white">{lastResult.summary.multiGame}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Same-Game</p>
                      <p className="text-sm font-semibold text-white">{lastResult.summary.singleGame}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">By Legs</p>
                      <div className="text-xs text-slate-300 mt-1">
                        {Object.entries(lastResult.summary.byLegCount).map(([count, num]) => (
                          <span key={count} className="mr-2">
                            {count}L: {num as number}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-slate-400 space-y-1">
        <p>• Expires all previous AI parlays, then generates a fresh curated set</p>
        <p>• Best Picks: top match-result favourites across different matches</p>
        <p>• SGP: same-game parlays (Match Result + Over/Under + BTTS)</p>
        <p>• Mixed: best single-market picks from different matches</p>
        <p>• Excludes trivial legs (Over 0.5, Over 1.5) and draws</p>
      </div>
    </div>
  )
}
