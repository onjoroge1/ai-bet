"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Crown, Zap, Gift, Star, Clock, TrendingUp, Target, Shield, Users, Sparkles, Calendar } from "lucide-react"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
import { useUserCountry } from "@/contexts/user-country-context"

interface PackageOffer {
  id: string
  name: string
  packageType: string
  description: string
  tipCount: number
  validityDays: number
  features: string[]
  iconName: string
  colorGradientFrom: string
  colorGradientTo: string
  displayOrder: number
  isActive: boolean
  countryPrices: {
    id: string
    price: number
    originalPrice?: number
    currencyCode: string
    currencySymbol: string
    country: {
      name: string
      code: string
      currencyCode: string
      currencySymbol: string
    }
  }[]
}

export function PersonalizedOffers() {
  const [packageOffers, setPackageOffers] = useState<PackageOffer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOffer, setSelectedOffer] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { convertPrice } = useUserCountry()

  useEffect(() => {
    fetchPackageOffers()
  }, [])

  const fetchPackageOffers = async () => {
    try {
      const response = await fetch("/api/package-offers")
      if (!response.ok) throw new Error("Failed to fetch package offers")
      const data = await response.json()
      setPackageOffers(data)
    } catch (error) {
      console.error("Error fetching package offers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePurchasePackage = (offer: PackageOffer) => {
    const userPrice = offer.countryPrices[0]
    const packageItem = {
      id: offer.id,
      name: offer.name,
      price: userPrice.price.toString(),
      originalPrice: userPrice.originalPrice?.toString(),
      description: offer.description,
      features: offer.features,
      type: "package" as const,
      iconName: offer.iconName as any,
      colorGradientFrom: offer.colorGradientFrom,
      colorGradientTo: offer.colorGradientTo,
      tipCount: offer.tipCount,
      validityDays: offer.validityDays,
      packageType: offer.packageType
    }
    setSelectedOffer(packageItem)
    setIsModalOpen(true)
  }

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "Zap": return <Zap className="w-5 h-5 text-white" />
      case "Calendar": return <Calendar className="w-5 h-5 text-white" />
      case "TrendingUp": return <TrendingUp className="w-5 h-5 text-white" />
      case "Crown": return <Crown className="w-5 h-5 text-white" />
      default: return <Gift className="w-5 h-5 text-white" />
    }
  }

  const getTipCountText = (tipCount: number) => {
    if (tipCount === -1) return "Unlimited"
    return `${tipCount} Tips`
  }

  const getValidityText = (validityDays: number) => {
    if (validityDays === 1) return "24 Hours"
    if (validityDays === 3) return "3 Days"
    if (validityDays === 7) return "1 Week"
    if (validityDays === 30) return "1 Month"
    return `${validityDays} Days`
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </Card>
    )
  }

  if (packageOffers.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="text-center py-8">
          <p className="text-slate-400">No package offers available at the moment.</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <Gift className="w-5 h-5 text-purple-400" />
            <span>Premium Packages</span>
          </h2>
          <Badge className="bg-purple-500 text-white">BEST VALUE</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {packageOffers.map((offer) => {
            const userPrice = offer.countryPrices[0]
            const discount = userPrice.originalPrice 
              ? Math.round(((userPrice.originalPrice - userPrice.price) / userPrice.originalPrice) * 100)
              : 0

            return (
              <Card
                key={offer.id}
                className="bg-slate-700/50 border-slate-600 p-4 relative overflow-hidden hover:scale-105 transition-transform duration-300"
                style={{
                  background: `linear-gradient(135deg, ${offer.colorGradientFrom}20, ${offer.colorGradientTo}20)`
                }}
              >
                {/* Package Type Badge */}
                <div className="absolute top-2 right-2">
                  <Badge className="bg-slate-800/80 border-slate-600 text-xs">
                    {offer.packageType.toUpperCase()}
                  </Badge>
                </div>

                <div>
                  <div className="flex items-center space-x-3 mb-3">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${offer.colorGradientFrom}, ${offer.colorGradientTo})`
                      }}
                    >
                      {getIconComponent(offer.iconName)}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm">{offer.name}</h3>
                      <p className="text-slate-400 text-xs">{getTipCountText(offer.tipCount)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xl font-bold text-emerald-400">
                      {userPrice.currencySymbol}{userPrice.price}
                    </div>
                    {userPrice.originalPrice && (
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 line-through text-sm">
                          {userPrice.currencySymbol}{userPrice.originalPrice}
                        </span>
                        <Badge className="bg-emerald-500 text-white text-xs">-{discount}%</Badge>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-300 text-sm mb-3">{offer.description}</p>

                  {/* Features */}
                  <div className="space-y-1 mb-4">
                    {[
                      offer.tipCount === -1 ? 'Unlimited Tips' : `${offer.tipCount} Premium Tips`,
                      ...offer.features.filter(f => !/\d+ Premium Tips|Unlimited Tips/.test(f))
                    ].slice(0, 3).map((feature, idx) => (
                      <div key={idx} className="flex items-center space-x-2 text-slate-300 text-xs">
                        <Star className="w-3 h-3 text-yellow-400" />
                        <span>{feature}</span>
                      </div>
                    ))}
                    {offer.features.length > 3 && (
                      <div className="text-slate-400 text-xs">
                        +{offer.features.length - 3} more features
                      </div>
                    )}
                  </div>

                  {/* Validity */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-1 text-blue-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{getValidityText(offer.validityDays)}</span>
                    </div>
                    {userPrice.originalPrice && (
                      <div className="flex items-center space-x-1 text-emerald-400">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm">
                          Save {userPrice.currencySymbol}{userPrice.originalPrice - userPrice.price}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => handlePurchasePackage(offer)}
                    className="w-full text-white"
                    style={{
                      background: `linear-gradient(135deg, ${offer.colorGradientFrom}, ${offer.colorGradientTo})`
                    }}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Get Package
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Package explanation */}
        <div className="mt-6 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="w-5 h-5 text-purple-400" />
            <h4 className="text-purple-400 font-medium">Why Choose Our Packages?</h4>
          </div>
          <p className="text-purple-300 text-sm">
            Our premium packages are designed to give you the best value for your betting strategy. 
            Choose the package that fits your needs - from daily tips to unlimited monthly access. 
            All packages include AI-powered analysis, confidence scores, and expert insights.
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
