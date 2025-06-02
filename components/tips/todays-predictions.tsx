import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Star, TrendingUp, Lock, Eye, Target, Brain } from "lucide-react"

export function TodaysPredictions() {
  const predictions = [
    {
      id: 1,
      match: "Arsenal vs Chelsea",
      league: "Premier League",
      time: "15:30",
      prediction: "Over 2.5 Goals",
      confidence: 92,
      odds: "1.85",
      value: "High",
      isFree: true,
      analysis: "Both teams have scored 3+ goals in their last 5 matches. Arsenal's attacking form is exceptional.",
      status: "live",
    },
    {
      id: 2,
      match: "Manchester City vs Liverpool",
      league: "Premier League",
      time: "17:45",
      prediction: "Both Teams to Score",
      confidence: 87,
      odds: "1.65",
      value: "Medium",
      isFree: true,
      analysis: "High-scoring fixture expected with both teams in excellent attacking form.",
      status: "upcoming",
    },
    {
      id: 3,
      match: "Barcelona vs Real Madrid",
      league: "La Liga",
      time: "20:00",
      prediction: "Barcelona Win",
      confidence: 78,
      odds: "2.10",
      value: "High",
      isFree: false,
      analysis: "Premium analysis available for VIP members only.",
      status: "upcoming",
    },
    {
      id: 4,
      match: "Bayern Munich vs Dortmund",
      league: "Bundesliga",
      time: "18:30",
      prediction: "Under 3.5 Goals",
      confidence: 84,
      odds: "1.95",
      value: "Medium",
      isFree: false,
      analysis: "Detailed tactical analysis and injury reports available for VIP members.",
      status: "upcoming",
    },
    {
      id: 5,
      match: "PSG vs Marseille",
      league: "Ligue 1",
      time: "21:00",
      prediction: "PSG -1.5 Handicap",
      confidence: 89,
      odds: "1.75",
      value: "High",
      isFree: true,
      analysis: "PSG's home dominance and Marseille's away struggles make this a strong pick.",
      status: "upcoming",
    },
    {
      id: 6,
      match: "Juventus vs AC Milan",
      league: "Serie A",
      time: "19:45",
      prediction: "Draw",
      confidence: 72,
      odds: "3.20",
      value: "Very High",
      isFree: false,
      analysis: "Statistical model shows strong value in the draw market for this fixture.",
      status: "upcoming",
    },
  ]

  const getValueColor = (value: string) => {
    switch (value) {
      case "Very High":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      case "High":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      case "Medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
      case "upcoming":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
          <Target className="w-5 h-5 text-emerald-400" />
          <span>Today's Predictions</span>
        </h2>
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
          <TrendingUp className="w-4 h-4 mr-2" />
          Sort by Confidence
        </Button>
      </div>

      <div className="space-y-4">
        {predictions.map((prediction) => (
          <Card
            key={prediction.id}
            className="bg-slate-900/50 border-slate-700 p-4 hover:bg-slate-900/70 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-white font-semibold">{prediction.match}</h3>
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
                    {prediction.league}
                  </Badge>
                  <Badge className={getStatusColor(prediction.status)}>
                    {prediction.status === "live" ? "LIVE" : prediction.time}
                  </Badge>
                </div>

                <div className="flex items-center space-x-4 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-emerald-400 font-medium">{prediction.prediction}</span>
                    <span className="text-slate-400 text-sm">@ {prediction.odds}</span>
                  </div>
                  <Badge className={getValueColor(prediction.value)}>{prediction.value} Value</Badge>
                  {prediction.isFree ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Free</Badge>
                  ) : (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      <Lock className="w-3 h-3 mr-1" />
                      VIP
                    </Badge>
                  )}
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
                  <div className="flex items-start space-x-2">
                    <Brain className="w-4 h-4 text-emerald-400 mt-0.5" />
                    <div className="text-slate-300 text-sm">
                      {prediction.isFree ? (
                        prediction.analysis
                      ) : (
                        <div className="flex items-center">
                          <Lock className="w-4 h-4 mr-2 text-slate-500" />
                          {prediction.analysis}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-right ml-4">
                <div className="text-2xl font-bold text-white mb-1">{prediction.confidence}%</div>
                <div className="text-slate-400 text-sm mb-2">Confidence</div>
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${
                        i < Math.floor(prediction.confidence / 20) ? "text-yellow-400 fill-current" : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400 text-sm">
                  {prediction.status === "live" ? "Match in progress" : `Starts at ${prediction.time}`}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {!prediction.isFree && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Lock className="w-4 h-4 mr-2" />
                    Unlock Analysis
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
          Load More Predictions
        </Button>
      </div>
    </Card>
  )
}
