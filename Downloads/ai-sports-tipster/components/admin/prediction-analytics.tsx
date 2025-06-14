import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, Target, CheckCircle, XCircle, Clock, BarChart3, Brain } from "lucide-react"

export function PredictionAnalytics() {
  const analytics = [
    {
      title: "AI Model Accuracy",
      value: "87.3%",
      change: "+2.1%",
      status: "excellent",
    },
    {
      title: "Predictions Today",
      value: "1,247",
      change: "+156",
      status: "good",
    },
    {
      title: "Success Rate (24h)",
      value: "89.2%",
      change: "+3.4%",
      status: "excellent",
    },
    {
      title: "Failed Predictions",
      value: "134",
      change: "-23",
      status: "good",
    },
  ]

  const recentPredictions = [
    {
      match: "Arsenal vs Chelsea",
      prediction: "Over 2.5 Goals",
      confidence: 92,
      status: "won",
      usersBet: 2340,
    },
    {
      match: "Man City vs Liverpool",
      prediction: "BTTS",
      confidence: 87,
      status: "pending",
      usersBet: 1876,
    },
    {
      match: "Barcelona vs Madrid",
      prediction: "Barcelona Win",
      confidence: 78,
      status: "lost",
      usersBet: 3245,
    },
    {
      match: "Bayern vs Dortmund",
      prediction: "Under 3.5",
      confidence: 84,
      status: "won",
      usersBet: 1654,
    },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "won":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />
      case "lost":
        return <XCircle className="w-4 h-4 text-red-400" />
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-400" />
      default:
        return null
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold text-white">Prediction Analytics</h2>
          <Brain className="w-5 h-5 text-emerald-400" />
        </div>
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
          <BarChart3 className="w-4 h-4 mr-2" />
          Detailed Report
        </Button>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {analytics.map((item, index) => (
          <div key={index} className="bg-slate-900/50 rounded-lg p-3">
            <div className="text-lg font-bold text-white">{item.value}</div>
            <div className="text-slate-400 text-sm mb-1">{item.title}</div>
            <div
              className={`text-xs flex items-center space-x-1 ${
                item.status === "excellent"
                  ? "text-emerald-400"
                  : item.status === "good"
                    ? "text-blue-400"
                    : "text-yellow-400"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>{item.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Predictions */}
      <div>
        <h3 className="text-white font-medium mb-3 flex items-center space-x-2">
          <Target className="w-4 h-4 text-emerald-400" />
          <span>Recent AI Predictions</span>
        </h3>

        <div className="space-y-3">
          {recentPredictions.map((prediction, index) => (
            <div key={index} className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-white font-medium text-sm">{prediction.match}</div>
                  <div className="text-slate-400 text-xs">{prediction.prediction}</div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(prediction.status)}
                  <Badge className="bg-slate-700 text-slate-300 text-xs">{prediction.confidence}%</Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-slate-400 text-xs">{prediction.usersBet.toLocaleString()} users bet</div>
                <div
                  className={`text-xs capitalize ${
                    prediction.status === "won"
                      ? "text-emerald-400"
                      : prediction.status === "lost"
                        ? "text-red-400"
                        : "text-yellow-400"
                  }`}
                >
                  {prediction.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Model Status */}
      <div className="mt-6 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 text-sm font-medium">
            AI Model performing optimally - Last retrained 2 days ago
          </span>
        </div>
      </div>
    </Card>
  )
}
