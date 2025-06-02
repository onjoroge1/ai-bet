import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Crown, Star, TrendingUp, Lock, Target, Brain, Zap } from "lucide-react"

export function SpecialPredictions() {
  const specials = [
    {
      id: 1,
      title: "Weekend Accumulator",
      type: "accumulator",
      matches: ["Arsenal vs Chelsea", "Man City vs Liverpool", "Barcelona vs Madrid"],
      totalOdds: "12.50",
      confidence: 94,
      stake: "KES 5,000",
      potential: "KES 62,500",
      analysis: "Triple header featuring top European clashes with carefully selected markets for maximum value.",
      isVip: true,
    },
    {
      id: 2,
      title: "El Clasico Special",
      type: "single",
      matches: ["Barcelona vs Real Madrid"],
      totalOdds: "2.85",
      confidence: 89,
      stake: "KES 10,000",
      potential: "KES 28,500",
      analysis: "Deep tactical analysis of the biggest fixture in world football with exclusive insider insights.",
      isVip: true,
    },
    {
      id: 3,
      title: "Premier League Banker",
      type: "single",
      matches: ["Manchester City vs Brighton"],
      totalOdds: "1.45",
      confidence: 96,
      stake: "KES 20,000",
      potential: "KES 29,000",
      analysis: "Low-risk, high-confidence pick based on comprehensive statistical modeling.",
      isVip: true,
    },
    {
      id: 4,
      title: "European Giants Combo",
      type: "accumulator",
      matches: ["Bayern vs Dortmund", "PSG vs Marseille", "Juventus vs Milan"],
      totalOdds: "8.75",
      confidence: 91,
      stake: "KES 7,500",
      potential: "KES 65,625",
      analysis: "Multi-league accumulator targeting value across Europe's top competitions.",
      isVip: true,
    },
  ]

  const getTypeColor = (type: string) => {
    switch (type) {
      case "accumulator":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      case "single":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          <span>This Week's Specials</span>
        </h2>
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
          <TrendingUp className="w-4 h-4 mr-2" />
          Sort by Potential
        </Button>
      </div>

      <div className="space-y-6">
        {specials.map((special) => (
          <Card
            key={special.id}
            className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 border-yellow-500/30 p-6 hover:from-slate-900/70 hover:to-slate-800/70 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-white font-bold text-lg">{special.title}</h3>
                  <Badge className={getTypeColor(special.type)}>
                    {special.type === "accumulator" ? "Accumulator" : "Single Bet"}
                  </Badge>
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    <Crown className="w-3 h-3 mr-1" />
                    VIP
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  {special.matches.map((match, index) => (
                    <div key={index} className="text-slate-300 text-sm flex items-center space-x-2">
                      <Target className="w-3 h-3 text-emerald-400" />
                      <span>{match}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                  <div className="flex items-start space-x-2">
                    <Brain className="w-4 h-4 text-yellow-400 mt-0.5" />
                    <div className="text-slate-300 text-sm">{special.analysis}</div>
                  </div>
                </div>
              </div>

              <div className="text-right ml-6">
                <div className="text-3xl font-bold text-yellow-400 mb-1">{special.confidence}%</div>
                <div className="text-slate-400 text-sm mb-2">Confidence</div>
                <div className="flex items-center justify-end space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(special.confidence / 20) ? "text-yellow-400 fill-current" : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-white">{special.totalOdds}</div>
                <div className="text-slate-400 text-sm">Total Odds</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-cyan-400">{special.stake}</div>
                <div className="text-slate-400 text-sm">Recommended Stake</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-emerald-400">{special.potential}</div>
                <div className="text-slate-400 text-sm">Potential Return</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">Premium Analysis Available</span>
              </div>

              <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white">
                <Lock className="w-4 h-4 mr-2" />
                View Full Analysis
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  )
}
