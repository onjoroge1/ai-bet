"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Crown, Zap, Globe, Layers, TrendingUp, Loader2, AlertCircle } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

interface PricingPlan {
  id: string
  name: string
  description: string
  price: number | null
  originalPrice: number | null
  period: string
  discount?: number
  features: string[]
  popular: boolean
  planType: string
  currencyCode?: string
  currencySymbol?: string
  countrySpecific?: boolean
  comingSoon?: boolean
  stripePriceId?: string
}

/**
 * PricingContent - Client component that uses useSearchParams
 * This component is wrapped in Suspense in the parent page component
 */
export function PricingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  useEffect(() => {
    fetchPricing()
    // Check for plan parameter in URL
    const planParam = searchParams.get('plan')
    if (planParam) {
      setSelectedPlan(planParam === 'parlay' ? 'parlay_pro' : planParam)
    }
  }, [searchParams])

  const fetchPricing = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/pricing')
      if (!response.ok) {
        throw new Error('Failed to fetch pricing')
      }
      const data = await response.json()
      setPlans(data.plans || [])
    } catch (err) {
      console.error('Error fetching pricing:', err)
      setError(err instanceof Error ? err.message : 'Failed to load pricing')
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = (planId: string) => {
    if (planId === 'free') {
      router.push('/signup')
      return
    }

    if (planId === 'complete') {
      // Coming soon
      return
    }

    // Redirect to subscription checkout
    router.push(`/subscribe/${planId}`)
  }

  const formatPrice = (plan: PricingPlan): string => {
    if (plan.price === null) return 'Contact Us'
    if (plan.price === 0) return 'Free'
    
    const symbol = plan.currencySymbol || '$'
    return `${symbol}${plan.price.toFixed(2)}`
  }

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'parlay_pro':
        return Layers
      case 'premium_intelligence':
        return TrendingUp
      case 'complete':
        return Crown
      default:
        return Zap
    }
  }

  // Feature comparison data
  const comparisonFeatures = [
    { name: 'Parlays Access', free: false, parlay: true, premium: false, complete: true },
    { name: 'Premium Dashboard', free: false, parlay: false, premium: true, complete: true },
    { name: 'CLV Tracker', free: false, parlay: false, premium: true, complete: true },
    { name: 'AI Analysis', free: true, parlay: true, premium: true, complete: true },
    { name: 'Quality Filtering', free: false, parlay: true, premium: true, complete: true },
    { name: 'Risk Assessment', free: false, parlay: true, premium: true, complete: true },
    { name: 'Email Alerts', free: false, parlay: true, premium: true, complete: true },
    { name: 'Priority Support', free: false, parlay: true, premium: true, complete: true },
    { name: 'Historical Performance', free: false, parlay: true, premium: false, complete: true },
    { name: 'Advanced Analytics', free: false, parlay: false, premium: true, complete: true },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading pricing plans...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-red-900/20 border-red-500/30 max-w-2xl">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={fetchPricing} variant="outline" className="border-red-500/30 text-red-400">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Choose Your Plan</h1>
          <p className="text-xl text-slate-300 mb-2">Unlock Premium Features</p>
          <p className="text-slate-400">Start free, upgrade when you're ready</p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.map((plan) => {
            const Icon = getPlanIcon(plan.id)
            const isSelected = selectedPlan === plan.id
            
            return (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.popular
                    ? 'bg-gradient-to-b from-emerald-900/50 to-slate-800/50 border-emerald-500/50 ring-2 ring-emerald-500/30'
                    : 'bg-slate-800/50 border-slate-700'
                } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white">
                    Most Popular
                  </Badge>
                )}
                {plan.discount && (
                  <Badge className="absolute -top-3 right-4 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    {plan.discount}% OFF
                  </Badge>
                )}
                {plan.comingSoon && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500/20 text-blue-400 border-blue-500/30">
                    Coming Soon
                  </Badge>
                )}

                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <Icon className="h-6 w-6 text-emerald-400" />
                    </div>
                    <CardTitle className="text-white text-xl">{plan.name}</CardTitle>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white">{formatPrice(plan)}</span>
                      {plan.price !== null && plan.price > 0 && (
                        <span className="text-slate-400">/{plan.period}</span>
                      )}
                    </div>
                    {plan.originalPrice && plan.originalPrice > plan.price! && (
                      <div className="text-slate-500 line-through text-lg">
                        {plan.currencySymbol || '$'}{plan.originalPrice.toFixed(2)}/{plan.period}
                      </div>
                    )}
                    <p className="text-slate-400 text-sm">{plan.description}</p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-300">
                        <Check className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={plan.comingSoon}
                    className={`w-full ${
                      plan.popular
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800'
                        : plan.id === 'free'
                        ? 'bg-slate-700 hover:bg-slate-600'
                        : 'bg-slate-700 hover:bg-slate-600'
                    } text-white`}
                  >
                    {plan.id === 'free' && 'Get Started'}
                    {plan.id !== 'free' && !plan.comingSoon && 'Subscribe'}
                    {plan.comingSoon && 'Coming Soon'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Feature Comparison Table */}
        <Card className="bg-slate-800/50 border-slate-700 mb-12">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Feature Comparison</CardTitle>
            <p className="text-slate-400">Compare features across all plans</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-4 px-4 text-slate-300 font-semibold">Feature</th>
                    <th className="text-center py-4 px-4 text-slate-300 font-semibold">Free</th>
                    <th className="text-center py-4 px-4 text-slate-300 font-semibold">Parlay Pro</th>
                    <th className="text-center py-4 px-4 text-slate-300 font-semibold">Premium</th>
                    <th className="text-center py-4 px-4 text-slate-300 font-semibold">Complete</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature, idx) => (
                    <tr key={idx} className="border-b border-slate-700/50">
                      <td className="py-4 px-4 text-white font-medium">{feature.name}</td>
                      <td className="py-4 px-4 text-center">
                        {feature.free ? (
                          <Check className="h-5 w-5 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {feature.parlay ? (
                          <Check className="h-5 w-5 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {feature.premium ? (
                          <Check className="h-5 w-5 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {feature.complete ? (
                          <Check className="h-5 w-5 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-white font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-slate-400">Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.</p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">What payment methods are accepted?</h3>
              <p className="text-slate-400">We accept all major credit cards, debit cards, and regional payment methods through Stripe.</p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">Is pricing country-specific?</h3>
              <p className="text-slate-400">Premium Intelligence pricing varies by country. Parlay Pro uses standard USD pricing with promotional discount.</p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">Do you offer refunds?</h3>
              <p className="text-slate-400">We offer a 30-day money-back guarantee for all subscriptions. Contact support for assistance.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

