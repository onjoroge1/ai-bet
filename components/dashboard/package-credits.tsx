"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, Crown, Target, Star, Clock, CheckCircle, XCircle, ArrowDownLeft, ArrowUpRight, Sparkles, Zap, Calendar, AlertCircle, Gift } from "lucide-react"
import { useUserCountry } from "@/contexts/user-country-context"
import { useRouter } from "next/navigation"

interface UserPackage {
  id: string
  purchasedAt: string
  expiresAt: string
  tipsRemaining: number
  totalTips: number
  status: string
  pricePaid: number
  currencyCode: string
  currencySymbol: string
  packageOffer: {
    name: string
    packageType: string
    tipCount: number
    validityDays: number
    iconName: string
    colorGradientFrom: string
    colorGradientTo: string
  }
}

interface PackageStatus {
  userPackages: UserPackage[]
  totalTipsRemaining: string | number
  hasUnlimited: boolean
}

interface QuizCredits {
  points: number
  totalEarned: number
  totalSpent: number
}

interface TipClaimActivity {
  id: string
  predictionId: string
  claimedAt: string
  match: {
    homeTeam: { name: string }
    awayTeam: { name: string }
  }
  packageOffer: {
    name: string
  }
}

export function PackageCredits() {
  const [packageStatus, setPackageStatus] = useState<PackageStatus | null>(null)
  const [quizCredits, setQuizCredits] = useState<QuizCredits | null>(null)
  const [recentActivity, setRecentActivity] = useState<TipClaimActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { convertPrice } = useUserCountry()
  const router = useRouter()

  useEffect(() => {
    fetchPackageData()
  }, [])

  const fetchPackageData = async () => {
    try {
      // Fetch package status
      const statusResponse = await fetch("/api/user-packages/claim-tip")
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setPackageStatus(statusData)
      }

      // Fetch quiz credits
      const quizResponse = await fetch("/api/user/points")
      if (quizResponse.ok) {
        const quizData = await quizResponse.json()
        setQuizCredits(quizData)
      }

      // Fetch recent tip claiming activity
      const activityResponse = await fetch("/api/user-packages/recent-activity")
      if (activityResponse.ok) {
        const activityData = await activityResponse.json()
        setRecentActivity(activityData)
      }
    } catch (error) {
      console.error("Error fetching package data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "Zap": return <Zap className="w-4 h-4" />
      case "Calendar": return <Calendar className="w-4 h-4" />
      case "TrendingUp": return <Target className="w-4 h-4" />
      case "Crown": return <Crown className="w-4 h-4" />
      default: return <Gift className="w-4 h-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
      case "expired":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Expired</Badge>
      case "completed":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Completed</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Unknown</Badge>
    }
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()
    
    if (diff <= 0) return "Expired"
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h`
    return "Less than 1h"
  }

  const isExpiringSoon = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()
    const hours = diff / (1000 * 60 * 60)
    return hours <= 24 && hours > 0
  }

  const handleGetMoreTips = () => {
    // Scroll to personalized offers section
    const offersSection = document.querySelector('[data-section="personalized-offers"]')
    if (offersSection) {
      offersSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleViewAllPackages = () => {
    router.push('/dashboard/my-tips')
  }

  if (isLoading) {
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

  // Don't show anything if user has no packages
  if (!packageStatus || packageStatus.userPackages.length === 0) {
    // Calculate total credits from quiz points
    const quizCreditsCount = quizCredits ? Math.floor(quizCredits.points / 50) : 0
    const totalAvailableCredits = quizCreditsCount

    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6 relative overflow-hidden">
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
          </div>

          <div className="text-center py-8">
            <div className="text-3xl font-bold text-white mb-2">{totalAvailableCredits}</div>
            <div className="text-slate-400 text-sm mb-4">Available Tips</div>
            
            {quizCreditsCount > 0 ? (
              <div className="mb-6">
                <p className="text-slate-400 text-sm mb-2">You have credits from quiz completion!</p>
                <div className="bg-emerald-800/30 rounded-lg p-3 border border-emerald-700/50">
                  <div className="text-emerald-200 text-sm">
                    <span className="font-medium">Quiz Credits:</span> {quizCreditsCount} tips
                  </div>
                  <div className="text-emerald-100 text-xs mt-1">
                    From {quizCredits?.points} quiz points (50:1 conversion)
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-sm mb-6">Complete the SnapBet Quiz or purchase a package to start getting AI predictions!</p>
            )}
            
            <div className="flex gap-2 justify-center">
              <Button onClick={() => router.push('/snapbet-quiz')} className="bg-emerald-600 hover:bg-emerald-700">
                <Zap className="w-4 h-4 mr-1" />
                Take Quiz
              </Button>
              <Button onClick={handleGetMoreTips} className="bg-blue-600 hover:bg-blue-700">
                <Gift className="w-4 h-4 mr-1" />
                Get Package
              </Button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const activePackages = packageStatus.userPackages.filter(pkg => pkg.status === 'active')
  const expiringSoon = activePackages.filter(pkg => isExpiringSoon(pkg.expiresAt))

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
          <Button size="sm" onClick={handleGetMoreTips} className="bg-emerald-600 hover:bg-emerald-700">
            <Zap className="w-4 h-4 mr-1" />
            Get More
          </Button>
        </div>

        {/* Credits Display */}
        <div className="mb-6">
          {(() => {
            const quizCreditsCount = quizCredits ? Math.floor(quizCredits.points / 50) : 0
            const packageCreditsCount = packageStatus.hasUnlimited ? "∞" : Number(packageStatus.totalTipsRemaining)
            const totalCredits = packageStatus.hasUnlimited ? "∞" : (Number(packageStatus.totalTipsRemaining) + quizCreditsCount)
            
            return (
              <>
                <div className="text-3xl font-bold text-white mb-1">
                  {totalCredits}
                </div>
                <div className="text-slate-400 text-sm">
                  {packageStatus.hasUnlimited ? "Unlimited Tips" : "Available Tips"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {activePackages.length} active package{activePackages.length !== 1 ? 's' : ''}
                  {quizCreditsCount > 0 && ` + ${quizCreditsCount} quiz credits`}
                </div>
                
                {/* Quiz Credits Info */}
                {quizCreditsCount > 0 && (
                  <div className="mt-3 p-2 bg-emerald-800/30 rounded border border-emerald-700/50">
                    <div className="text-emerald-200 text-xs">
                      <span className="font-medium">Quiz Credits:</span> {quizCreditsCount} tips
                      <span className="text-emerald-100 ml-1">
                        (from {quizCredits?.points} points)
                      </span>
                    </div>
                  </div>
                )}
                {/* Claim Prediction Tips Button */}
                <div className="mt-4">
                  <a href="/dashboard/predictions">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                      🎯 Claim Prediction Tips
                    </Button>
                  </a>
                </div>
              </>
            )
          })()}
        </div>

        {/* Expiring Soon Warning */}
        {expiringSoon.length > 0 && (
          <div className="mb-6 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-white text-sm font-medium">Package Expiring Soon</span>
            </div>
            <div className="text-slate-400 text-xs mt-1">
              {expiringSoon[0].packageOffer.name} expires in {getTimeRemaining(expiringSoon[0].expiresAt)}
            </div>
          </div>
        )}

        {/* Active Packages */}
        <div className="mb-6">
          <h4 className="text-white font-medium mb-3">Active Packages</h4>
          <div className="space-y-2">
            {activePackages.slice(0, 2).map((userPackage) => (
              <div
                key={userPackage.id}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${userPackage.packageOffer.colorGradientFrom}10, ${userPackage.packageOffer.colorGradientTo}10)`
                }}
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${userPackage.packageOffer.colorGradientFrom}, ${userPackage.packageOffer.colorGradientTo})`
                    }}
                  >
                    {getIconComponent(userPackage.packageOffer.iconName)}
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">
                      {userPackage.packageOffer.name}
                    </div>
                    <div className="text-slate-400 text-xs">
                      {userPackage.packageOffer.tipCount === -1 
                        ? "Unlimited tips" 
                        : `${userPackage.tipsRemaining}/${userPackage.totalTips} tips`
                      }
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 text-xs font-medium">
                    {userPackage.currencySymbol}{userPackage.pricePaid}
                  </div>
                  <div className="text-slate-400 text-xs">
                    {getTimeRemaining(userPackage.expiresAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {activePackages.length > 2 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleViewAllPackages}
              className="w-full mt-2 border-slate-600 text-slate-300"
            >
              View All ({activePackages.length} packages)
            </Button>
          )}
        </div>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div>
            <h4 className="text-white font-medium mb-3">Recent Activity</h4>
            <div className="space-y-3">
              {recentActivity.slice(0, 3).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <ArrowUpRight className="w-4 h-4 text-blue-400" />
                    <div>
                      <div className="text-white text-sm font-medium">
                        {activity.match.homeTeam.name} vs {activity.match.awayTeam.name}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {new Date(activity.claimedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-blue-400 text-sm font-medium">
                      -1 tip
                    </div>
                    <div className="text-slate-400 text-xs">
                      {activity.packageOffer.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={handleViewAllPackages} className="border-slate-600 text-slate-300">
            View History
          </Button>
          <Button variant="outline" size="sm" onClick={handleGetMoreTips} className="border-slate-600 text-slate-300">
            Buy More
          </Button>
        </div>
      </div>
    </Card>
  )
} 