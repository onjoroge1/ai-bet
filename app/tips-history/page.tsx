"use client"

import { Suspense, lazy } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, BarChart3, Package, Calendar, Download, Target } from "lucide-react"

// Lazy load to prevent chunk loading issues
const PredictionsHistory = lazy(() => import("@/components/predictions-history").catch(() => {
  // Fallback if import fails
  return { default: () => <div className="text-center p-8 text-slate-400">Loading predictions history...</div> }
}))

// Loading component for the predictions history
function PredictionsHistoryLoading() {
  return (
    <div className="space-y-6">
      {/* Stats Loading */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-slate-700 rounded-lg animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-slate-700 rounded animate-pulse"></div>
                  <div className="h-5 w-12 bg-slate-700 rounded animate-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Loading */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="h-6 w-32 bg-slate-700 rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-slate-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-700 rounded-full animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-24 bg-slate-700 rounded animate-pulse"></div>
                      <div className="h-3 w-32 bg-slate-700 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-6 w-16 bg-slate-700 rounded animate-pulse"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-4 w-48 bg-slate-700 rounded animate-pulse"></div>
                    <div className="h-3 w-32 bg-slate-700 rounded animate-pulse"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-slate-700 rounded animate-pulse"></div>
                    <div className="h-4 w-20 bg-slate-700 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function TipsHistoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Main Content */}
      <Suspense fallback={<PredictionsHistoryLoading />}>
        <PredictionsHistory />
      </Suspense>
    </div>
  )
} 