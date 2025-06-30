"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, Trophy, Gift, ArrowDownLeft, ArrowUpRight, Sparkles, Zap, Target, Copy, Share2, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

interface UserPointsData {
  points: number
  totalEarned: number
  totalSpent: number
  lastUpdated: string
  recentTransactions: Array<{
    id: string
    amount: number
    type: string
    description: string
    createdAt: string
    reference: string
  }>
}

export function QuizCredits() {
  const [pointsData, setPointsData] = useState<UserPointsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  // Generate referral link based on user's referral code or ID
  const referralCode = user?.referralCode || user?.id?.slice(-8).toUpperCase() || "SNAP"
  const referralLink = `https://snapbet.bet/snapbet-quiz?ref=${referralCode}`

  useEffect(() => {
    fetchPointsData()
  }, [])

  const fetchPointsData = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/user/points")
      if (response.ok) {
        const data = await response.json()
        setPointsData(data)
      }
    } catch (error) {
      console.error("Error fetching points data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const handleShare = () => {
    const message = `Take the SnapBet Football Quiz and win prediction credits! ${referralLink}`
    if (navigator.share) {
      navigator.share({
        title: 'SnapBet Quiz',
        text: message,
        url: referralLink
      })
    } else {
      // Fallback to copying
      handleCopy()
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "QUIZ_COMPLETION":
        return <Trophy className="w-4 h-4 text-emerald-400" />
      case "REFERRAL":
        return <Gift className="w-4 h-4 text-blue-400" />
      case "PACKAGE_PURCHASE":
        return <Brain className="w-4 h-4 text-purple-400" />
      case "TIP_USAGE":
        return <Target className="w-4 h-4 text-orange-400" />
      default:
        return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
    }
  }

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "QUIZ_COMPLETION":
        return "Quiz Completion"
      case "REFERRAL":
        return "Referral Bonus"
      case "PACKAGE_PURCHASE":
        return "Package Purchase"
      case "TIP_USAGE":
        return "Tip Usage"
      default:
        return type
    }
  }

  const handleTakeQuiz = () => {
    router.push("/snapbet-quiz")
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Quiz Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const creditsCount = pointsData ? Math.floor(pointsData.points / 50) : 0
  const referralCount = pointsData?.recentTransactions.filter(t => t.type === "REFERRAL").length || 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Quiz Credits Overview */}
      <div className="lg:col-span-2">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-emerald-400" />
              <span>Quiz Credits</span>
            </CardTitle>
            <div className="text-slate-400 text-sm">
              50 Quiz Points = 1 Prediction Credit
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-emerald-400">{pointsData?.points || 0}</div>
                <div className="text-slate-400 text-sm">Total Points</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-white">{creditsCount}</div>
                <div className="text-slate-400 text-sm">Available Credits</div>
              </div>
            </div>
            
            <Button 
              onClick={handleTakeQuiz}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-600 hover:to-cyan-500 text-white"
            >
              <Zap className="w-4 h-4 mr-2" />
              Take Quiz & Earn More Credits
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link Section */}
      <div>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Gift className="w-5 h-5 text-blue-400" />
              <span>Refer Friends</span>
            </CardTitle>
            <div className="text-slate-400 text-sm">
              Earn 10 points per friend who completes the quiz
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Referral Stats */}
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400 text-sm">Friends Referred</span>
              </div>
              <div className="text-lg font-bold text-white">{referralCount}</div>
            </div>

            {/* Referral Link */}
            <div>
              <div className="text-slate-400 text-sm mb-2">Your Referral Link</div>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-slate-900 rounded px-3 py-2 text-slate-300 text-xs font-mono truncate">
                  {referralLink}
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCopy}
                  className={`border-slate-600 text-slate-300 hover:bg-slate-800 ${copied ? 'ring-2 ring-emerald-400' : ''}`}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Share Button */}
            <Button 
              onClick={handleShare}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Link
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 