"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Gift, Users, ArrowRight, Copy, Share2, Check, TrendingUp, Target, Award } from 'lucide-react'
import { toast } from 'sonner'
import { SkeletonCard } from '@/components/match/shared'
import { cn } from '@/lib/utils'

interface ReferralStats {
  totalReferrals: number
  completedReferrals: number
  totalEarned: number
  completionRate: number
}

interface ReferralData {
  referralCode: string
  isActive: boolean
  usageCount: number
  stats: ReferralStats
}

export default function ReferralsPage() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await res.json()
        if (session?.user?.id) {
          setUserId(session.user.id)
        }
      } catch (error) {
        console.error('[ReferralsPage] Auth check error:', error)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    if (userId) {
      fetchReferralData()
    }
  }, [userId])

  const fetchReferralData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/referrals')
      
      if (response.ok) {
        const data = await response.json()
        setReferralData(data.data)
      }
    } catch (error) {
      console.error('Error fetching referral data:', error)
      toast.error('Failed to load referral data')
    } finally {
      setLoading(false)
    }
  }

  const referralCode = referralData?.referralCode || userId?.slice(-8).toUpperCase() || "SNAP"
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

  const shareReferralLink = async () => {
    if (navigator.share && referralLink) {
      try {
        await navigator.share({
          title: 'Join SnapBet AI',
          text: `Use my referral code ${referralCode} to get started!`,
          url: referralLink,
        })
        toast.success('Shared successfully!')
      } catch (error) {
        // User cancelled or error
        copyReferralLink()
      }
    } else {
      copyReferralLink()
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

  if (!referralData) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift className="w-7 h-7 text-emerald-400" />
            Referral Program
          </h1>
          <p className="text-slate-400 mt-1">
            Invite friends and earn rewards
          </p>
        </div>
        <Card className="bg-slate-800/40 border-slate-700/40">
          <CardContent className="py-16 text-center">
            <Gift className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Referral Data</h3>
            <p className="text-slate-400 mb-4">
              Unable to load your referral information. Please try again later.
            </p>
            <Button onClick={fetchReferralData} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift className="w-7 h-7 text-emerald-400" />
            Referral Program
          </h1>
          <p className="text-slate-400 mt-1">
            Invite friends and earn rewards when they complete the quiz
          </p>
        </div>
      </div>

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/30">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center mb-3">
                <Gift className="w-6 h-6 mr-2 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Share Your Referral Code</h2>
              </div>
              <p className="text-slate-300 mb-4">
                Earn credits when your friends complete the quiz using your referral code.
              </p>
              
              {/* Referral Code Display */}
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4 border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Your Referral Code</p>
                <div className="flex items-center gap-3">
                  <code className="text-2xl font-mono font-bold text-emerald-400">
                    {referralCode}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyReferralLink}
                    className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={copyReferralLink}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
                <Button
                  onClick={shareReferralLink}
                  variant="outline"
                  className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
            
            <div className="text-center md:text-right">
              <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/30">
                <p className="text-xs text-blue-300 mb-1">Total Usage</p>
                <p className="text-3xl font-bold text-white">{referralData.usageCount}</p>
                <p className="text-xs text-blue-300 mt-1">times used</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/60 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 rounded-lg p-2">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total Referrals</p>
                <p className="text-2xl font-bold text-white">{referralData.stats.totalReferrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 rounded-lg p-2">
                <Target className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Completed</p>
                <p className="text-2xl font-bold text-white">{referralData.stats.completedReferrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500/10 rounded-lg p-2">
                <Award className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Credits Earned</p>
                <p className="text-2xl font-bold text-white">+{referralData.stats.totalEarned}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/10 rounded-lg p-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Completion Rate</p>
                <p className="text-2xl font-bold text-white">
                  {referralData.stats.completionRate > 0 
                    ? `${referralData.stats.completionRate.toFixed(0)}%`
                    : '0%'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── How It Works ────────────────────────────────────────── */}
      <Card className="bg-slate-800/60 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-emerald-400" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: 1,
                title: 'Share Your Code',
                description: 'Copy your referral link and share it with friends',
                icon: Share2,
                color: 'text-blue-400',
              },
              {
                step: 2,
                title: 'They Complete Quiz',
                description: 'Your friends use your code when completing the quiz',
                icon: Target,
                color: 'text-emerald-400',
              },
              {
                step: 3,
                title: 'You Earn Credits',
                description: 'Get credits when they complete the quiz successfully',
                icon: Award,
                color: 'text-yellow-400',
              },
            ].map((item) => (
              <div key={item.step} className="bg-slate-700/30 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("bg-slate-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold text-white")}>
                    {item.step}
                  </div>
                  <item.icon className={cn("w-5 h-5", item.color)} />
                </div>
                <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Status Badge ───────────────────────────────────────── */}
      {referralData.isActive ? (
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-sm text-emerald-400">
              Your referral program is active and ready to use!
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-500/10 border-slate-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-slate-500" />
            <p className="text-sm text-slate-400">
              Your referral program is currently inactive.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

