import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Star, Crown, Gift } from "lucide-react"
import Link from "next/link"

export function WeeklySpecialsHeader() {
  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center space-x-2">
            <Star className="w-8 h-8 text-yellow-400" />
            <span>Weekly Specials</span>
          </h1>
          <p className="text-slate-300">Premium predictions with enhanced analysis and higher stakes</p>
        </div>

        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Crown className="w-4 h-4 mr-2" />
            VIP Exclusive
          </Badge>
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white">
              <Gift className="w-4 h-4 mr-2" />
              Upgrade to VIP
            </Button>
          </Link>
        </div>
      </div>

      {/* Weekly Overview */}
      <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">5</div>
            <div className="text-slate-300 text-sm">Special Picks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">94%</div>
            <div className="text-slate-300 text-sm">Avg Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">KES 50K+</div>
            <div className="text-slate-300 text-sm">Potential Winnings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">3</div>
            <div className="text-slate-300 text-sm">Accumulator Bets</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
