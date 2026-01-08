/**
 * Best Parlay Generator Button Component
 * 
 * Allows admin to manually trigger best parlay generation
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface GenerationResult {
  success: boolean
  message: string
  parlaysGenerated: number
  parlaysCreated: number
  parlaysSkipped: number
  errors: number
  summary?: {
    multiGame: number
    singleGame: number
    byLegCount: {
      2: number
      3: number
      4: number
      5: number
    }
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: {
            minLegEdge: 0.0, // No edge filter (odds not populated yet)
            minParlayEdge: 5.0, // Lower threshold, focus on probability
            minCombinedProb: 0.15,
            maxLegCount: 5,
            minModelAgreement: 0.60, // Slightly lower to get more results
            maxResults: 20,
            parlayType: "both"
          }
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate parlays")
      }

      setLastResult(data)
      toast.success("Best parlays generated successfully!", {
        description: `${data.parlaysCreated} parlays created from ${data.parlaysGenerated} generated`
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      toast.error("Failed to generate parlays", {
        description: errorMessage
      })
      console.error("Error generating best parlays:", error)
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
              Best Parlay Generator
            </h3>
            <p className="text-sm text-slate-400">
              Generate high-quality parlays from AdditionalMarketData
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
              Generate Best Parlays
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
                  <p className="text-xs text-slate-400">Generated</p>
                  <p className="text-lg font-semibold text-white">
                    {lastResult.parlaysGenerated}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Created</p>
                  <p className="text-lg font-semibold text-emerald-500">
                    {lastResult.parlaysCreated}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Skipped</p>
                  <p className="text-lg font-semibold text-yellow-500">
                    {lastResult.parlaysSkipped}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Errors</p>
                  <p className="text-lg font-semibold text-red-500">
                    {lastResult.errors}
                  </p>
                </div>
              </div>

              {lastResult.summary && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Breakdown:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Multi-Game</p>
                      <p className="text-sm font-semibold text-white">
                        {lastResult.summary.multiGame}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Single-Game</p>
                      <p className="text-sm font-semibold text-white">
                        {lastResult.summary.singleGame}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">By Leg Count</p>
                      <div className="text-xs text-slate-300 mt-1">
                        {Object.entries(lastResult.summary.byLegCount).map(([count, num]) => (
                          <span key={count} className="mr-2">
                            {count}L: {num}
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
        <p>• Generates parlays from AdditionalMarketData table</p>
        <p>• Supports multi-game (different matches) and single-game parlays</p>
        <p>• Prioritizes match diversification for optimal risk distribution</p>
        <p>• Filters by edge, probability, and model agreement</p>
      </div>
    </div>
  )
}

