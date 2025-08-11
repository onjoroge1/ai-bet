"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Users, 
  Gift, 
  Copy, 
  Share2, 
  TrendingUp, 
  Award,
  CheckCircle,
  Clock
} from "lucide-react"
import { toast } from "sonner"

interface ReferralStats {
  referralCode: string
  totalReferrals: number
  totalEarnings: number
  referrals: Array<{
    id: string
    status: string
    pointsEarned: number
    createdAt: string
    referred: {
      fullName: string
      email: string
    }
  }>
}

export function ReferralDashboard() {
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchReferralStats()
  }, [])

  const fetchReferralStats = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/referrals')
      if (!response.ok) {
        throw new Error('Failed to fetch referral stats')
      }
      
      const data = await response.json()
      setStats(data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch referral stats')
    } finally {
      setIsLoading(false)
    }
  }

  const copyReferralLink = async () => {
    if (!stats?.referralCode) return
    
    const referralLink = `${window.location.origin}/snapbet-quiz?ref=${stats.referralCode}`
    
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast.success('Referral link copied to clipboard!')
      
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = referralLink
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      
      setCopied(true)
      toast.success('Referral link copied to clipboard!')
      
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareReferralLink = async () => {
    if (!stats?.referralCode) return
    
    const referralLink = `${window.location.origin}/snapbet-quiz?ref=${stats.referralCode}`
    const shareText = `Join me on SnapBet Football Quiz Challenge! Use my referral code to get bonus points: ${referralLink}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SnapBet Quiz Challenge',
          text: shareText,
          url: referralLink
        })
      } catch (error) {
        // User cancelled sharing
        console.log('Share cancelled')
      }
    } else {
      // Fallback to copying
      copyReferralLink()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-400 mb-4">{error}</p>
        <Button onClick={fetchReferralStats} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center p-8">
        <p className="text-slate-400">No referral data available</p>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400'
      default:
        return 'bg-slate-500/20 text-slate-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      case 'pending':
        return <Clock className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-400" />
              Total Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">{stats.totalReferrals}</div>
            <p className="text-slate-400 text-sm">Friends invited</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center">
              <Gift className="w-5 h-5 mr-2 text-emerald-400" />
              Points Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">{stats.totalEarnings}</div>
            <p className="text-slate-400 text-sm">From referrals</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-400" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400">
              {stats.referrals.length > 0 
                ? Math.round((stats.referrals.filter(r => r.status === 'completed').length / stats.referrals.length) * 100)
                : 0}%
            </div>
            <p className="text-slate-400 text-sm">Completed quizzes</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code Section */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Award className="w-5 h-5 mr-2 text-yellow-400" />
            Your Referral Code
          </CardTitle>
          <p className="text-slate-400 text-sm">
            Share this code with friends to earn 10 points when they complete the quiz
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              value={`${window.location.origin}/snapbet-quiz?ref=${stats.referralCode}`}
              readOnly
              className="bg-slate-900/50 border-slate-600 text-white font-mono text-sm"
            />
            <Button
              onClick={copyReferralLink}
              variant="outline"
              size="sm"
              className="min-w-[100px]"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button
              onClick={shareReferralLink}
              variant="outline"
              size="sm"
              className="min-w-[100px]"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
          
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Gift className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-emerald-400 font-semibold">How it works:</p>
                <ul className="text-emerald-300 text-sm mt-1 space-y-1">
                  <li>• Share your referral link with friends</li>
                  <li>• When they complete the quiz, you get 10 points</li>
                  <li>• Points can be used for premium predictions</li>
                  <li>• No limit on how many friends you can refer!</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral History */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Referral History</CardTitle>
          <p className="text-slate-400 text-sm">
            Track your referrals and their quiz completion status
          </p>
        </CardHeader>
        <CardContent>
          {stats.referrals.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">No referrals yet</p>
              <p className="text-slate-500 text-sm">
                Share your referral code to start earning points!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-slate-700"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex-1">
                        <p className="text-white font-medium">
                          {referral.referred.fullName || referral.referred.email}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {referral.referred.email}
                        </p>
                      </div>
                      <Badge className={getStatusColor(referral.status)}>
                        {getStatusIcon(referral.status)}
                        <span className="ml-1 capitalize">{referral.status}</span>
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-semibold">
                      +{referral.pointsEarned} pts
                    </p>
                    <p className="text-slate-500 text-xs">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 