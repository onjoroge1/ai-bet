"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CreditCard, Smartphone, CheckCircle, Clock, Shield, Zap, Star, Crown, Gift, Brain, TrendingUp, Target, Loader2, Info, XCircle } from "lucide-react"
import { useUserCountry } from "@/contexts/user-country-context"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { TipReceipt } from './tip-receipt'
import { PremiumPackageReceipt } from './premium-package-receipt'
import { Elements } from "@stripe/react-stripe-js"
import { stripePromise } from "@/lib/stripe"
import { PaymentForm } from "@/components/payment-form"
import { useQueryClient } from '@tanstack/react-query'

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
  matchId?: string | null
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

interface PaymentMethod {
  key: string
  label: string
  desc: string
  icon: React.ReactNode
}

function PaymentMethodCard({ method, selected, onClick, comingSoon }: { method: PaymentMethod, selected: boolean, onClick: () => void, comingSoon?: boolean }) {
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
  const { convertPrice, userCountry } = useUserCountry()
  const queryClient = useQueryClient();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("")
  const [showReceipt, setShowReceipt] = useState(false)
  const [purchasedTip, setPurchasedTip] = useState<any>(null)
  const [packageStatus, setPackageStatus] = useState<PackageStatus | null>(null)
  const [paymentStep, setPaymentStep] = useState<'select' | 'pay'>('select')
  const [clientSecret, setClientSecret] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [userCountryCode, setUserCountryCode] = useState(userCountry || 'US')
  
  // Check if Stripe key is configured (runtime check)
  const hasStripeKey = typeof window !== 'undefined' && 
    !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.trim().startsWith('pk_test_') || 
     process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.trim().startsWith('pk_live_'))

  useEffect(() => {
    if (isOpen) {
      setSelectedPaymentMethod("");
      fetchPackageStatus();
      setPaymentStep('select');
      setClientSecret('');
      setUserCountryCode(userCountry || 'US');
      // Default tab: always global first
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
    // Just select the payment method - don't create payment intent yet
    // The "Pay $19.99" button will become active, and payment intent will be created when user clicks it
  };

  // New: Handle pay button click
  const handlePayClick = async () => {
    if (!selectedPaymentMethod) return;
    
    // Local payments (not implemented): show toast and do not transition
    if (isKenya && (selectedPaymentMethod === 'mpesa' || selectedPaymentMethod === 'airtel_money')) {
      toast('Coming soon: Local payment integration for ' + (selectedPaymentMethod === 'mpesa' ? 'M-Pesa' : 'Airtel Money'));
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
          paymentMethod: selectedPaymentMethod,
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

  const handlePaymentSuccess = async () => {
    toast.success('Purchase successful!');
    
    // Handle package purchases - use current item data instead of fetching from database
    if (item?.type === 'package') {
      console.log('🔍 DEBUG: Creating receipt for package purchase:', item?.id);
      
      const receiptPackage = {
        id: item?.id || 'unknown',
        purchaseId: item?.id || 'unknown',
        name: item?.name || 'Package Purchase',
        type: 'package',
        price: item?.price || 0,
        amount: item?.price || 0,
        description: item?.description || 'Package purchase completed successfully',
        features: item?.features || [],
        currencySymbol: item?.country?.currencySymbol || '$',
        currencyCode: item?.country?.currencyCode || 'USD',
        purchaseDate: new Date().toISOString(),
        paymentMethod: selectedPaymentMethod || 'card',
        packageType: item?.id?.split('_')[1] || 'unknown',
        creditsGained: item?.tipCount === -1 ? 1000 : (item?.tipCount || 1),
        tipsIncluded: item?.tipCount || 1,
        validityDays: item?.tipCount === -1 ? 30 : (item?.tipCount === 5 ? 3 : 7)
      };
      
      console.log('🔍 DEBUG: Receipt package data:', receiptPackage);
      setPurchasedTip(receiptPackage);
      setShowReceipt(true);
    } else {
      // Handle tip purchases - use current item data instead of fetching from database
      // This prevents race condition where webhook hasn't processed yet
      console.log('🔍 DEBUG: Creating receipt for tip purchase:', item?.id);
      
      const receiptTip = {
        id: item?.id || 'unknown',
        purchaseId: item?.id || 'unknown',
        name: item?.name || 'Tip Purchase',
        type: item?.type || 'tip',
        price: item?.price || 0,
        amount: item?.price || 0,
        description: item?.description || 'Tip purchase completed successfully',
        features: item?.features || [],
        isUrgent: item?.isUrgent || false,
        timeLeft: item?.timeLeft || null,
        currencySymbol: item?.country?.currencySymbol || '$',
        currencyCode: item?.country?.currencyCode || 'USD',
        purchaseDate: new Date().toISOString(),
        paymentMethod: selectedPaymentMethod || 'card',
        matchId: item?.matchId || null,
        // Use the current item's match data instead of fetching from database
        homeTeam: item?.matchData?.home_team,
        awayTeam: item?.matchData?.away_team,
        matchDate: item?.matchData?.date,
        league: item?.matchData?.league,
        predictionType: item?.predictionType,
        confidenceScore: item?.confidenceScore,
        odds: item?.odds,
        valueRating: item?.valueRating
      };
      
      console.log('🔍 DEBUG: Receipt tip data:', receiptTip);
      setPurchasedTip(receiptTip);
      setShowReceipt(true);
    }
    
    // Invalidate notification unread count to update bell
    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    }
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

  // Helper: Is user in Kenya?
  const isKenya = userCountryCode.toLowerCase() === 'ke' || userCountryCode.toLowerCase() === 'kenya';

  // Payment methods config
  const globalPayments = [
    { key: 'card', label: 'Credit Card', icon: <CreditCard className="w-8 h-8 mx-auto mb-2 text-emerald-400" />, desc: 'Visa, Mastercard, Amex' },
    { key: 'apple_pay', label: 'Apple Pay', icon: <div className="w-8 h-8 mx-auto mb-2 text-blue-400">📱</div>, desc: 'Quick & Secure' },
    { key: 'google_pay', label: 'Google Pay', icon: <div className="w-8 h-8 mx-auto mb-2 text-green-400">📱</div>, desc: 'Quick & Secure' },
  ];
  const localPaymentsKE = [
    { key: 'mpesa', label: 'M-Pesa', icon: <Smartphone className="w-8 h-8 mx-auto mb-2 text-green-500" />, desc: 'Pay with M-Pesa' },
    { key: 'airtel_money', label: 'Airtel Money', icon: <Smartphone className="w-8 h-8 mx-auto mb-2 text-red-500" />, desc: 'Pay with Airtel Money' },
  ];

  if (showReceipt && purchasedTip) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          {purchasedTip.type === 'package' ? (
            <PremiumPackageReceipt package={purchasedTip} onClose={onClose} />
          ) : (
            <TipReceipt tip={purchasedTip} onClose={onClose} />
          )}
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
          
          {/* Step Indicator */}
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-medium">
                1
              </div>
              <span className="text-sm text-slate-300">Select Payment Method</span>
            </div>
            <div className="flex-1 h-px bg-slate-600"></div>
            <div className="flex items-center space-x-2">
              <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${
                selectedPaymentMethod ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-slate-400'
              }`}>
                2
              </div>
              <span className={`text-sm ${selectedPaymentMethod ? 'text-slate-300' : 'text-slate-500'}`}>
                Payment
              </span>
            </div>
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
                  <h4 className="text-white font-medium text-sm">What&apos;s included:</h4>
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
            {/* Payment Methods */}
            <div className="space-y-4">
              {/* Local Payments for Kenya */}
              {isKenya && (
                <div>
                  <h4 className="text-white font-medium text-sm mb-3 flex items-center">
                    <Smartphone className="w-4 h-4 mr-2 text-green-400" />
                    Local Payment Methods (Kenya)
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-6">
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
                </div>
              )}
              
              {/* Global Payment Methods */}
              <div>
                <h4 className="text-white font-medium text-sm mb-3 flex items-center">
                  <CreditCard className="w-4 h-4 mr-2 text-emerald-400" />
                  Payment Methods
                </h4>
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
              </div>
            </div>
            
            {/* Selected Payment Method Indicator */}
            {selectedPaymentMethod && (
              <div className="mb-4 p-3 bg-emerald-900/20 border border-emerald-700/50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-300 font-medium">
                    Payment method selected: {
                      [...globalPayments, ...localPaymentsKE].find(m => m.key === selectedPaymentMethod)?.label || selectedPaymentMethod
                    }
                  </span>
                </div>
                <p className="text-slate-400 text-sm mt-1">
                  Click "Continue to Payment" below to proceed to payment
                </p>
              </div>
            )}
            
            {/* Instruction Text */}
            {!selectedPaymentMethod && (
              <div className="mb-4 p-3 bg-slate-800/50 border border-slate-600 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  <span className="text-slate-300 font-medium">Choose your payment method</span>
                </div>
                <p className="text-slate-400 text-sm mt-1">
                  Select a payment method above, then click "Continue to Payment" to proceed
                </p>
              </div>
            )}
            
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
                onClick={handlePayClick}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center justify-center gap-2"
                disabled={!selectedPaymentMethod || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Continue to Payment
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!hasStripeKey && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-red-300 font-medium">Stripe Configuration Error</p>
                    <p className="text-red-400 text-sm mt-1">
                      Stripe publishable key is missing or invalid. Please check your .env.local file.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {clientSecret && hasStripeKey ? (
              <Elements 
                stripe={stripePromise}
                options={{ 
                  clientSecret,
                  loader: 'auto',
                  onReady: () => {
                    console.log('[QuickPurchaseModal] ✅ Stripe Elements initialized successfully')
                  },
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
                  // Enhanced Apple Pay and Google Pay configuration
                  paymentMethodOrder: ['apple_pay', 'google_pay', 'card'],
                  wallets: {
                    applePay: 'auto',
                    googlePay: 'auto',
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
            ) : clientSecret && !hasStripeKey ? (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
                <div className="text-center">
                  <XCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
                  <h4 className="text-white font-medium mb-2">Payment System Unavailable</h4>
                  <p className="text-red-400 text-sm">
                    Stripe is not configured. Please contact support.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="ml-3 text-slate-400">Initializing payment...</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
