"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, Crown, Target, Star, Clock, CheckCircle, XCircle, ArrowDownLeft, ArrowUpRight, Sparkles, Zap, RefreshCw } from "lucide-react"
import { useUserCountry } from "@/contexts/user-country-context"

interface PredictionCreditsData {
  currentCredits: number
  directCredits: number
  creditBreakdown: {
    packageCredits: number
    quizCredits: number
    totalCredits: number
    hasUnlimited: boolean
  }
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
  const [refreshing, setRefreshing] = useState(false)
  const { convertPrice, countryData } = useUserCountry()

  const fetchCreditsData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      
      // Fetch real credit balance from API
      const response = await fetch('/api/credits/balance')
      if (response.ok) {
        const data = await response.json()
        
        // Transform API data to component format
        const transformedData: PredictionCreditsData = {
          currentCredits: data.data.currentCredits,
          directCredits: data.data.directCredits,
          creditBreakdown: data.data.creditBreakdown,
          recentActivity: [
            {
              id: "1",
              type: "package",
              credits: data.data.creditBreakdown.packageCredits,
              status: "completed",
              description: "Package Credits Available",
              createdAt: new Date().toISOString(),
            },
            {
              id: "2",
              type: "quiz",
              credits: data.data.creditBreakdown.quizCredits,
              status: "completed",
              description: "Quiz Credits Available",
              createdAt: new Date().toISOString(),
            },
            {
              id: "3",
              type: "direct",
              credits: data.data.directCredits,
              status: "completed",
              description: "Direct Credits Available",
              createdAt: new Date().toISOString(),
            }
          ]
        }
        
        setCreditsData(transformedData)
      } else {
        console.error('Failed to fetch credit balance')
        // Fallback to mock data if API fails
        setCreditsData({
          currentCredits: 0,
          directCredits: 0,
          creditBreakdown: {
            packageCredits: 0,
            quizCredits: 0,
            totalCredits: 0,
            hasUnlimited: false
          },
          recentActivity: []
        })
      }
    } catch (error) {
      console.error('Error fetching credits:', error)
      // Fallback to mock data if API fails
      setCreditsData({
        currentCredits: 0,
        directCredits: 0,
        creditBreakdown: {
          packageCredits: 0,
          quizCredits: 0,
          totalCredits: 0,
          hasUnlimited: false
        },
        recentActivity: []
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchCreditsData()
  }, [])

  // Expose refresh function for parent components
  useEffect(() => {
    // Add to window for global access (for debugging/testing)
    if (typeof window !== 'undefined') {
      (window as any).refreshPredictionCredits = fetchCreditsData
    }
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
          <div className="flex items-center space-x-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => fetchCreditsData(true)}
              disabled={refreshing}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Zap className="w-4 h-4 mr-1" />
              Get More
            </Button>
          </div>
        </div>

        {/* Credits Display */}
        <div className="mb-6">
          <div className="text-3xl font-bold text-white mb-1">{creditsData.currentCredits}</div>
          <div className="text-slate-400 text-sm">Available Credits</div>
          <div className="text-xs text-slate-500 mt-1">Total: {creditsData.creditBreakdown.totalCredits} credits</div>
        </div>

        {/* Subscription Status */}
        <div className="mb-6 p-3 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-lg border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-white text-sm font-medium">Credit Breakdown</span>
            </div>
            {creditsData.creditBreakdown.hasUnlimited ? (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Unlimited</Badge>
            ) : (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Limited</Badge>
            )}
          </div>
          <div className="text-slate-400 text-xs mt-1">
            Package: <span className="text-emerald-400">{creditsData.creditBreakdown.packageCredits}</span> • 
            Quiz: <span className="text-blue-400">{creditsData.creditBreakdown.quizCredits}</span> • 
            Direct: <span className="text-yellow-400">{creditsData.directCredits}</span>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h4 className="text-white font-medium mb-3">Recent Activity</h4>
          <div className="space-y-3">
            {creditsData.recentActivity.slice(0, 4).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center space-x-3">
                  {/* Map type to icon */}
                  {activity.type === "package" && <Sparkles className="w-4 h-4 text-emerald-400" />}
                  {activity.type === "quiz" && <Target className="w-4 h-4 text-blue-400" />}
                  {activity.type === "direct" && <ArrowDownLeft className="w-4 h-4 text-emerald-400" />}
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