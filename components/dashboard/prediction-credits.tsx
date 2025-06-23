"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, Crown, Target, Star, Clock, CheckCircle, XCircle, ArrowDownLeft, ArrowUpRight, Sparkles, Zap } from "lucide-react"
import { useUserCountry } from "@/contexts/user-country-context"

interface PredictionCreditsData {
  availableCredits: number
  totalCredits: number
  subscriptionLevel: string
  subscriptionStatus: string
  recentActivity: Array<{
    id: string
    type: string
    credits: number
    status: string
    description: string
    createdAt: string
  }>
}

export function PredictionCredits() {
  const [creditsData, setCreditsData] = useState<PredictionCreditsData | null>(null)
  const [loading, setLoading] = useState(true)
  const { convertPrice, countryData } = useUserCountry()

  useEffect(() => {
    // Simulate fetching prediction credits data
    const fetchCreditsData = async () => {
      // In real implementation, this would fetch from your database
      const mockData: PredictionCreditsData = {
        availableCredits: 15,
        totalCredits: 50,
        subscriptionLevel: "Premium",
        subscriptionStatus: "active",
        recentActivity: [
          {
            id: "1",
            type: "purchase",
            credits: 20,
            status: "completed",
            description: "Premium Package Purchase",
            createdAt: "2024-01-15T10:30:00Z",
          },
          {
            id: "2",
            type: "used",
            credits: -1,
            status: "completed",
            description: "AI Prediction - Arsenal vs Chelsea",
            createdAt: "2024-01-15T09:15:00Z",
          },
          {
            id: "3",
            type: "bonus",
            credits: 5,
            status: "completed",
            description: "Welcome Bonus Credits",
            createdAt: "2024-01-14T16:20:00Z",
          },
          {
            id: "4",
            type: "used",
            credits: -1,
            status: "completed",
            description: "AI Prediction - Man City vs Liverpool",
            createdAt: "2024-01-14T14:10:00Z",
          },
        ],
      }

      setCreditsData(mockData)
      setLoading(false)
    }

    fetchCreditsData()
  }, [])

  const getActivityIcon = (type: string, status: string) => {
    if (status === "pending") return <Clock className="w-4 h-4 text-yellow-400" />
    if (status === "failed") return <XCircle className="w-4 h-4 text-red-400" />

    switch (type) {
      case "purchase":
      case "bonus":
        return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
      case "used":
        return <ArrowUpRight className="w-4 h-4 text-blue-400" />
      default:
        return <CheckCircle className="w-4 h-4 text-emerald-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Completed</Badge>
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>
      default:
        return null
    }
  }

  const getSubscriptionBadge = (level: string) => {
    switch (level.toLowerCase()) {
      case "premium":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Premium</Badge>
      case "pro":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Pro</Badge>
      case "basic":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Basic</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Free</Badge>
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
          <div className="h-8 bg-slate-700 rounded w-1/2"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (!creditsData) return null

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6 relative overflow-hidden">
      {/* Animated background sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(2)].map((_, i) => (
          <Sparkles
            key={i}
            className="absolute w-3 h-3 text-emerald-400/20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Prediction Credits</h3>
          </div>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Zap className="w-4 h-4 mr-1" />
            Get More
          </Button>
        </div>

        {/* Credits Display */}
        <div className="mb-6">
          <div className="text-3xl font-bold text-white mb-1">{creditsData.availableCredits}</div>
          <div className="text-slate-400 text-sm">Available Credits</div>
          <div className="text-xs text-slate-500 mt-1">Total: {creditsData.totalCredits} credits</div>
        </div>

        {/* Subscription Status */}
        <div className="mb-6 p-3 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-lg border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-white text-sm font-medium">Subscription</span>
            </div>
            {getSubscriptionBadge(creditsData.subscriptionLevel)}
          </div>
          <div className="text-slate-400 text-xs mt-1">
            Status: <span className="text-emerald-400 capitalize">{creditsData.subscriptionStatus}</span>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h4 className="text-white font-medium mb-3">Recent Activity</h4>
          <div className="space-y-3">
            {creditsData.recentActivity.slice(0, 4).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getActivityIcon(activity.type, activity.status)}
                  <div>
                    <div className="text-white text-sm font-medium">{activity.description}</div>
                    <div className="text-slate-400 text-xs">{new Date(activity.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${activity.credits > 0 ? "text-emerald-400" : "text-blue-400"}`}>
                    {activity.credits > 0 ? "+" : ""}
                    {activity.credits} credits
                  </div>
                  {getStatusBadge(activity.status)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
            View History
          </Button>
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
            Upgrade Plan
          </Button>
        </div>
      </div>
    </Card>
  )
} 