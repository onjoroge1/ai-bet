"use client"

import { useState, useEffect } from "react"
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CreditCard, Apple, Smartphone, CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"
import { getAvailablePaymentMethods, SupportedPaymentMethod } from "@/lib/stripe"

interface PaymentFormProps {
  clientSecret: string
  amount: number | string | { toString(): string }
  currency: string
  currencySymbol: string
  itemName: string
  userCountryCode: string
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
  onSuccess,
  onCancel
}: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [availableMethods, setAvailableMethods] = useState<SupportedPaymentMethod[]>([])

  // Ensure amount is a number
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : 
                       typeof amount === 'number' ? amount : 
                       parseFloat(amount.toString())

  useEffect(() => {
    setAvailableMethods(getAvailablePaymentMethods(userCountryCode))
  }, [userCountryCode])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)

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
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setPaymentStatus('success')
        toast.success('Payment successful!')
        setTimeout(() => {
          onSuccess()
        }, 2000)
      }
    } catch (error) {
      console.error('Payment error:', error)
      setPaymentStatus('error')
      toast.error('Payment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const getPaymentMethodIcon = (method: SupportedPaymentMethod) => {
    switch (method) {
      case 'card':
        return <CreditCard className="w-4 h-4" />
      case 'apple_pay':
        return <Apple className="w-4 h-4" />
      case 'google_pay':
        return <Smartphone className="w-4 h-4" />
      case 'paypal':
        return <div className="w-4 h-4 text-blue-500 font-bold text-xs">P</div>
      default:
        return <CreditCard className="w-4 h-4" />
    }
  }

  const getPaymentMethodName = (method: SupportedPaymentMethod) => {
    switch (method) {
      case 'card':
        return 'Credit Card'
      case 'apple_pay':
        return 'Apple Pay'
      case 'google_pay':
        return 'Google Pay'
      case 'paypal':
        return 'PayPal'
      default:
        return method
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-slate-800 border-slate-700">
      <CardHeader className="text-center">
        <CardTitle className="text-white flex items-center justify-center space-x-2">
          <CreditCard className="w-5 h-5 text-emerald-400" />
          <span>Complete Payment</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Order Summary */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h3 className="text-white font-medium mb-2">Order Summary</h3>
          <div className="flex justify-between items-center">
            <span className="text-slate-300">{itemName}</span>
            <span className="text-emerald-400 font-bold">
              {currencySymbol}{numericAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Available Payment Methods */}
        <div className="space-y-2">
          <h4 className="text-white font-medium text-sm">Available Payment Methods</h4>
          <div className="flex flex-wrap gap-2">
            {availableMethods.map((method) => (
              <Badge
                key={method}
                variant="secondary"
                className="bg-slate-700 text-slate-300 border-slate-600"
              >
                <div className="flex items-center space-x-1">
                  {getPaymentMethodIcon(method)}
                  <span className="text-xs">{getPaymentMethodName(method)}</span>
                </div>
              </Badge>
            ))}
          </div>
        </div>

        {/* Payment Status */}
        {paymentStatus !== 'pending' && (
          <div className={`flex items-center space-x-2 p-3 rounded-lg ${
            paymentStatus === 'success' 
              ? 'bg-emerald-500/20 border border-emerald-500/30' 
              : 'bg-red-500/20 border border-red-500/30'
          }`}>
            {paymentStatus === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <span className={`text-sm font-medium ${
              paymentStatus === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {paymentStatus === 'success' ? 'Payment Successful!' : 'Payment Failed'}
            </span>
          </div>
        )}

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement 
            options={{
              layout: 'tabs',
              paymentMethodOrder: availableMethods,
            }}
          />
          
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            
            <Button
              type="submit"
              disabled={!stripe || isProcessing}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessing ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4" />
                  <span>Pay {currencySymbol}{numericAmount.toFixed(2)}</span>
                </div>
              )}
            </Button>
          </div>
        </form>

        {/* Security Notice */}
        <div className="text-center">
          <p className="text-xs text-slate-400">
            🔒 Your payment is secured by Stripe. We never store your card details.
          </p>
        </div>
      </CardContent>
    </Card>
  )
} 