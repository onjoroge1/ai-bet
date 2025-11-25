"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import Link from "next/link"

interface TipHistoryItem {
  id: string
  tipName: string
  claimedAt: string
  status: 'claimed' | 'used' | 'expired'
  packageName: string
  matchDetails?: {
    homeTeam: string
    awayTeam: string
    prediction: string
    confidence: number
  }
}

/**
 * TipsHistoryWidget - Server-Side First Authentication
 * 
 * 🔥 NEW ARCHITECTURE: Uses /api/auth/session for user check
 * - Checks server-side session directly (no waiting for useSession() sync)
 * - Fast and reliable authentication check
 */
export function TipsHistoryWidget() {
  const [recentTips, setRecentTips] = useState<TipHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  // 🔥 NEW: Check server-side session for authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await res.json()
        setIsAuthenticated(!!session?.user)
      } catch (error) {
        console.error('[TipsHistoryWidget] Auth check error:', error)
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    const fetchRecentTips = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/tips-history?limit=3')
        
        if (!response.ok) {
          throw new Error('Failed to fetch recent tips')
        }
        
        const data = await response.json()
        setRecentTips(data.tips || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recent tips')
      } finally {
        setIsLoading(false)
      }
    }

    if (isAuthenticated) {
      fetchRecentTips()
    }
  }, [isAuthenticated])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'claimed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'used':
        return <TrendingUp className="w-4 h-4 text-blue-500" />
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'claimed':
        return <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">Claimed</Badge>
      case 'used':
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">Used</Badge>
      case 'expired':
        return <Badge variant="secondary" className="bg-red-500/20 text-red-400">Expired</Badge>
      default:
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">Unknown</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-white">Recent Tips</CardTitle>
          </div>
          <Link href="/tips-history">
            <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white">
              View All
            </Button>
          </Link>
        </div>
        <CardDescription className="text-slate-400">
          Your recently claimed tips and their status
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : recentTips.length === 0 ? (
          <div className="text-center py-8">
            <History className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No tips claimed yet</p>
            <Link href="/dashboard/daily-tips">
              <Button variant="outline" size="sm" className="mt-2 border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white">
                Browse Tips
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentTips.map((tip) => (
              <div key={tip.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center space-x-3 flex-1">
                  {getStatusIcon(tip.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{tip.tipName}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-slate-400 text-xs">{tip.packageName}</span>
                      <span className="text-slate-500">•</span>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-400 text-xs">{formatDate(tip.claimedAt)}</span>
                      </div>
                    </div>
                    {tip.matchDetails && (
                      <div className="mt-1">
                        <p className="text-slate-400 text-xs">
                          {tip.matchDetails.homeTeam} vs {tip.matchDetails.awayTeam}
                        </p>
                        <p className="text-emerald-400 text-xs font-medium">
                          {tip.matchDetails.prediction} ({tip.matchDetails.confidence}% confidence)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(tip.status)}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {recentTips.length > 0 && (
          <div className="pt-2 border-t border-slate-700">
            <Link href="/tips-history">
              <Button variant="ghost" size="sm" className="w-full text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                <History className="w-4 h-4 mr-2" />
                View Full History
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 