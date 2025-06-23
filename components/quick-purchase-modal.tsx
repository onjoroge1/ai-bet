"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreditCard, Smartphone, Globe, CheckCircle, Clock, Shield, Zap, Star, Crown, Gift, Brain, TrendingUp, Target } from "lucide-react"
import { CountrySelector } from "@/components/country-selector"
import { useUserCountry } from "@/contexts/user-country-context"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { TipReceipt } from "@/components/tip-receipt"

interface QuickPurchaseModalProps {
  isOpen: boolean
  onClose: () => void
  item: {
    id: string
    name: string
    price: string
    originalPrice?: string
    description: string
    features: string[]
    type: "tip" | "package" | "vip"
    country?: {
      currencyCode: string
      currencySymbol: string
    }
    predictionData?: any
    predictionType?: string
    confidenceScore?: number
    odds?: string
    valueRating?: string
  }
}

export function QuickPurchaseModal({ isOpen, onClose, item }: QuickPurchaseModalProps) {
  const { countryData, convertPrice } = useUserCountry()
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [purchasedTip, setPurchasedTip] = useState<any>(null)

  // Reset payment method when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPaymentMethod("")
    }
  }, [isOpen])

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      router.push("/signin")
      return
    }

    if (!selectedPaymentMethod) {
      toast.error("Please select a payment method")
      return
    }

    setIsProcessing(true)
    try {
      // Simulate purchase process
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success("Purchase successful! You can now view your prediction.")
      onClose()
    } catch (error) {
      toast.error("Purchase failed. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const getItemIcon = () => {
    switch (item.type) {
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

  if (showReceipt && purchasedTip) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          <TipReceipt tip={purchasedTip} onClose={onClose} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white flex items-center space-x-3">
            {getItemIcon()}
            <span>Quick Purchase</span>
            <Badge className="bg-emerald-500 text-white">Secure</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Summary */}
          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getItemIcon()}
                <div>
                  <h3 className="text-white font-semibold text-lg">{item.name}</h3>
                  <p className="text-slate-400">{item.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-emerald-400">{convertPrice(item.price)}</div>
                {item.originalPrice && Number(item.originalPrice) !== Number(item.price) && (
                  <div className="text-slate-500 line-through">{convertPrice(item.originalPrice)}</div>
                )}
              </div>
            </div>

            {/* Features */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {item.features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2 text-slate-300 text-sm">
                  {getFeatureIcon(feature)}
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* Prediction Details */}
            {item.predictionData && (
              <div className="bg-slate-700/50 rounded-lg p-3 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Prediction:</span>
                    <div className="text-emerald-400 font-medium">{item.predictionType}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Confidence:</span>
                    <div className="text-emerald-400 font-medium">{item.confidenceScore}%</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Odds:</span>
                    <div className="text-emerald-400 font-medium">{item.odds}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Value Rating:</span>
                    <div className="text-emerald-400 font-medium">{item.valueRating}</div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Payment Methods */}
          <Tabs defaultValue="local" className="space-y-4">
            <TabsList className="bg-slate-800 border-slate-700">
              <TabsTrigger value="local" className="data-[state=active]:bg-emerald-600">
                Local Payments ({countryData.name})
              </TabsTrigger>
              <TabsTrigger value="global" className="data-[state=active]:bg-emerald-600">
                Global Payments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {countryData.paymentMethods.map((method: string) => (
                  <Card
                    key={method}
                    className={`bg-slate-800/50 border-slate-700 p-4 cursor-pointer transition-all hover:border-emerald-500 ${
                      selectedPaymentMethod === method ? "ring-2 ring-emerald-500 border-emerald-500" : ""
                    }`}
                    onClick={() => setSelectedPaymentMethod(method)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span className="font-medium">{method}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="global" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Global payment methods */}
                {(countryData.globalPaymentMethods || []).map((method: string) => (
                  <Card
                    key={method}
                    className={`bg-slate-800/50 border-slate-700 p-4 cursor-pointer transition-all hover:border-emerald-500 ${
                      selectedPaymentMethod === method ? "ring-2 ring-emerald-500 border-emerald-500" : ""
                    }`}
                    onClick={() => setSelectedPaymentMethod(method)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center">
                        {method.includes("Card") ? <CreditCard className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                      </div>
                      <span className="font-medium">{method}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Security Notice */}
          <Card className="bg-emerald-900/20 border-emerald-500/30 p-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-emerald-400" />
              <div>
                <h4 className="text-emerald-400 font-medium">Secure Payment</h4>
                <p className="text-emerald-300 text-sm">
                  Your payment is protected by 256-bit SSL encryption. We never store your payment details.
                </p>
              </div>
            </div>
          </Card>

          {/* Purchase Button */}
          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={isProcessing || !selectedPaymentMethod}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessing ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Purchase for {convertPrice(item.price)}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
