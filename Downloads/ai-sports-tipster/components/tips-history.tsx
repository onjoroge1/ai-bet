import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, CheckCircle, XCircle, Clock } from "lucide-react"

export function TipsHistory() {
  const tips = [
    {
      id: 1,
      date: "2024-01-15",
      match: "Arsenal vs Chelsea",
      league: "Premier League",
      prediction: "Over 2.5 Goals",
      confidence: 92,
      odds: "1.85",
      stake: "KES 2,000",
      status: "won",
      profit: "+KES 3,500",
    },
    {
      id: 2,
      date: "2024-01-14",
      match: "Barcelona vs Madrid",
      league: "La Liga",
      prediction: "Barcelona Win",
      confidence: 78,
      odds: "2.10",
      stake: "KES 1,500",
      status: "lost",
      profit: "-KES 1,500",
    },
    {
      id: 3,
      date: "2024-01-13",
      match: "Bayern vs Dortmund",
      league: "Bundesliga",
      prediction: "BTTS",
      confidence: 84,
      odds: "1.65",
      stake: "KES 2,500",
      status: "won",
      profit: "+KES 4,125",
    },
    {
      id: 4,
      date: "2024-01-12",
      match: "PSG vs Marseille",
      league: "Ligue 1",
      prediction: "PSG -1.5",
      confidence: 89,
      odds: "1.95",
      stake: "KES 3,000",
      status: "won",
      profit: "+KES 5,850",
    },
    {
      id: 5,
      date: "2024-01-11",
      match: "Man City vs Liverpool",
      league: "Premier League",
      prediction: "Under 3.5",
      confidence: 76,
      odds: "2.20",
      stake: "KES 1,000",
      status: "pending",
      profit: "KES 2,200",
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "won":
        return "text-emerald-400"
      case "lost":
        return "text-red-400"
      case "pending":
        return "text-yellow-400"
      default:
        return "text-slate-400"
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-xl font-semibold text-white mb-4 md:mb-0">Tips History</h2>

        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search matches..."
              className="pl-10 bg-slate-900/50 border-slate-600 text-white w-full md:w-64"
            />
          </div>
          <Select>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white w-full md:w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-slate-400 font-medium py-3">Date</th>
              <th className="text-left text-slate-400 font-medium py-3">Match</th>
              <th className="text-left text-slate-400 font-medium py-3">Prediction</th>
              <th className="text-left text-slate-400 font-medium py-3">Confidence</th>
              <th className="text-left text-slate-400 font-medium py-3">Odds</th>
              <th className="text-left text-slate-400 font-medium py-3">Stake</th>
              <th className="text-left text-slate-400 font-medium py-3">Status</th>
              <th className="text-left text-slate-400 font-medium py-3">Profit/Loss</th>
            </tr>
          </thead>
          <tbody>
            {tips.map((tip) => (
              <tr key={tip.id} className="border-b border-slate-800 hover:bg-slate-900/30">
                <td className="py-4 text-slate-300">{tip.date}</td>
                <td className="py-4">
                  <div>
                    <div className="text-white font-medium">{tip.match}</div>
                    <div className="text-slate-400 text-sm">{tip.league}</div>
                  </div>
                </td>
                <td className="py-4 text-white">{tip.prediction}</td>
                <td className="py-4">
                  <Badge className="bg-slate-700 text-slate-300">{tip.confidence}%</Badge>
                </td>
                <td className="py-4 text-slate-300">{tip.odds}</td>
                <td className="py-4 text-slate-300">{tip.stake}</td>
                <td className="py-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(tip.status)}
                    <span className={`capitalize ${getStatusColor(tip.status)}`}>{tip.status}</span>
                  </div>
                </td>
                <td className={`py-4 font-semibold ${getStatusColor(tip.status)}`}>{tip.profit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
