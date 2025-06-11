import { DailyTipsHeader } from "@/components/tips/daily-tips-header"
import { TodaysPredictions } from "@/components/tips/todays-predictions"
import { TipsFilters } from "@/components/tips/tips-filters"
import { TipsStats } from "@/components/tips/tips-stats"

export default function DailyTipsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <DailyTipsHeader />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-3">
            <TodaysPredictions />
          </div>
          <div className="space-y-6">
            <TipsFilters />
            <TipsStats />
          </div>
        </div>
      </div>
    </div>
  )
}
