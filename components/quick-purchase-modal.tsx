"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreditCard, Smartphone, Globe, CheckCircle, Clock, Shield, Zap, Star, Crown, Gift, Brain, TrendingUp, Target, AlertCircle, Loader2 } from "lucide-react"
import { CountrySelector } from "@/components/country-selector"
import { useUserCountry } from "@/contexts/user-country-context"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { TipReceipt } from "@/components/tip-receipt"
import { Separator } from "@/components/ui/separator"
import { Elements } from "@stripe/react-stripe-js"
import { stripePromise } from "@/lib/stripe"
import { PaymentForm } from "@/components/payment-form"

interface QuickPurchaseItem {
  id: string
  name: string
  price: number
  originalPrice?: number
  description: string
  features: string[]
  type: "prediction" | "tip" | "package" | "vip"
  iconName: string
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
  tipCount?: number
  predictionType?: string
  odds?: number
  valueRating?: string
  analysisSummary?: string
}

interface PackageStatus {
  userPackages: Array<{
    id: string
    tipsRemaining: number
    totalTips: number
    status: string
    packageOffer: {
      name: string
      tipCount: number
    }
  }>
  totalTipsRemaining: string | number
  hasUnlimited: boolean
}

interface QuickPurchaseModalProps {
  isOpen: boolean
  onClose: () => void
  item: QuickPurchaseItem | null
}

export function QuickPurchaseModal({ isOpen, onClose, item }: QuickPurchaseModalProps) {
  const { countryData, convertPrice } = useUserCountry()
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [purchasedTip, setPurchasedTip] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState<"money" | "credits">("money")
  const [packageStatus, setPackageStatus] = useState<PackageStatus | null>(null)
  const [paymentStep, setPaymentStep] = useState<'details' | 'payment'>('details')
  const [clientSecret, setClientSecret] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [userCountryCode, setUserCountryCode] = useState('US')

  // Reset payment method when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPaymentMethod("")
      fetchPackageStatus()
      setPaymentStep('details')
      setClientSecret('')
    }
  }, [isOpen])

  const fetchPackageStatus = async () => {
    try {
      const response = await fetch("/api/user-packages/claim-tip")
      if (response.ok) {
        const data = await response.json()
        setPackageStatus(data)
      }
    } catch (error) {
      console.error("Error fetching package status:", error)
    }
  }

  const handleProceedToPayment = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: item?.id,
          itemType: item?.type === 'package' ? 'package' : 'tip',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create payment intent')
      }

      const data = await response.json()
      setClientSecret(data.clientSecret)
      setPaymentStep('payment')
    } catch (error) {
      console.error('Error creating payment intent:', error)
      toast.error('Failed to initialize payment. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaymentSuccess = () => {
    toast.success('Purchase successful!')
    onClose()
    // Optionally refresh the page or update the UI
    window.location.reload()
  }

  const handlePaymentCancel = () => {
    setPaymentStep('details')
    setClientSecret('')
  }

  const getItemIcon = () => {
    switch (item?.type) {
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

  const getFeatureIcon = (feature: string) => {
    switch (feature.toLowerCase()) {
      case "ai analysis":
        return <Brain className="w-4 h-4" />
      case "match statistics":
        return <TrendingUp className="w-4 h-4" />
      case "risk assessment":
        return <Shield className="w-4 h-4" />
      case "confidence scores":
        return <Target className="w-4 h-4" />
      default:
        return <CheckCircle className="w-4 h-4" />
    }
  }

  const canUseCredits = packageStatus && (
    packageStatus.hasUnlimited || 
    (typeof packageStatus.totalTipsRemaining === 'number' && packageStatus.totalTipsRemaining > 0)
  )

  const getCreditsText = () => {
    if (!packageStatus) return "Loading..."
    if (packageStatus.hasUnlimited) return "∞ Credits Available"
    return `${packageStatus.totalTipsRemaining} Credits Available`
  }

  if (showReceipt && purchasedTip) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          <TipReceipt tip={purchasedTip} onClose={onClose} />
        </DialogContent>
      </Dialog>
    )
  }

  if (!item) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center space-x-2">
            {getItemIcon()}
            <span>Quick Purchase</span>
          </DialogTitle>
        </DialogHeader>

        {paymentStep === 'details' ? (
          <div className="space-y-6">
            {/* Item Details */}
            <Card className="bg-slate-700/50 border-slate-600">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">{item.name}</h3>
                    <p className="text-slate-300 text-sm">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-400">
                      {convertPrice(item.price.toString())}
                    </div>
                    {item.originalPrice && item.originalPrice !== item.price && (
                      <div className="text-sm text-slate-500 line-through">
                        {convertPrice(item.originalPrice.toString())}
                      </div>
                    )}
                  </div>
                </div>

                {/* Match Details */}
                {item.matchData && (
                  <div className="bg-slate-600/50 rounded-lg p-3 mb-4">
                    <div className="text-sm font-medium text-white mb-1">
                      {item.matchData.home_team} vs {item.matchData.away_team}
                    </div>
                    <div className="text-xs text-slate-300">
                      {item.matchData.league} • {item.matchData.date && new Date(item.matchData.date).toLocaleDateString()}
                    </div>
                    {item.confidenceScore && (
                      <div className="mt-2">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          {item.confidenceScore}% Confidence
                        </Badge>
                      </div>
                    )}
                  </div>
                )}

                {/* Features */}
                <div className="space-y-2">
                  <h4 className="text-white font-medium text-sm">What's included:</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      item.tipCount === -1 ? 'Unlimited Tips' : `${item.tipCount} Premium Tips`,
                      ...item.features.filter(f => !/\d+ Premium Tips|Unlimited Tips/.test(f))
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2 text-slate-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {item.isPopular && (
                    <Badge className="bg-red-500 text-white animate-pulse">HOT</Badge>
                  )}
                  {item.isUrgent && (
                    <Badge className="bg-orange-500 text-white">URGENT</Badge>
                  )}
                  {item.discountPercentage && (
                    <Badge className="bg-green-500 text-white">-{item.discountPercentage}%</Badge>
                  )}
                  {item.timeLeft && (
                    <Badge className="bg-blue-500 text-white">
                      <Clock className="w-3 h-3 mr-1" />
                      {item.timeLeft}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment Options */}
            <div className="space-y-4">
              <h4 className="text-white font-medium">Payment Options</h4>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-slate-700/50 border-slate-600 hover:bg-slate-700 cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                    <div className="text-sm font-medium text-white">Credit Card</div>
                    <div className="text-xs text-slate-400">Visa, Mastercard, Amex</div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700/50 border-slate-600 hover:bg-slate-700 cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <div className="w-8 h-8 mx-auto mb-2 text-blue-400">📱</div>
                    <div className="text-sm font-medium text-white">Digital Wallets</div>
                    <div className="text-xs text-slate-400">Apple Pay, Google Pay</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceedToPayment}
                disabled={isLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                style={{
                  background: `linear-gradient(135deg, ${item.colorGradientFrom}, ${item.colorGradientTo})`
                }}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4" />
                    <span>Proceed to Payment</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm
                  clientSecret={clientSecret}
                  amount={item.price}
                  currency={item.country?.currencyCode || 'USD'}
                  currencySymbol={item.country?.currencySymbol || '$'}
                  itemName={item.name}
                  userCountryCode={userCountryCode}
                  onSuccess={handlePaymentSuccess}
                  onCancel={handlePaymentCancel}
                />
              </Elements>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
