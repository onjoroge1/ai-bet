"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreditCard, Smartphone, Globe, CheckCircle, Clock, Shield, Zap, Star, Crown, Gift } from "lucide-react"
import { CountrySelector } from "@/components/country-selector"
import { useCountry } from "@/contexts/country-context"

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
  }
}

export function QuickPurchaseModal({ isOpen, onClose, item }: QuickPurchaseModalProps) {
  const { selectedCountry, countryData, setSelectedCountry, convertPrice } = useCountry()
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Payment methods with local and global options
  const paymentMethods = [
    // Local payment methods
    ...countryData.paymentMethods.map((method) => ({
      id: method.toLowerCase().replace(/\s+/g, "-"),
      name: method,
      type: "local" as const,
      icon: Smartphone,
      description: `Pay with ${method}`,
      processingTime: "Instant",
      popular: method.includes("M-Pesa") || method.includes("Opay") || method.includes("SnapScan"),
    })),
    // Global payment methods
    ...(countryData.globalPaymentMethods || []).map((method) => ({
      id: method.toLowerCase().replace(/\s+/g, "-"),
      name: method,
      type: "global" as const,
      icon: method.includes("Card") ? CreditCard : Globe,
      description: `Pay with ${method}`,
      processingTime: "Instant",
      popular: false,
    })),
  ]

  const handlePurchase = async () => {
    if (!selectedPayment) return

    setIsProcessing(true)

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Here you would integrate with actual payment processors
    console.log("Processing payment:", {
      item: item.id,
      country: selectedCountry,
      paymentMethod: selectedPayment,
      price: convertPrice(item.price),
    })

    setIsProcessing(false)
    onClose()

    // Show success message or redirect
    alert(`Payment successful! You now have access to ${item.name}`)
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
          {/* Country Selection */}
          <CountrySelector selectedCountry={selectedCountry} onCountryChange={setSelectedCountry} showCard={false} />

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
                {item.originalPrice && (
                  <div className="text-slate-500 line-through">{convertPrice(item.originalPrice)}</div>
                )}
              </div>
            </div>

            {/* Features */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {item.features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2 text-slate-300 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
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
                {paymentMethods
                  .filter((method) => method.type === "local")
                  .map((method) => (
                    <Card
                      key={method.id}
                      className={`bg-slate-800/50 border-slate-700 p-4 cursor-pointer transition-all hover:border-emerald-500 ${
                        selectedPayment === method.id ? "ring-2 ring-emerald-500 border-emerald-500" : ""
                      }`}
                      onClick={() => setSelectedPayment(method.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <method.icon className="w-8 h-8 text-emerald-400" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-white font-medium">{method.name}</h4>
                            {method.popular && <Badge className="bg-emerald-500 text-white text-xs">POPULAR</Badge>}
                          </div>
                          <p className="text-slate-400 text-sm">{method.description}</p>
                          <div className="flex items-center space-x-1 mt-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-500 text-xs">{method.processingTime}</span>
                          </div>
                        </div>
                        {selectedPayment === method.id && <CheckCircle className="w-6 h-6 text-emerald-400" />}
                      </div>
                    </Card>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="global" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paymentMethods
                  .filter((method) => method.type === "global")
                  .map((method) => (
                    <Card
                      key={method.id}
                      className={`bg-slate-800/50 border-slate-700 p-4 cursor-pointer transition-all hover:border-emerald-500 ${
                        selectedPayment === method.id ? "ring-2 ring-emerald-500 border-emerald-500" : ""
                      }`}
                      onClick={() => setSelectedPayment(method.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <method.icon className="w-8 h-8 text-blue-400" />
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{method.name}</h4>
                          <p className="text-slate-400 text-sm">{method.description}</p>
                          <div className="flex items-center space-x-1 mt-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-500 text-xs">{method.processingTime}</span>
                          </div>
                        </div>
                        {selectedPayment === method.id && <CheckCircle className="w-6 h-6 text-emerald-400" />}
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
              disabled={!selectedPayment || isProcessing}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay {convertPrice(item.price)}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
