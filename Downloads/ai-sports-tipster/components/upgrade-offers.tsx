"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Crown, Zap, Gift, Star, Clock, TrendingUp } from "lucide-react"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
import { useCountry } from "@/contexts/country-context"

export function UpgradeOffers() {
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { convertPrice } = useCountry()

  const quickPurchaseItems = [
    {
      id: "daily-tip",
      name: "Today's Premium Tip",
      price: "150",
      description: "Arsenal vs Chelsea - Over 2.5 Goals",
      features: ["90% Confidence", "Detailed Analysis", "Live Updates", "Money Back if Wrong"],
      type: "tip" as const,
      icon: Zap,
      color: "from-emerald-500 to-cyan-500",
      urgent: true,
      timeLeft: "2h 15m",
    },
    {
      id: "weekend-package",
      name: "Weekend Special",
      price: "350",
      originalPrice: "500",
      description: "3 Premium Weekend Picks",
      features: ["Premier League Accumulator", "Expert Analysis", "Live Chat Support", "Profit Guarantee"],
      type: "package" as const,
      icon: Gift,
      color: "from-purple-500 to-pink-500",
      popular: true,
      discount: 30,
    },
    {
      id: "vip-monthly",
      name: "VIP Monthly",
      price: "2500",
      originalPrice: "3500",
      description: "Unlimited Premium Access",
      features: ["Unlimited Tips", "VIP Predictions", "Personal Advisor", "Video Analysis"],
      type: "vip" as const,
      icon: Crown,
      color: "from-yellow-500 to-orange-500",
      savings: 29,
    },
  ]

  const handleQuickPurchase = (item: any) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  return (
    <>
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <Star className="w-5 h-5 text-yellow-400" />
            <span>Quick Purchase</span>
          </h2>
          <Badge className="bg-emerald-500 text-white animate-pulse">INSTANT ACCESS</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickPurchaseItems.map((item) => (
            <Card
              key={item.id}
              className={`bg-gradient-to-br ${item.color} p-4 border-none relative overflow-hidden hover:scale-105 transition-transform duration-300`}
            >
              {/* Badges */}
              <div className="absolute top-2 right-2 flex flex-col space-y-1">
                {item.popular && <Badge className="bg-red-500 text-white text-xs animate-pulse">HOT</Badge>}
                {item.urgent && <Badge className="bg-orange-500 text-white text-xs">URGENT</Badge>}
                {item.discount && <Badge className="bg-green-500 text-white text-xs">-{item.discount}%</Badge>}
              </div>

              <div className="text-white">
                <div className="flex items-center space-x-2 mb-3">
                  <item.icon className="w-6 h-6" />
                  <h3 className="font-semibold">{item.name}</h3>
                </div>

                <div className="mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold">{convertPrice(item.price)}</span>
                    {item.originalPrice && (
                      <span className="text-sm line-through opacity-70">{convertPrice(item.originalPrice)}</span>
                    )}
                  </div>
                  <p className="text-sm opacity-90">{item.description}</p>
                </div>

                {/* Urgency indicator */}
                {item.urgent && (
                  <div className="flex items-center space-x-1 mb-3 text-yellow-200">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Expires in {item.timeLeft}</span>
                  </div>
                )}

                {/* Key features */}
                <div className="space-y-1 mb-4">
                  {item.features.slice(0, 2).map((feature, idx) => (
                    <div key={idx} className="text-sm opacity-90">
                      • {feature}
                    </div>
                  ))}
                  {item.features.length > 2 && (
                    <div className="text-sm opacity-70">+{item.features.length - 2} more features</div>
                  )}
                </div>

                <Button
                  onClick={() => handleQuickPurchase(item)}
                  className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
                  variant="outline"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Buy Now
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Trust indicators */}
        <div className="mt-6 flex items-center justify-center space-x-6 text-slate-400 text-sm">
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-yellow-400" />
            <span>4.9/5 Rating</span>
          </div>
          <div className="flex items-center space-x-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>87% Win Rate</span>
          </div>
          <div className="flex items-center space-x-1">
            <Crown className="w-4 h-4 text-purple-400" />
            <span>1,200+ Happy Customers</span>
          </div>
        </div>
      </Card>

      {/* Quick Purchase Modal */}
      {selectedItem && (
        <QuickPurchaseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} item={selectedItem} />
      )}
    </>
  )
}
