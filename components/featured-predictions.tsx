import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lock, TrendingUp, Clock, Star } from "lucide-react"
import Link from "next/link"

export function FeaturedPredictions() {
  const predictions = [
    {
      id: 1,
      match: "Manchester United vs Liverpool",
      league: "Premier League",
      prediction: "Over 2.5 Goals",
      confidence: 92,
      odds: "1.85",
      explanation: "Both teams average 3+ goals in recent matches. United's defense has been vulnerable.",
      isFree: true,
      time: "15:30 GMT",
    },
    {
      id: 2,
      match: "Barcelona vs Real Madrid",
      league: "La Liga",
      prediction: "Barcelona Win",
      confidence: 78,
      odds: "2.10",
      explanation: "Barcelona's home form is exceptional with 8 wins in last 10 games.",
      isFree: true,
      time: "20:00 GMT",
    },
    {
      id: 3,
      match: "Bayern Munich vs Dortmund",
      league: "Bundesliga",
      prediction: "Both Teams to Score",
      confidence: 89,
      odds: "1.65",
      explanation: "Premium analysis available for VIP members only.",
      isFree: false,
      time: "18:30 GMT",
    },
    {
      id: 4,
      match: "PSG vs Marseille",
      league: "Ligue 1",
      prediction: "PSG -1.5 Handicap",
      confidence: 85,
      odds: "1.95",
      explanation: "Advanced statistical model shows strong value in this market.",
      isFree: false,
      time: "21:00 GMT",
    },
  ]

  return (
    <section className="py-16 px-4 bg-slate-900/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Today's AI Predictions</h2>
          <p className="text-slate-300 text-lg">Data-driven insights from our advanced machine learning algorithms</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {predictions.map((prediction) => (
            <Card
              key={prediction.id}
              className="bg-slate-800/50 border-slate-700 p-6 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                      {prediction.league}
                    </Badge>
                    {prediction.isFree ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Free</Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        <Lock className="w-3 h-3 mr-1" />
                        VIP
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-lg">{prediction.match}</h3>
                  <div className="flex items-center text-slate-400 text-sm mt-1">
                    <Clock className="w-4 h-4 mr-1" />
                    {prediction.time}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-400">{prediction.confidence}%</div>
                  <div className="text-slate-400 text-sm">Confidence</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{prediction.prediction}</div>
                    <div className="text-slate-400 text-sm">Odds: {prediction.odds}</div>
                  </div>
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-amber-400 mr-1" />
                    <span className="text-amber-400 text-sm">High Value</span>
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-slate-300 text-sm">
                    {prediction.isFree ? (
                      prediction.explanation
                    ) : (
                      <div className="flex items-center">
                        <Lock className="w-4 h-4 mr-2 text-slate-500" />
                        {prediction.explanation}
                      </div>
                    )}
                  </div>
                </div>

                {!prediction.isFree && (
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Unlock VIP Analysis
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/daily-tips">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8">
              View All Predictions
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
