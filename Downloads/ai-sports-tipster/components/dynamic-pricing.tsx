"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Crown, Zap, Globe, CreditCard, Star, Sparkles, TrendingUp, Clock, Wallet } from "lucide-react"
import Link from "next/link"
import { CountrySelector } from "@/components/country-selector"
import { getCountryFromDomain, getCountryPricing, type CountryPricing } from "@/lib/country-pricing"

type Plan = {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  popular: boolean
  icon: React.ComponentType<{ className?: string }>
  href: string
}

type DynamicPricingProps = {
  plans: Plan[]
}

export function DynamicPricing({ plans }: DynamicPricingProps) {
  const [selectedCountry, setSelectedCountry] = useState("kenya")
  const [countryData, setCountryData] = useState<CountryPricing | null>(null)
  const [activeTab, setActiveTab] = useState("flexible") // Default to flexible options

  useEffect(() => {
    // Try to detect country from domain/URL
    if (typeof window !== "undefined") {
      const detectedCountry = getCountryFromDomain(window.location.hostname)
      setSelectedCountry(detectedCountry)
    }
  }, [])

  useEffect(() => {
    setCountryData(getCountryPricing(selectedCountry))
  }, [selectedCountry])

  if (!countryData) return null

  // Benefits specific to flexible options
  const flexibleBenefits = [
    {
      icon: Wallet,
      title: "Pay Only What You Need",
      description: "No monthly commitments - buy only the tips you want",
    },
    {
      icon: Clock,
      title: "Instant Access",
      description: "Get immediate access to premium tips after payment",
    },
    {
      icon: TrendingUp,
      title: "Try Before Subscribing",
      description: "Test our predictions before committing to a monthly plan",
    },
    {
      icon: Star,
      title: "Local Payment Methods",
      description: `Supports ${countryData.paymentMethods.join(", ")}`,
    },
  ]

  // Testimonials specific to flexible options
  const flexibleTestimonials = [
    {
      name: "James M.",
      location: countryData.name,
      quote: "I love being able to buy tips only when I need them. Perfect for my weekend bets!",
      amount: "Won 15,000 KSh",
    },
    {
      name: "Sarah N.",
      location: countryData.name,
      quote: "The daily package helped me win big last weekend. Worth every shilling!",
      amount: "Won 8,500 KSh",
    },
  ]

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Country Selector */}
        <CountrySelector selectedCountry={selectedCountry} onCountryChange={setSelectedCountry} />

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <span className="text-3xl">{countryData.flag}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white">{countryData.brandName}</h2>
          </div>
          <p className="text-slate-300 text-lg mb-4">{countryData.tagline}</p>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Globe className="w-4 h-4 mr-2" />
            Optimized for {countryData.name}
          </Badge>
        </div>

        {/* Pricing Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-800/50 rounded-lg p-1 flex">
            <button
              onClick={() => setActiveTab("flexible")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "flexible" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-300 hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4 inline mr-2" />
              Flexible Options
            </button>
            <button
              onClick={() => setActiveTab("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "monthly" ? "bg-slate-700 text-white" : "text-slate-300 hover:text-white"
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Monthly Plans
            </button>
          </div>
        </div>

        {/* Flexible Options - Enhanced and Highlighted */}
        {activeTab === "flexible" && (
          <div className="mb-12 animate-fadeIn">
            <div className="relative">
              {/* Decorative elements */}
              <div className="absolute -top-6 -left-6 w-20 h-20 bg-emerald-500/20 rounded-full blur-xl"></div>
              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl"></div>

              <Card className="bg-gradient-to-br from-slate-800/90 via-slate-800/70 to-emerald-900/40 border-emerald-500/30 p-6 relative overflow-hidden shadow-xl">
                {/* Highlight banner */}
                <div className="absolute top-0 right-0 bg-emerald-600 text-white px-4 py-1 rounded-bl-lg font-medium text-sm flex items-center">
                  <Star className="w-4 h-4 mr-1 text-yellow-300" fill="currentColor" />
                  Most Popular in {countryData.name}
                </div>

                <div className="text-center mb-8">
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 mr-2 text-emerald-400" />
                    Pay As You Go Options
                  </h3>
                  <p className="text-emerald-300 text-lg mb-2">Perfect for {countryData.name} bettors</p>
                  <p className="text-slate-300">Buy only what you need, when you need it</p>
                </div>

                {/* Flexible options grid with enhanced styling */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {countryData.flexibleOptions.map((option, index) => (
                    <div
                      key={index}
                      className="bg-slate-900/70 hover:bg-slate-800 border border-emerald-500/20 hover:border-emerald-500/50 rounded-lg p-5 text-center transition-all hover:transform hover:scale-105 hover:shadow-emerald-500/20 hover:shadow-lg"
                    >
                      <div className="text-xl font-bold text-emerald-400 mb-2">{option.price}</div>
                      <div className="text-white font-medium mb-2">{option.name}</div>
                      <div className="text-slate-300 text-sm">{option.description}</div>
                      <Button className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white">Buy Now</Button>
                    </div>
                  ))}
                </div>

                {/* Benefits of flexible options */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {flexibleBenefits.map((benefit, index) => (
                    <div key={index} className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-3">
                        <benefit.icon className="w-6 h-6 text-emerald-400" />
                      </div>
                      <h4 className="text-white font-medium mb-1">{benefit.title}</h4>
                      <p className="text-slate-300 text-sm">{benefit.description}</p>
                    </div>
                  ))}
                </div>

                {/* Testimonials */}
                <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
                  <h4 className="text-white font-medium mb-4 text-center">What {countryData.name} Users Say</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {flexibleTestimonials.map((testimonial, index) => (
                      <div key={index} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p className="text-slate-300 text-sm italic mb-2">"{testimonial.quote}"</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{testimonial.name}</p>
                            <p className="text-slate-400 text-xs">{testimonial.location}</p>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-400">{testimonial.amount}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="text-center">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg">
                    Get Started with Flexible Options
                  </Button>
                  <p className="text-slate-400 text-sm mt-2">No commitment • Instant access • Local payment methods</p>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Monthly Subscription Plans */}
        {activeTab === "monthly" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fadeIn">
            {plans.map((plan, index) => (
              <Card
                key={index}
                className={`relative p-6 ${
                  plan.popular
                    ? "bg-gradient-to-b from-emerald-900/50 to-slate-800/50 border-emerald-500/50"
                    : "bg-slate-800/50 border-slate-700"
                } hover:bg-slate-800/70 transition-colors`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white">
                    Most Popular
                  </Badge>
                )}

                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <plan.icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold text-white mb-1">
                    {plan.price}
                    <span className="text-lg text-slate-400">/{plan.period}</span>
                  </div>
                  <p className="text-slate-400 text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 mr-3 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.href || "/"}>
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-slate-700 hover:bg-slate-600 text-white"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )}

        {/* Payment Methods */}
        <Card className="bg-slate-800/50 border-slate-700 p-6">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">Local Payment Methods</h3>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {countryData.paymentMethods.map((method, index) => (
                <Badge key={index} className="bg-slate-700 text-slate-300">
                  {method}
                </Badge>
              ))}
            </div>
            <p className="text-slate-400 text-sm">
              All plans include: 24/7 support • 30-day money-back guarantee • Instant activation
            </p>
          </div>
        </Card>
      </div>

      {/* Add some CSS animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </section>
  )
}
