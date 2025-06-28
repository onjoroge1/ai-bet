"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingBag, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, Target } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"

interface PurchasedTip {
  id: string
  name: string
  purchaseDate: string
  amount: number
  paymentMethod: string
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  venue: string | null
  league: string | null
  matchStatus: string | null
  predictionType: string | null
  confidenceScore: number | null
  odds: number | null
  valueRating: string | null
  analysisSummary: string | null
  type: string
  price: number
  description: string
  features: string[]
  isUrgent: boolean
  timeLeft: string | null
  currencySymbol: string
  currencyCode: string
}

export function MyTipsWidget() {
  const [purchasedTips, setPurchasedTips] = useState<PurchasedTip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    const fetchPurchasedTips = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/my-tips')
        
        if (!response.ok) {
          throw new Error('Failed to fetch purchased tips')
        }
        
        const data = await response.json()
        // Take only the first 3 tips for the widget
        setPurchasedTips(data.slice(0, 3) || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load purchased tips')
      } finally {
        setIsLoading(false)
      }
    }

    if (user) {
      fetchPurchasedTips()
    }
  }, [user])

  const getMatchStatusIcon = (status: string | null) => {
    if (!status) return <Clock className="w-4 h-4 text-yellow-500" />
    switch (status.toLowerCase()) {
      case 'live':
        return <TrendingUp className="w-4 h-4 text-red-500" />
      case 'finished':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'upcoming':
        return <Clock className="w-4 h-4 text-blue-500" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  const getPredictionTypeLabel = (type: string | null) => {
    if (!type) return 'No Prediction'
    switch (type) {
      case 'home_win': return 'Home Win'
      case 'away_win': return 'Away Win'
      case 'draw': return 'Draw'
      default: return type
    }
  }

  const getValueRatingColor = (rating: string | null) => {
    if (!rating) return 'bg-gray-500'
    switch (rating.toLowerCase()) {
      case 'very high': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatPurchaseDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  if (!user) {
    return null
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-white">My Purchased Tips</CardTitle>
          </div>
          <Link href="/dashboard/my-tips">
            <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white">
              View All
            </Button>
          </Link>
        </div>
        <CardDescription className="text-slate-400">
          Your recently purchased predictions and tips
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
        ) : purchasedTips.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingBag className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No tips purchased yet</p>
            <Link href="/dashboard/matches">
              <Button variant="outline" size="sm" className="mt-2 border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white">
                Browse Predictions
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {purchasedTips.map((tip) => (
              <div key={tip.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center space-x-3 flex-1">
                  {getMatchStatusIcon(tip.matchStatus)}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{tip.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-slate-400 text-xs">{tip.currencySymbol}{tip.price}</span>
                      <span className="text-slate-500">•</span>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-400 text-xs">{formatPurchaseDate(tip.purchaseDate)}</span>
                      </div>
                    </div>
                    <div className="mt-1">
                      <p className="text-slate-400 text-xs">
                        {tip.homeTeam} vs {tip.awayTeam}
                      </p>
                      {tip.predictionType && (
                        <p className="text-emerald-400 text-xs font-medium">
                          {getPredictionTypeLabel(tip.predictionType)}
                          {tip.confidenceScore && ` (${tip.confidenceScore}% confidence)`}
                        </p>
                      )}
                      {tip.valueRating && (
                        <Badge className={`${getValueRatingColor(tip.valueRating)} text-white text-xs mt-1`}>
                          {tip.valueRating} Value
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                    Purchased
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {purchasedTips.length > 0 && (
          <div className="pt-2 border-t border-slate-700">
            <Link href="/dashboard/my-tips">
              <Button variant="ghost" size="sm" className="w-full text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                <Target className="w-4 h-4 mr-2" />
                View All Purchased Tips
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 