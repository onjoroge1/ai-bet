"use client"

import { useState, useEffect } from "react"
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CreditCard, CheckCircle, XCircle, Shield, Zap, Clock } from "lucide-react"
import { toast } from "sonner"

interface PaymentFormProps {
  clientSecret: string
  amount: number | string | { toString(): string }
  currency: string
  currencySymbol: string
  itemName: string
  userCountryCode: string
  selectedPaymentMethod?: string
  onSuccess: () => void
  onCancel: () => void
}

export function PaymentForm({
  clientSecret,
  amount,
  currency,
  currencySymbol,
  itemName,
  userCountryCode,
  selectedPaymentMethod,
  onSuccess,
  onCancel
}: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success' | 'error'>('pending')
  const [paymentIntentId, setPaymentIntentId] = useState<string>('')
  const [pollingAttempts, setPollingAttempts] = useState(0)

  // Ensure amount is a number
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : 
                       typeof amount === 'number' ? amount : 
                       parseFloat(amount.toString())

  // Poll for payment confirmation
  const pollPaymentStatus = async (intentId: string) => {
    const maxAttempts = 15 // 30 seconds total (15 * 2 seconds)
    let attempts = 0

    const poll = async (): Promise<boolean> => {
      try {
        const response = await fetch(`/api/payments/status?payment_intent=${intentId}`)
        const data = await response.json()

        if (data.status === 'succeeded') {
          setPaymentStatus('success')
          toast.success('Payment confirmed! Your purchase is now available.')
          setTimeout(() => {
            onSuccess()
          }, 2000)
          return true
        } else if (data.status === 'failed') {
          setPaymentStatus('error')
          toast.error('Payment failed. Please try again.')
          return true
        } else {
          // Still processing
          attempts++
          setPollingAttempts(attempts)
          
          if (attempts >= maxAttempts) {
            setPaymentStatus('error')
            toast.error('Payment confirmation timeout. Please contact support.')
            return true
          }
          
          // Continue polling
          setTimeout(poll, 2000)
          return false
        }
      } catch (error) {
        console.error('Error polling payment status:', error)
        attempts++
        setPollingAttempts(attempts)
        
        if (attempts >= maxAttempts) {
          setPaymentStatus('error')
          toast.error('Unable to confirm payment. Please contact support.')
          return true
        }
        
        // Continue polling
        setTimeout(poll, 2000)
        return false
      }
    }

    return poll()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setPaymentStatus('processing')
    setPollingAttempts(0)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success`,
        },
        redirect: 'if_required',
      })

      if (error) {
        setPaymentStatus('error')
        toast.error(error.message || 'Payment failed')
      } else if (paymentIntent) {
        setPaymentIntentId(paymentIntent.id)
        
        // Start polling for backend confirmation
        if (paymentIntent.status === 'succeeded') {
          // Stripe says succeeded, but we need backend confirmation
          await pollPaymentStatus(paymentIntent.id)
        } else if (paymentIntent.status === 'processing') {
          // Payment is still processing, poll for updates
          await pollPaymentStatus(paymentIntent.id)
        } else {
          // Other statuses (requires_payment_method, requires_confirmation, etc.)
          setPaymentStatus('error')
          toast.error('Payment requires additional action. Please try again.')
        }
      }
    } catch (error) {
      console.error('Payment error:', error)
      setPaymentStatus('error')
      toast.error('Payment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto bg-slate-800/90 border-slate-700 backdrop-blur-sm" aria-label="Payment form">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-white flex items-center justify-center space-x-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          <span>Complete Your Purchase</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Order Summary */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3 flex items-center">
            <CreditCard className="w-4 h-4 mr-2 text-emerald-400" />
            Order Summary
          </h3>
          <div className="flex justify-between items-center">
            <span className="text-slate-300 text-sm">{itemName}</span>
            <span className="text-emerald-400 font-bold text-lg">
              {currencySymbol}{numericAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Selected Payment Method Display */}
        {selectedPaymentMethod && (
          <div className="bg-slate-800/50 border border-slate-600 rounded-xl p-4">
            <h4 className="text-white font-medium text-sm mb-3 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-emerald-400" />
              Selected Payment Method
            </h4>
            <div className="flex items-center space-x-3">
              {selectedPaymentMethod === 'card' && (
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-300 font-medium">Credit Card</span>
                  <span className="text-slate-400 text-sm">(Visa, Mastercard, Amex)</span>
                </div>
              )}
              {selectedPaymentMethod === 'apple_pay' && (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 text-blue-400">📱</div>
                  <span className="text-blue-300 font-medium">Apple Pay</span>
                  <span className="text-slate-400 text-sm">(Quick & Secure)</span>
                </div>
              )}
              {selectedPaymentMethod === 'google_pay' && (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 text-green-400">📱</div>
                  <span className="text-green-300 font-medium">Google Pay</span>
                  <span className="text-slate-400 text-sm">(Quick & Secure)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Status */}
        {paymentStatus !== 'pending' && (
          <div className={`flex items-center space-x-3 p-4 rounded-xl border ${
            paymentStatus === 'success' 
              ? 'bg-emerald-500/20 border-emerald-500/30' 
              : paymentStatus === 'processing'
              ? 'bg-blue-500/20 border-blue-500/30'
              : 'bg-red-500/20 border-red-500/30'
          }`}>
            {paymentStatus === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : paymentStatus === 'processing' ? (
              <Clock className="w-5 h-5 text-blue-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <div className="flex-1">
              <span className={`text-sm font-medium ${
                paymentStatus === 'success' ? 'text-emerald-400' : 
                paymentStatus === 'processing' ? 'text-blue-400' : 'text-red-400'
              }`}>
                {paymentStatus === 'success' ? 'Payment Confirmed!' : 
                 paymentStatus === 'processing' ? 'Confirming Payment...' : 'Payment Failed'}
              </span>
              {paymentStatus === 'processing' && (
                <div className="text-xs text-slate-400 mt-1">
                  Attempt {pollingAttempts}/15 - Please wait while we confirm your payment
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Form with Accordion Layout */}
        <form onSubmit={handleSubmit} className="space-y-6" aria-label="Stripe payment form">
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
            <PaymentElement 
              options={{
                layout: {
                  type: 'accordion',
                  defaultCollapsed: false,
                  radios: true,
                  spacedAccordionItems: false
                },
                paymentMethodOrder: selectedPaymentMethod ? [selectedPaymentMethod] : ['apple_pay', 'google_pay', 'card'],
                wallets: {
                  applePay: 'auto',
                  googlePay: 'auto',
                },
                fields: {
                  billingDetails: {
                    name: 'auto',
                    email: 'auto',
                    address: {
                      country: 'auto',
                      line1: 'auto',
                      line2: 'auto',
                      city: 'auto',
                      state: 'auto',
                      postalCode: 'auto',
                    },
                  },
                },
                // Enhanced configuration for better digital wallet support
                terms: {
                  card: 'auto',
                },
                business: {
                  name: 'SnapBet AI',
                },
              }}
            />
          </div>
          
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing || paymentStatus === 'processing'}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500 transition-colors"
            >
              Cancel
            </Button>
            
            <Button
              type="submit"
              disabled={!stripe || isProcessing || paymentStatus === 'processing'}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-3 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/25"
            >
              {isProcessing || paymentStatus === 'processing' ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{paymentStatus === 'processing' ? 'Confirming...' : 'Processing...'}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4" />
                  <span>Pay {currencySymbol}{numericAmount.toFixed(2)}</span>
                </div>
              )}
            </Button>
          </div>
        </form>

        {/* Security Notice */}
        <div className="bg-slate-900/30 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-emerald-300 font-medium mb-1">Secure Payment</p>
              <p className="text-slate-400">
                Your payment is protected by 256-bit SSL encryption. We never store your card details.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 