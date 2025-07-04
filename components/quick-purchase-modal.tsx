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
import { CreditCard as CreditCardIcon } from "lucide-react"

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

function PaymentMethodCard({ method, selected, onClick, comingSoon }: { method: any, selected: boolean, onClick: () => void, comingSoon?: boolean }) {
  return (
    <Card
      className={`bg-slate-700/50 border-slate-600 transition-colors ${selected ? 'ring-2 ring-green-500' : ''} hover:bg-slate-700 cursor-pointer relative`}
      onClick={comingSoon ? undefined : onClick}
      aria-label={method.label + (comingSoon ? ' (Coming soon)' : '')}
      tabIndex={0}
      role="button"
      onKeyDown={e => { if (!comingSoon && (e.key === 'Enter' || e.key === ' ')) onClick(); }}
    >
      <CardContent className="p-4 text-center">
        {method.icon}
        <div className="text-sm font-medium text-white">{method.label}</div>
        <div className="text-xs text-slate-400">{method.desc}</div>
        {comingSoon && (
          <span className="absolute top-2 right-2 bg-yellow-500 text-xs text-white px-2 py-0.5 rounded">Coming soon</span>
        )}
      </CardContent>
    </Card>
  );
}

export function QuickPurchaseModal({ isOpen, onClose, item }: QuickPurchaseModalProps) {
  const { countryData, convertPrice, userCountry } = useUserCountry()
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [purchasedTip, setPurchasedTip] = useState<any>(null)
  const [packageStatus, setPackageStatus] = useState<PackageStatus | null>(null)
  const [paymentStep, setPaymentStep] = useState<'select' | 'pay'>('select')
  const [clientSecret, setClientSecret] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [userCountryCode, setUserCountryCode] = useState(userCountry || 'US')
  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setSelectedPaymentMethod("");
      fetchPackageStatus();
      setPaymentStep('select');
      setClientSecret('');
      setUserCountryCode(userCountry || 'US');
      // Default tab: always global first
      setActiveTab('global');
    }
  }, [isOpen, userCountry]);

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

  // New: Unified payment method selection (refactored)
  const handleSelectPayment = async (method: string) => {
    setSelectedPaymentMethod(method);
    setClientSecret('');
    setPaymentStep('select');
    // Local payments (not implemented): show toast and do not transition
    if (isKenya && (method === 'mpesa' || method === 'airtel_money')) {
      toast('Coming soon: Local payment integration for ' + (method === 'mpesa' ? 'M-Pesa' : 'Airtel Money'));
      return;
    }
    // Global payments: proceed to payment form
    setIsLoading(true);
    try {
      const response = await fetch('/api/payments/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item?.id,
          itemType: item?.type === 'package' ? 'package' : 'tip',
          paymentMethod: method,
        }),
      });
      if (!response.ok) throw new Error('Failed to create payment intent');
      const data = await response.json();
      setClientSecret(data.clientSecret);
      setPaymentStep('pay');
    } catch (error) {
      toast.error('Failed to initialize payment. Please try again.');
      setSelectedPaymentMethod("");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    toast.success('Purchase successful!')
    onClose()
    // Optionally: trigger admin notification here (e.g., via API or socket)
    // window.location.reload()
  }

  const handlePaymentCancel = () => {
    setPaymentStep('select')
    setClientSecret('')
    setSelectedPaymentMethod("")
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

  // Helper: Is user in Kenya?
  const isKenya = userCountryCode.toLowerCase() === 'ke' || userCountryCode.toLowerCase() === 'kenya';

  // Payment methods config
  const globalPayments = [
    { key: 'card', label: 'Credit Card', icon: <CreditCard className="w-8 h-8 mx-auto mb-2 text-emerald-400" />, desc: 'Visa, Mastercard, Amex' },
    { key: 'apple_pay', label: 'Apple Pay', icon: <div className="w-8 h-8 mx-auto mb-2 text-blue-400">📱</div>, desc: 'Quick & Secure' },
    { key: 'google_pay', label: 'Google Pay', icon: <div className="w-8 h-8 mx-auto mb-2 text-green-400">📱</div>, desc: 'Quick & Secure' },
    { key: 'paypal', label: 'PayPal', icon: <div className="w-8 h-8 mx-auto mb-2 text-blue-500 font-bold text-lg">P</div>, desc: 'Pay with PayPal' },
  ];
  const localPaymentsKE = [
    { key: 'mpesa', label: 'M-Pesa', icon: <Smartphone className="w-8 h-8 mx-auto mb-2 text-green-500" />, desc: 'Pay with M-Pesa' },
    { key: 'airtel_money', label: 'Airtel Money', icon: <Smartphone className="w-8 h-8 mx-auto mb-2 text-red-500" />, desc: 'Pay with Airtel Money' },
  ];

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
      <DialogContent 
        className="fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700"
        aria-describedby="quick-purchase-description"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center space-x-2">
            {getItemIcon()}
            <span>Quick Purchase</span>
          </DialogTitle>
          <div id="quick-purchase-description" className="sr-only">
            Purchase dialog for {item?.name || 'selected item'}
          </div>
        </DialogHeader>
        {paymentStep === 'select' ? (
          <div className="space-y-6">
            {/* Purchase Details */}
            <Card className="bg-slate-800 border-slate-700 rounded-xl">
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
            {/* Payment Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4 flex bg-transparent p-0 border-0">
                {isKenya && (
                  <TabsTrigger value="local" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:bg-emerald-600">
                    Local Payments (Kenya)
                  </TabsTrigger>
                )}
                <TabsTrigger value="global" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:bg-emerald-600">
                  Global Payments
                </TabsTrigger>
              </TabsList>
              {isKenya && (
                <TabsContent value="local">
                  <div className="grid grid-cols-2 gap-4">
                    {localPaymentsKE.map(method => (
                      <PaymentMethodCard
                        key={method.key}
                        method={method}
                        selected={selectedPaymentMethod === method.key}
                        onClick={() => handleSelectPayment(method.key)}
                        comingSoon={true}
                      />
                    ))}
                  </div>
                </TabsContent>
              )}
              <TabsContent value="global">
                <div className="grid grid-cols-2 gap-4">
                  {globalPayments.map(method => (
                    <PaymentMethodCard
                      key={method.key}
                      method={method}
                      selected={selectedPaymentMethod === method.key}
                      onClick={() => handleSelectPayment(method.key)}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
            {/* Secure Payment Info */}
            <div className="bg-emerald-900/10 border border-emerald-700 rounded-lg p-4 flex items-center space-x-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-300 text-sm font-semibold">
                Secure Payment
                <span className="block text-slate-400 font-normal">Your payment is protected by 256-bit SSL encryption. We never store your payment details.</span>
              </span>
            </div>
            {/* Action Buttons */}
            <div className="flex space-x-3 mt-4">
              <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</Button>
              <Button
                onClick={() => selectedPaymentMethod && handleSelectPayment(selectedPaymentMethod)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center justify-center gap-2"
                disabled={!selectedPaymentMethod || isLoading}
              >
                <CreditCardIcon className="w-5 h-5 mr-2" />
                {`Pay ${convertPrice(item.price.toString())}`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {clientSecret ? (
              <Elements 
                stripe={stripePromise} 
                options={{ 
                  clientSecret,
                  appearance: {
                    theme: 'night',
                    variables: {
                      colorPrimary: '#10b981',
                      colorBackground: '#1e293b',
                      colorText: '#f1f5f9',
                      colorDanger: '#ef4444',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      spacingUnit: '4px',
                      borderRadius: '8px',
                    },
                    rules: {
                      '.Tab': {
                        border: '1px solid #475569',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                      },
                      '.Tab:hover': {
                        color: '#10b981',
                        borderColor: '#10b981',
                      },
                      '.Tab--selected': {
                        borderColor: '#10b981',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                      },
                      '.Input': {
                        border: '1px solid #475569',
                        backgroundColor: '#334155',
                        color: '#f1f5f9',
                      },
                      '.Input:focus': {
                        borderColor: '#10b981',
                        boxShadow: '0 0 0 1px #10b981',
                      },
                      '.Label': {
                        color: '#f1f5f9',
                      },
                      '.Text': {
                        color: '#cbd5e1',
                      },
                    },
                  },
                }}
              >
                <PaymentForm
                  clientSecret={clientSecret}
                  amount={item.price}
                  currency={item.country?.currencyCode || 'USD'}
                  currencySymbol={item.country?.currencySymbol || '$'}
                  itemName={item.name}
                  userCountryCode={userCountryCode}
                  selectedPaymentMethod={selectedPaymentMethod}
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
