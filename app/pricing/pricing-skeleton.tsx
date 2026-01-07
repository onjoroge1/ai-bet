import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * PricingSkeleton - Loading fallback UI for Suspense boundary
 * Matches the pricing page layout with skeleton loaders
 */
export function PricingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header Skeleton */}
        <div className="text-center mb-12">
          <Skeleton className="h-10 w-64 mx-auto mb-4 bg-slate-700" />
          <Skeleton className="h-6 w-96 mx-auto mb-2 bg-slate-700" />
          <Skeleton className="h-5 w-80 mx-auto bg-slate-700" />
        </div>

        {/* Pricing Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="h-10 w-10 rounded-lg bg-slate-700" />
                  <Skeleton className="h-6 w-32 bg-slate-700" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <Skeleton className="h-8 w-24 bg-slate-700" />
                    <Skeleton className="h-5 w-12 bg-slate-700" />
                  </div>
                  <Skeleton className="h-4 w-40 bg-slate-700" />
                  <Skeleton className="h-4 w-full bg-slate-700" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="flex items-start gap-2">
                      <Skeleton className="h-5 w-5 rounded bg-slate-700 mt-0.5" />
                      <Skeleton className="h-4 flex-1 bg-slate-700" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-10 w-full rounded-md bg-slate-700" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Feature Comparison Skeleton */}
        <Card className="bg-slate-800/50 border-slate-700 mb-12">
          <CardHeader>
            <Skeleton className="h-8 w-48 mb-2 bg-slate-700" />
            <Skeleton className="h-4 w-64 bg-slate-700" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-48 bg-slate-700" />
                  <Skeleton className="h-5 w-12 bg-slate-700" />
                  <Skeleton className="h-5 w-12 bg-slate-700" />
                  <Skeleton className="h-5 w-12 bg-slate-700" />
                  <Skeleton className="h-5 w-12 bg-slate-700" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FAQ Skeleton */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <Skeleton className="h-8 w-64 bg-slate-700" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-64 bg-slate-700" />
                <Skeleton className="h-4 w-full bg-slate-700" />
                <Skeleton className="h-4 w-3/4 bg-slate-700" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

