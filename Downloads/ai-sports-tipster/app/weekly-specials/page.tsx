import { WeeklySpecialsHeader } from "@/components/specials/weekly-specials-header"
import { SpecialPredictions } from "@/components/specials/special-predictions"
import { WeeklyStats } from "@/components/specials/weekly-stats"
import { UpcomingSpecials } from "@/components/specials/upcoming-specials"

export default function WeeklySpecialsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <WeeklySpecialsHeader />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <SpecialPredictions />
          </div>
          <div className="space-y-6">
            <WeeklyStats />
            <UpcomingSpecials />
          </div>
        </div>
      </div>
    </div>
  )
}
