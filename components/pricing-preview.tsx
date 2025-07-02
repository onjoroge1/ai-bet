"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Crown, Zap, Globe, Loader2, RefreshCw } from "lucide-react"
import { DynamicPricing } from "@/components/dynamic-pricing"
import { Button } from "@/components/ui/button"

// Type for pricing plan data
type PricingPlan = {
  id: string
  name: string
  price: string
  originalPrice?: string
  period: string
  description: string
  features: string[]
  tipCount?: number
  validityDays?: number
  isPopular: boolean
  planType: string
  currencyCode: string
  currencySymbol: string
}

type PricingData = {
  plans: PricingPlan[]
  country: {
    code: string
    currencyCode: string
    currencySymbol: string
  }
}

// Function to fetch pricing plans
const fetchPricingPlans = async (): Promise<PricingData> => {
  const response = await fetch('/api/homepage/pricing')
  if (!response.ok) {
    throw new Error('Failed to fetch pricing plans')
  }
  return response.json()
}

export function PricingPreview() {
  const { data: pricingData, isLoading, error, refetch } = useQuery({
    queryKey: ['homepage-pricing'],
    queryFn: fetchPricingPlans,
    staleTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
  })

  // Default plans for loading/error states
  const defaultPlans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Get started with basic predictions",
      features: ["3 free predictions daily", "Basic AI analysis", "Community access", "Mobile app access"],
      cta: "Get Started",
      popular: false,
      icon: Zap,
      href: "/signup",
    },
    {
      id: "vip",
      name: "VIP",
      price: "$10",
      period: "month",
      description: "Unlock premium predictions and insights",
      features: [
        "Unlimited predictions",
        "Advanced AI analysis",
        "Confidence scores",
        "Telegram alerts",
        "Priority support",
        "Historical data",
      ],
      cta: "Go VIP",
      popular: true,
      icon: Crown,
      href: "/signup",
    },
    {
      id: "pro",
      name: "Global Pro",
      price: "$25",
      period: "month",
      description: "For serious bettors across all markets",
      features: ["Everything in VIP", "Multi-league coverage", "Live predictions", "Custom strategies", "API access"],
      cta: "Go Pro",
      popular: false,
      icon: Globe,
      href: "/signup",
    },
  ]

  // Transform API data to match DynamicPricing expectations
  const transformPlans = (plans: PricingPlan[]) => {
    return plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      period: plan.period,
      description: plan.description,
      features: plan.features,
      cta: plan.planType === "package" ? "Buy Package" : "Get Started",
      popular: plan.isPopular,
      icon: plan.planType === "package" ? Globe : plan.isPopular ? Crown : Zap,
      href: "/signup",
    }))
  }

  const displayPlans = isLoading ? defaultPlans : (pricingData ? transformPlans(pricingData.plans) : defaultPlans)

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Choose Your Winning Plan</h2>
            {!isLoading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-slate-300 text-lg mb-6">Start free, upgrade when you're ready to maximize your profits</p>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Globe className="w-4 h-4 mr-2" />
            Regional pricing available
          </Badge>
          {isLoading && (
            <div className="flex items-center justify-center mt-4">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mr-2" />
              <span className="text-slate-400 text-sm">Loading pricing plans...</span>
            </div>
          )}
          {error && (
            <div className="text-red-400 text-sm mt-2">
              Using default pricing. Click refresh to try again.
            </div>
          )}
        </div>

        <DynamicPricing plans={displayPlans} />

        <div className="text-center mt-8">
          <p className="text-slate-400 text-sm">
            All plans include: M-Pesa, Paytm, Flutterwave, Stripe and KES payments • 24/7 support • 30-day money-back
            guarantee
          </p>
        </div>
      </div>
    </section>
  )
}
