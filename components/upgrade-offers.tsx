"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Crown, Zap, Star, TrendingUp, Shield, Target, Gift, Clock, Users, Loader2 } from "lucide-react"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
import { useUserCountry } from "@/contexts/user-country-context"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type QuickPurchaseItem = {
  id: string
  name: string
  price: string
  originalPrice?: string
  description: string
  features: string[]
  type: "tip" | "package" | "vip"
  iconName: keyof typeof import("lucide-react")
  colorGradientFrom: string
  colorGradientTo: string
  isUrgent?: boolean
  timeLeft?: string
  isPopular?: boolean
  discountPercentage?: number
  targetLink?: string
  confidenceScore?: number
  matchData?: {
    home_team: string
    away_team: string
    league: string
    date: string
  }
  country?: {
    currencyCode: string
    currencySymbol: string
  }
}

export function UpgradeOffers() {
  const [items, setItems] = useState<QuickPurchaseItem[]>([])
  const [selectedItem, setSelectedItem] = useState<QuickPurchaseItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { convertPrice } = useUserCountry()
  const router = useRouter()

  useEffect(() => {
    fetchQuickPurchases()
  }, [])

  const fetchQuickPurchases = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/quick-purchases")
      if (!response.ok) throw new Error("Failed to fetch quick purchases")
      const data = await response.json()
      
      // Filter for prediction/tip type items that have match data and are upcoming
      const predictionMatches = data.filter((item: any) => 
        (item.type === 'prediction' || item.type === 'tip') && 
        item.matchId && 
        item.isPredictionActive &&
        item.matchData?.date &&
        new Date(item.matchData.date) > new Date()
      )
      
      // Sort by confidence score (highest first) and take top 3
      const topMatches = predictionMatches
        .sort((a: any, b: any) => (b.confidenceScore || 0) - (a.confidenceScore || 0))
        .slice(0, 3)
      
      setItems(topMatches)
    } catch (error) {
      console.error("Error fetching quick purchases:", error)
      toast.error("Failed to load quick purchase options")
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickPurchase = (item: QuickPurchaseItem) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const getItemIcon = (type: string) => {
    switch (type) {
      case "tip":
        return <Zap className="w-6 h-6 text-yellow-400" />
      case "package":
        return <Gift className="w-6 h-6 text-purple-400" />
      case "vip":
        return <Crown className="w-6 h-6 text-yellow-400" />
      default:
        return <Star className="w-6 h-6 text-emerald-400" />
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Card>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <>
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <Star className="w-5 h-5 text-yellow-400" />
            <span>Top Predictions</span>
          </h2>
          <div className="flex items-center space-x-3">
            <Badge className="bg-emerald-500 text-white animate-pulse">INSTANT ACCESS</Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-slate-400 hover:text-white"
              onClick={() => router.push('/dashboard/matches')}
            >
              <Target className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className={`rounded-lg border bg-card text-card-foreground shadow-sm ${
                item.type === 'tip' 
                  ? 'bg-gradient-to-br from-emerald-500 to-cyan-500'
                  : item.type === 'package'
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                  : 'bg-gradient-to-br from-yellow-500 to-orange-500'
              } p-4 border-none relative overflow-hidden hover:scale-105 transition-transform duration-300`}
            >
              {/* Badges */}
              <div className="absolute top-2 right-2 flex flex-col space-y-1">
                {item.isPopular && (
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-red-500 text-white text-xs animate-pulse">
                    HOT
                  </div>
                )}
                {item.isUrgent && (
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-orange-500 text-white text-xs">
                    URGENT
                  </div>
                )}
                {item.discountPercentage && (
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-green-500 text-white text-xs">
                    -{item.discountPercentage}%
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getItemIcon(item.type)}
                    <h3 className="font-semibold">{item.name}</h3>
                  </div>
                  {item.confidenceScore && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-bold">
                      {item.confidenceScore}% Confidence
                    </Badge>
                  )}
                </div>
                
                {/* Match Details */}
                {item.matchData && (
                  <div className="mb-3 p-2 bg-white/10 rounded">
                    <div className="text-sm font-medium mb-1">
                      {item.matchData.home_team} vs {item.matchData.away_team}
                    </div>
                    <div className="text-xs opacity-80">
                      {item.matchData.league} • {item.matchData.date && new Date(item.matchData.date).toLocaleDateString()}
                    </div>
                  </div>
                )}
                
                <div className="mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold">{convertPrice(item.price)}</span>
                    {item.originalPrice && Number(item.originalPrice) !== Number(item.price) && (
                      <span className="text-sm line-through opacity-70">{convertPrice(item.originalPrice)}</span>
                    )}
                  </div>
                  <p className="text-sm opacity-90">{item.description}</p>
                </div>
                <div className="space-y-1 mb-4">
                  {item.features.map((feature, index) => (
                    <div key={index} className="text-sm opacity-90">• {feature}</div>
                  ))}
                  {item.features.length > 2 && (
                    <div className="text-sm opacity-70">+{item.features.length - 2} more features</div>
                  )}
                </div>
                <button
                  onClick={() => handleQuickPurchase(item)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border hover:text-accent-foreground h-10 px-4 py-2 w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Buy Now
                </button>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {selectedItem && (
        <QuickPurchaseModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedItem(null)
          }}
          item={selectedItem}
        />
      )}
    </>
  )
}
