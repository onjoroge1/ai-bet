import { AdminHeader } from "@/components/admin/admin-header"
import { AdminStats } from "@/components/admin/admin-stats"
import { UserManagement } from "@/components/admin/user-management"
import { PredictionAnalytics } from "@/components/admin/prediction-analytics"
import { SystemMonitoring } from "@/components/admin/system-monitoring"
import { RecentActivity } from "@/components/admin/recent-activity"
import { AdminPredictionManagement } from "@/components/admin-prediction-management"
import { AdminQuickPurchaseManagement } from "@/components/admin-quick-purchase-management" // Import new
import { AdminPersonalizedOffersManagement } from "@/components/admin-personalized-offers-management" // Import new

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <AdminHeader />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <AdminStats />
          </div>
          <div>
            <SystemMonitoring />
          </div>
        </div>

        {/* Prediction Management Section */}
        <AdminPredictionManagement />

        {/* Quick Purchase Management Section */}
        <AdminQuickPurchaseManagement />

        {/* Personalized Offers Management Section */}
        <AdminPersonalizedOffersManagement />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UserManagement />
          <PredictionAnalytics />
        </div>

        <RecentActivity />
      </div>
    </div>
  )
}
