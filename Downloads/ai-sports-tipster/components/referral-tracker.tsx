import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Gift, Copy, Share2 } from "lucide-react"

export function ReferralTracker() {
  const referralStats = [
    { label: "Total Referrals", value: "23", icon: Users },
    { label: "Active This Month", value: "8", icon: Users },
    { label: "Total Earned", value: "KES 11,500", icon: Gift },
    { label: "Pending Payout", value: "KES 2,300", icon: Gift },
  ]

  const recentReferrals = [
    { name: "Peter M.", date: "2024-01-14", status: "active", earned: "KES 500" },
    { name: "Sarah K.", date: "2024-01-12", status: "pending", earned: "KES 500" },
    { name: "John D.", date: "2024-01-10", status: "active", earned: "KES 500" },
  ]

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Referral Program</h2>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">KES 500 per referral</Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {referralStats.map((stat, index) => (
          <div key={index} className="bg-slate-900/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <stat.icon className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400 text-sm">{stat.label}</span>
            </div>
            <div className="text-lg font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Referral Link */}
      <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
        <div className="text-slate-400 text-sm mb-2">Your Referral Link</div>
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-slate-800 rounded px-3 py-2 text-slate-300 text-sm font-mono">
            https://aitipster.com/ref/james123
          </div>
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Recent Referrals */}
      <div>
        <h3 className="text-white font-medium mb-3">Recent Referrals</h3>
        <div className="space-y-2">
          {recentReferrals.map((referral, index) => (
            <div key={index} className="flex items-center justify-between py-2">
              <div>
                <div className="text-white text-sm">{referral.name}</div>
                <div className="text-slate-400 text-xs">{referral.date}</div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 text-sm font-medium">{referral.earned}</div>
                <Badge
                  className={`text-xs ${
                    referral.status === "active"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                  }`}
                >
                  {referral.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
