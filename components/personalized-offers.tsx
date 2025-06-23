"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Crown, Zap, Gift, Star, Clock, TrendingUp, Target, Shield, Users, Sparkles } from "lucide-react"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
import { useUserCountry } from "@/contexts/user-country-context"

export function PersonalizedOffers() {
  const [selectedOffer, setSelectedOffer] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { convertPrice } = useUserCountry()

  const personalizedOffers = [
    {
      id: "newcomer-special",
      name: "Newcomer Special",
      price: "200",
      originalPrice: "400",
      description: "Perfect starter package for new users",
      features: ["5 Premium Tips", "Beginner Guide", "Email Support", "7-Day Trial"],
      type: "package" as const,
      discount: 50,
      timeLeft: "23h 45m",
      claimed: 67,
      maxClaims: 100,
      reason: "First-time user bonus",
    },
    {
      id: "loyalty-reward",
      name: "Loyalty Reward",
      price: "300",
      originalPrice: "600",
      description: "Thank you for being a valued customer",
      features: ["Weekend Package", "VIP Chat Access", "Bonus Tips", "Priority Support"],
      type: "package" as const,
      discount: 50,
      timeLeft: "2d 12h",
      claimed: 23,
      maxClaims: 50,
      reason: "Active user for 30+ days",
    },
    {
      id: "flash-deal",
      name: "Flash Deal",
      price: "100",
      originalPrice: "250",
      description: "Limited time flash offer",
      features: ["3 Hot Tips", "Live Updates", "Instant Access", "Money Back Guarantee"],
      type: "tip" as const,
      discount: 60,
      timeLeft: "4h 23m",
      claimed: 89,
      maxClaims: 100,
      reason: "Flash sale - 60% off",
      urgent: true,
    },
  ]

  const handleClaimOffer = (offer: any) => {
    setSelectedOffer(offer)
    setIsModalOpen(true)
  }

  return (
    <>
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <Gift className="w-5 h-5 text-purple-400" />
            <span>Personalized Offers</span>
          </h2>
          <Badge className="bg-purple-500 text-white">JUST FOR YOU</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {personalizedOffers.map((offer) => (
            <Card
              key={offer.id}
              className={`bg-slate-700/50 border-slate-600 p-4 relative overflow-hidden ${
                offer.urgent ? "ring-2 ring-orange-500 animate-pulse" : ""
              }`}
            >
              {/* Urgency indicator */}
              {offer.urgent && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-orange-500 to-red-500 h-1"></div>
              )}

              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{offer.name}</h3>
                    <p className="text-slate-400 text-sm">{offer.reason}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="text-xl font-bold text-emerald-400">{convertPrice(offer.price)}</div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 line-through text-sm">{convertPrice(offer.originalPrice)}</span>
                    <Badge className="bg-emerald-500 text-white">-{offer.discount}%</Badge>
                  </div>
                </div>

                <p className="text-slate-300 text-sm mb-3">{offer.description}</p>

                {/* Features */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {offer.features.slice(0, 2).map((feature, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-slate-300 text-sm">
                      <Star className="w-3 h-3 text-yellow-400" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">
                      Claimed: {offer.claimed}/{offer.maxClaims}
                    </span>
                    <span className="text-purple-400">{offer.maxClaims - offer.claimed} left</span>
                  </div>
                  <Progress value={(offer.claimed / offer.maxClaims) * 100} className="h-2 bg-slate-600" />
                </div>

                {/* Time left */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-1 text-orange-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Expires in {offer.timeLeft}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">
                      Save {convertPrice(Number.parseInt(offer.originalPrice) - Number.parseInt(offer.price))}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => handleClaimOffer(offer)}
                  className={`w-full ${
                    offer.urgent
                      ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                      : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  } text-white`}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Claim Offer
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Offer explanation */}
        <div className="mt-6 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="w-5 h-5 text-purple-400" />
            <h4 className="text-purple-400 font-medium">Why These Offers?</h4>
          </div>
          <p className="text-purple-300 text-sm">
            These personalized offers are based on your activity, preferences, and betting patterns. They're designed to
            give you the best value and help you maximize your winnings.
          </p>
        </div>
      </Card>

      {/* Quick Purchase Modal */}
      {selectedOffer && (
        <QuickPurchaseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} item={selectedOffer} />
      )}
    </>
  )
}
