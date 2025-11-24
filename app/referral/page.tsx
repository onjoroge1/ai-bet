"use client"

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Gift, 
  TrendingUp, 
  Copy, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Share2,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface ReferralStats {
  totalReferrals: number
  completedReferrals: number
  totalEarned: number
  completionRate: number
}

interface ReferralRecord {
  id: string
  status: string
  createdAt: string
  completedAt?: string
  creditsEarned?: number
  pointsEarned?: number
  metadata: {
    email: string
    fullName?: string
    phone?: string
  }
}

interface ReferralData {
  referralCode: string
  isActive: boolean
  usageCount: number
  maxUsage?: number
  expiresAt?: string
  stats: ReferralStats
  recentReferrals: ReferralRecord[]
}

/**
 * ReferralPage - Server-Side First Authentication
 * 
 * 🔥 NEW ARCHITECTURE: Uses /api/auth/session as primary source of truth
 * - Checks server-side session directly (no waiting for useSession() sync)
 * - Fast and reliable authentication decisions
 * - No blocking on client-side auth sync
 */
export default function ReferralPage() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false) // Server-side auth state

  // 🔥 NEW: Check server-side session on mount and fetch data immediately
  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await res.json()
        const serverIsAuthenticated = !!session?.user
        setIsAuthenticated(serverIsAuthenticated)
        
        if (serverIsAuthenticated && session?.user?.id) {
          fetchReferralData()
        } else {
          setLoading(false)
          setError('Authentication required')
        }
      } catch (error) {
        console.error('[ReferralPage] Auth check error:', error)
        setIsAuthenticated(false)
        setLoading(false)
        setError('Failed to check authentication')
      }
    }
    checkAuthAndFetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only check on mount

  const fetchReferralData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/referrals')
      
      if (!response.ok) {
        throw new Error('Failed to fetch referral data')
      }

      const data = await response.json()
      setReferralData(data.data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const copyReferralLink = async () => {
    if (!referralData?.referralCode) return

    const referralLink = `${window.location.origin}/snapbet-quiz?ref=${referralData.referralCode}`
    
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
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
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareReferralLink = async () => {
    if (!referralData?.referralCode) return

    const referralLink = `${window.location.origin}/snapbet-quiz?ref=${referralData.referralCode}`
    const shareText = `Join me on SnapBet! Take the quiz and earn rewards using my referral code: ${referralData.referralCode}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join SnapBet Quiz',
          text: shareText,
          url: referralLink
        })
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback to copying to clipboard
      copyReferralLink()
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error: {error}</p>
          <button
            onClick={fetchReferralData}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!referralData) {
    return null
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'pending':
        return 'text-yellow-600 bg-yellow-100'
      case 'expired':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      case 'pending':
        return <Clock className="w-4 h-4" />
      case 'expired':
        return <Clock className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back to Dashboard Button */}
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" className="flex items-center text-gray-600 hover:text-gray-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Referral Program</h1>
              <p className="text-blue-100 text-lg">
                Invite friends and earn rewards when they complete the quiz!
              </p>
            </div>
            <Gift className="w-16 h-16 text-blue-200" />
          </div>
        </div>

        {/* Referral Code Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Your Referral Code</h3>
            <div className="flex space-x-2">
              <button
                onClick={copyReferralLink}
                className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={shareReferralLink}
                className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Share this link with friends:</p>
              <p className="text-lg font-mono font-bold text-blue-600 break-all">
                {referralData.referralCode}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Usage: {referralData.usageCount}
                {referralData.maxUsage && ` / ${referralData.maxUsage}`}
              </p>
            </div>
          </div>

          {referralData.expiresAt && (
            <p className="text-sm text-gray-600 mt-3 text-center">
              Expires: {formatDate(referralData.expiresAt)}
            </p>
          )}
        </motion.div>

        {/* Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-800">{referralData.stats.totalReferrals}</p>
                <p className="text-sm text-gray-600">Total Referrals</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-800">{referralData.stats.completedReferrals}</p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-800">{referralData.stats.completionRate}%</p>
                <p className="text-sm text-gray-600">Success Rate</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-yellow-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-800">{referralData.stats.totalEarned}</p>
                <p className="text-sm text-gray-600">Credits Earned</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Referrals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-md border border-gray-200"
        >
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Recent Referrals</h3>
          </div>

          {referralData.recentReferrals.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No referrals yet. Share your referral code to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {referralData.recentReferrals.map((referral) => (
                <div key={referral.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(referral.status)}`}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(referral.status)}
                            <span className="capitalize">{referral.status}</span>
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDate(referral.createdAt)}
                        </span>
                      </div>
                      
                      <div className="mt-2">
                        <p className="font-medium text-gray-800">
                          {referral.metadata.fullName || referral.metadata.email}
                        </p>
                        {referral.metadata.fullName && (
                          <p className="text-sm text-gray-600">{referral.metadata.email}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      {referral.status === 'completed' && (
                        <div className="text-sm">
                          <p className="text-green-600 font-medium">
                            +{referral.creditsEarned} credits
                          </p>
                          <p className="text-blue-600 font-medium">
                            +{referral.pointsEarned} points
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold text-lg">1</span>
              </div>
              <h4 className="font-medium text-gray-800 mb-2">Share Your Code</h4>
              <p className="text-sm text-gray-600">
                Share your unique referral link with friends and family
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-purple-600 font-bold text-lg">2</span>
              </div>
              <h4 className="font-medium text-gray-800 mb-2">They Take the Quiz</h4>
              <p className="text-sm text-gray-600">
                Your friends complete the SnapBet quiz using your referral code
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 font-bold text-lg">3</span>
              </div>
              <h4 className="font-medium text-gray-800 mb-2">Earn Rewards</h4>
              <p className="text-sm text-gray-600">
                Get credits and points when they complete the quiz successfully
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
} 