"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Crown, Zap, Globe } from "lucide-react"
import { DynamicPricing } from "@/components/dynamic-pricing"

export function PricingPreview() {
  const plans = [
    {
      name: "Free",
      price: "€0",
      period: "forever",
      description: "Get started with basic predictions",
      features: ["3 free predictions daily", "Basic AI analysis", "Community access", "Mobile app access"],
      cta: "Get Started",
      popular: false,
      icon: Zap,
      href: "/signup",
    },
    {
      name: "VIP",
      price: "KES 800",
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
      name: "Global Pro",
      price: "KES 2,500",
      period: "month",
      description: "For serious bettors across all markets",
      features: ["Everything in VIP", "Multi-league coverage", "Live predictions", "Custom strategies", "API access"],
      cta: "Go Pro",
      popular: false,
      icon: Globe,
      href: "/signup",
    },
  ]

  const [dynamicPlans, setDynamicPlans] = useState(plans)

  useEffect(() => {
    // Fetch dynamic pricing data from an API or other source
    // For demonstration, we'll just use the static plans data
    setDynamicPlans(plans)
  }, [])

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Choose Your Winning Plan</h2>
          <p className="text-slate-300 text-lg mb-6">Start free, upgrade when you're ready to maximize your profits</p>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Globe className="w-4 h-4 mr-2" />
            Regional pricing available
          </Badge>
        </div>

        <DynamicPricing plans={dynamicPlans} />

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
