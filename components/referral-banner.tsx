'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, Users, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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

/**
 * ReferralBanner - Server-Side First Authentication
 * 
 * 🔥 NEW ARCHITECTURE: Uses /api/auth/session for user check
 * - Checks server-side session directly (no waiting for useSession() sync)
 * - Fast and reliable authentication check
 */
export default function ReferralBanner() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // 🔥 NEW: Check server-side session for user ID
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
        console.error('[ReferralBanner] Auth check error:', error)
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
      // Silently handle errors for the banner
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white animate-pulse">
        <div className="h-6 bg-blue-500 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-blue-500 rounded w-1/2 mb-4"></div>
        <div className="h-10 bg-blue-500 rounded w-24"></div>
      </div>
    )
  }

  if (!referralData) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <Gift className="w-6 h-6 mr-2 text-blue-200" />
            <h3 className="text-xl font-bold">Referral Program</h3>
          </div>
          <p className="text-blue-100 mb-4">
            Invite friends and earn rewards when they complete the quiz!
          </p>
          
          {/* Quick Stats */}
          <div className="flex items-center space-x-6 mb-4">
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2 text-blue-200" />
              <span className="text-sm">
                {referralData.stats.totalReferrals} referrals
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-sm">
                {referralData.stats.completedReferrals} completed
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-sm">
                +{referralData.stats.totalEarned} credits earned
              </span>
            </div>
          </div>

          <Link href="/referral">
            <Button className="bg-white text-blue-600 hover:bg-blue-50">
              Manage Referrals
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        
        <div className="hidden md:block">
          <div className="text-center">
            <div className="bg-blue-500/20 rounded-lg p-3 mb-2">
              <p className="text-xs text-blue-200 mb-1">Your Code</p>
              <p className="font-mono font-bold text-lg">{referralData.referralCode}</p>
            </div>
            <p className="text-xs text-blue-200">
              Usage: {referralData.usageCount}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
} 