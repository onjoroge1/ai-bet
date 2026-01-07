"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, ArrowRight } from "lucide-react"

/**
 * Subscription Checkout Redirect Page
 * Creates checkout session and redirects to Stripe
 */
export default function SubscribePage() {
  const router = useRouter()
  const params = useParams()
  const planId = params.planId as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!planId) {
      setError('Invalid plan ID')
      setLoading(false)
      return
    }

    createCheckoutSession()
  }, [planId])

  const createCheckoutSession = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const data = await response.json()
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      console.error('Error creating checkout session:', err)
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mx-auto mb-4" />
            <p className="text-slate-300 mb-2">Preparing your checkout...</p>
            <p className="text-slate-400 text-sm">Redirecting to secure payment page</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-red-900/20 border-red-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Checkout Error</h2>
            <p className="text-red-400 mb-6">{error}</p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => router.push('/pricing')}
                variant="outline"
                className="border-slate-600 text-slate-300"
              >
                Back to Pricing
              </Button>
              <Button
                onClick={createCheckoutSession}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

