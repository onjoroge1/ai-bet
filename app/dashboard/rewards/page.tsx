"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, Trophy, Gift, ArrowDownLeft, ArrowUpRight, Sparkles, Zap, Target, Copy, Share2, Award, Coins } from "lucide-react"
import { toast } from "sonner"
import { SkeletonCard } from "@/components/match/shared"
import { cn } from "@/lib/utils"
import dynamic from "next/dynamic"

const QuizCreditClaim = dynamic(() => import("@/components/quiz/QuizCreditClaim"), {
  loading: () => <div className="h-32 bg-slate-800/30 rounded-xl border border-slate-800/50 animate-pulse" />,
})

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

interface ReferralData {
  referralCode: string
  isActive: boolean
  usageCount: number
  stats: {
    totalReferrals: number
    completedReferrals: number
    totalEarned: number
    completionRate: number
  }
}

export default function RewardsPage() {
  const [pointsData, setPointsData] = useState<UserPointsData | null>(null)
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userReferralCode, setUserReferralCode] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await res.json()
        if (session?.user) {
          setUserId(session.user.id)
          setUserReferralCode((session.user as any).referralCode || null)
        }
      } catch (error) {
        console.error('[RewardsPage] Error fetching user data:', error)
      }
    }
    fetchUserData()
  }, [])

  useEffect(() => {
    fetchPointsData()
    fetchReferralData()
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

  const fetchReferralData = async () => {
    try {
      const response = await fetch("/api/referrals")
      if (response.ok) {
        const data = await response.json()
        setReferralData(data.data)
      }
    } catch (error) {
      console.error("Error fetching referral data:", error)
    }
  }

  const referralCode = referralData?.referralCode || userReferralCode || userId?.slice(-8).toUpperCase() || "SNAP"
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/snapbet-quiz?ref=${referralCode}`
    : ''

  const copyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast.success('Referral link copied!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="h-8 bg-slate-700/40 rounded w-64 mb-2 animate-pulse" />
            <div className="h-4 bg-slate-700/30 rounded w-96 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Award className="w-7 h-7 text-emerald-400" />
            Rewards & Credits
          </h1>
          <p className="text-slate-400 mt-1">
            Manage your quiz credits, referral rewards, and points
          </p>
        </div>
      </div>

      {/* ── Points Overview ─────────────────────────────────────── */}
      {pointsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-emerald-500/10 rounded-lg p-3">
                  <Coins className="w-6 h-6 text-emerald-400" />
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  Current Balance
                </Badge>
              </div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Quiz Credits</p>
              <p className="text-3xl font-bold text-white">{pointsData.points}</p>
              <p className="text-xs text-slate-500 mt-2">
                Last updated: {new Date(pointsData.lastUpdated).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/60 border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-500/10 rounded-lg p-3">
                  <ArrowUpRight className="w-6 h-6 text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Earned</p>
              <p className="text-3xl font-bold text-white">+{pointsData.totalEarned}</p>
              <p className="text-xs text-slate-500 mt-2">All time credits earned</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/60 border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-orange-500/10 rounded-lg p-3">
                  <ArrowDownLeft className="w-6 h-6 text-orange-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Spent</p>
              <p className="text-3xl font-bold text-white">{pointsData.totalSpent}</p>
              <p className="text-xs text-slate-500 mt-2">Credits used on predictions</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Quiz Credit Claim ───────────────────────────────────── */}
      <QuizCreditClaim />

      {/* ── Referral Rewards ────────────────────────────────────── */}
      {referralData && (
        <Card className="bg-slate-800/60 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-400" />
              Referral Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-slate-700/30 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Total Referrals</p>
                <p className="text-2xl font-bold text-white">{referralData.stats.totalReferrals}</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Completed</p>
                <p className="text-2xl font-bold text-white">{referralData.stats.completedReferrals}</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Credits Earned</p>
                <p className="text-2xl font-bold text-emerald-400">+{referralData.stats.totalEarned}</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Completion Rate</p>
                <p className="text-2xl font-bold text-white">
                  {referralData.stats.completionRate > 0 
                    ? `${referralData.stats.completionRate.toFixed(0)}%`
                    : '0%'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-700/30 rounded-lg p-3 border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1">Your Referral Code</p>
                <code className="text-lg font-mono font-bold text-emerald-400">{referralCode}</code>
              </div>
              <Button
                onClick={copyReferralLink}
                variant="outline"
                className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
              >
                {copied ? <Target className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="mt-4">
              <Button
                asChild
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <a href="/dashboard/referrals">
                  Manage Referrals
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Transactions ─────────────────────────────────── */}
      {pointsData && pointsData.recentTransactions && pointsData.recentTransactions.length > 0 && (
        <Card className="bg-slate-800/60 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pointsData.recentTransactions.slice(0, 10).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "rounded-full p-2",
                      transaction.amount > 0 
                        ? "bg-emerald-500/10" 
                        : "bg-orange-500/10"
                    )}>
                      {transaction.amount > 0 ? (
                        <ArrowUpRight className={cn("w-4 h-4", transaction.amount > 0 ? "text-emerald-400" : "text-orange-400")} />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 text-orange-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{transaction.description}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-bold",
                      transaction.amount > 0 ? "text-emerald-400" : "text-orange-400"
                    )}>
                      {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                    </p>
                    <p className="text-xs text-slate-500">{transaction.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── How to Earn More ───────────────────────────────────── */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            How to Earn More Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: 'Complete Quizzes',
                description: 'Earn credits by completing daily quizzes',
                icon: Brain,
                color: 'text-blue-400',
              },
              {
                title: 'Refer Friends',
                description: 'Get credits when friends complete quizzes',
                icon: Gift,
                color: 'text-purple-400',
              },
              {
                title: 'Win Predictions',
                description: 'Earn bonus credits for successful bets',
                icon: Trophy,
                color: 'text-yellow-400',
              },
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-700/30 rounded-lg p-4 border border-slate-700/50">
                <item.icon className={cn("w-6 h-6 mb-3", item.color)} />
                <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

