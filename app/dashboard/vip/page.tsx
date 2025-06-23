"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Crown, Star, CheckCircle, Zap, MessageCircle, Video, BarChart3, Shield, Sparkles } from "lucide-react"
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb"

export default function VIPPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const vipPlans = [
    {
      id: "monthly",
      name: "VIP Monthly",
      price: "KES 2,500",
      originalPrice: "KES 3,500",
      period: "/month",
      description: "Perfect for trying VIP features",
      features: [
        "Unlimited daily tips",
        "VIP-only predictions",
        "Live chat support",
        "Video analysis",
        "Early access to specials",
        "Mobile app access",
      ],
      popular: false,
      savings: 29,
    },
    {
      id: "quarterly",
      name: "VIP Quarterly",
      price: "KES 6,000",
      originalPrice: "KES 10,500",
      period: "/3 months",
      description: "Best value for serious bettors",
      features: [
        "Everything in Monthly",
        "Personal betting advisor",
        "Custom betting strategies",
        "Priority customer support",
        "Exclusive VIP events",
        "Advanced analytics dashboard",
        "Money management tools",
      ],
      popular: true,
      savings: 43,
    },
    {
      id: "yearly",
      name: "VIP Yearly",
      price: "KES 18,000",
      originalPrice: "KES 42,000",
      period: "/year",
      description: "Maximum savings for professionals",
      features: [
        "Everything in Quarterly",
        "One-on-one strategy sessions",
        "Custom betting bot access",
        "Insider information network",
        "VIP-only telegram group",
        "Annual strategy review",
        "Guaranteed profit tracking",
        "Tax optimization advice",
      ],
      popular: false,
      savings: 57,
    },
  ]

  const vipFeatures = [
    {
      icon: Crown,
      title: "Exclusive Predictions",
      description: "Access to VIP-only tips with 90%+ accuracy rate",
      color: "text-yellow-400",
    },
    {
      icon: Video,
      title: "Video Analysis",
      description: "Detailed video breakdowns of each prediction",
      color: "text-purple-400",
    },
    {
      icon: MessageCircle,
      title: "Direct Expert Access",
      description: "Chat directly with our prediction experts",
      color: "text-emerald-400",
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Comprehensive performance tracking and insights",
      color: "text-blue-400",
    },
    {
      icon: Shield,
      title: "Profit Guarantee",
      description: "Monthly profit guarantee or money back",
      color: "text-red-400",
    },
    {
      icon: Zap,
      title: "Instant Alerts",
      description: "Real-time notifications for breaking opportunities",
      color: "text-cyan-400",
    },
  ]

  const vipStats = [
    { label: "VIP Win Rate", value: "92%", color: "text-emerald-400" },
    { label: "Avg Monthly Profit", value: "KES 45,000", color: "text-yellow-400" },
    { label: "Active VIP Members", value: "1,247", color: "text-purple-400" },
    { label: "Customer Satisfaction", value: "98%", color: "text-blue-400" },
  ]

  const testimonials = [
    {
      name: "David Kimani",
      location: "Nairobi",
      membership: "VIP Yearly",
      profit: "KES 180,000",
      text: "VIP membership changed my life. The exclusive tips and personal advisor helped me build a sustainable betting strategy.",
      rating: 5,
      months: 8,
    },
    {
      name: "Sarah Wanjiru",
      location: "Mombasa",
      membership: "VIP Quarterly",
      profit: "KES 95,000",
      text: "The video analysis and advanced analytics are game-changers. I finally understand the science behind successful betting.",
      rating: 5,
      months: 6,
    },
    {
      name: "Michael Odhiambo",
      location: "Kisumu",
      membership: "VIP Monthly",
      profit: "KES 32,000",
      text: "Even as a monthly member, the value is incredible. The VIP predictions have a much higher success rate.",
      rating: 5,
      months: 3,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-800 p-4">
      <div className="max-w-6xl mx-auto">
        <DashboardBreadcrumb />
        {/* OR */}
        {/* <DashboardNavHeader /> */}
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Crown className="w-10 h-10 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">VIP Membership</h1>
            <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
          </div>
          <p className="text-slate-300 text-xl max-w-3xl mx-auto">
            Join the elite circle of successful bettors. Get exclusive access to our highest-accuracy predictions,
            personal betting advisors, and guaranteed monthly profits.
          </p>
        </div>

        {/* VIP Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {vipStats.map((stat, index) => (
            <Card key={index} className="bg-slate-800/50 border-slate-700 text-center">
              <CardContent className="p-4">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-slate-400 text-sm">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="plans" className="space-y-8">
          <TabsList className="bg-slate-800 border-slate-700 grid w-full grid-cols-3">
            <TabsTrigger value="plans" className="data-[state=active]:bg-purple-600">
              VIP Plans
            </TabsTrigger>
            <TabsTrigger value="features" className="data-[state=active]:bg-purple-600">
              Features
            </TabsTrigger>
            <TabsTrigger value="testimonials" className="data-[state=active]:bg-purple-600">
              Success Stories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-8">
            {/* Pricing Plans */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {vipPlans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`bg-slate-800/50 border-slate-700 relative transition-all duration-300 cursor-pointer ${
                    plan.popular ? "ring-2 ring-purple-500 scale-105" : ""
                  } ${selectedPlan === plan.id ? "ring-2 ring-yellow-400" : ""}`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white px-4 py-1">
                      MOST POPULAR
                    </Badge>
                  )}

                  {plan.savings > 0 && (
                    <Badge className="absolute top-4 right-4 bg-emerald-500 text-white">Save {plan.savings}%</Badge>
                  )}

                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-white text-2xl">{plan.name}</CardTitle>
                    <div className="space-y-2">
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-4xl font-bold text-purple-400">{plan.price}</span>
                        <span className="text-slate-400">{plan.period}</span>
                      </div>
                      {plan.originalPrice && Number(plan.originalPrice) !== Number(plan.price) && (
                        <div className="text-slate-500 line-through text-lg">{plan.originalPrice}</div>
                      )}
                    </div>
                    <p className="text-slate-400">{plan.description}</p>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center space-x-3 text-slate-300">
                          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`w-full ${
                        plan.popular
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                          : "bg-slate-700 hover:bg-slate-600"
                      } text-white`}
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      {selectedPlan === plan.id ? "Selected" : "Choose Plan"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Money Back Guarantee */}
            <Card className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border-emerald-500/30">
              <CardContent className="p-6 text-center">
                <Shield className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">30-Day Money Back Guarantee</h3>
                <p className="text-slate-300 max-w-2xl mx-auto">
                  Not satisfied with your VIP experience? Get a full refund within 30 days, no questions asked. We're
                  confident you'll see significant profits in your first month.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vipFeatures.map((feature, index) => (
                <Card
                  key={index}
                  className="bg-slate-800/50 border-slate-700 hover:border-purple-500 transition-all duration-300"
                >
                  <CardContent className="p-6 text-center">
                    <feature.icon className={`w-12 h-12 ${feature.color} mx-auto mb-4`} />
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-slate-300">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Feature Comparison */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-center">VIP vs Regular Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-slate-400 p-3">Feature</th>
                        <th className="text-slate-400 p-3 text-center">Regular</th>
                        <th className="text-purple-400 p-3 text-center">VIP</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      <tr className="border-b border-slate-700/50">
                        <td className="p-3">Daily Tips</td>
                        <td className="p-3 text-center">3-5 tips</td>
                        <td className="p-3 text-center text-emerald-400">Unlimited</td>
                      </tr>
                      <tr className="border-b border-slate-700/50">
                        <td className="p-3">Win Rate</td>
                        <td className="p-3 text-center">75-80%</td>
                        <td className="p-3 text-center text-emerald-400">90%+</td>
                      </tr>
                      <tr className="border-b border-slate-700/50">
                        <td className="p-3">Video Analysis</td>
                        <td className="p-3 text-center">❌</td>
                        <td className="p-3 text-center text-emerald-400">✅</td>
                      </tr>
                      <tr className="border-b border-slate-700/50">
                        <td className="p-3">Personal Advisor</td>
                        <td className="p-3 text-center">❌</td>
                        <td className="p-3 text-center text-emerald-400">✅</td>
                      </tr>
                      <tr className="border-b border-slate-700/50">
                        <td className="p-3">Profit Guarantee</td>
                        <td className="p-3 text-center">❌</td>
                        <td className="p-3 text-center text-emerald-400">✅</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="testimonials" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {testimonial.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-white font-semibold">{testimonial.name}</div>
                        <div className="text-slate-400 text-sm">{testimonial.location}</div>
                        <Badge className="bg-purple-500 text-white text-xs mt-1">{testimonial.membership}</Badge>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-emerald-400 font-bold text-xl">Profit: {testimonial.profit}</div>
                      <div className="text-slate-400 text-sm">In {testimonial.months} months</div>
                    </div>

                    <p className="text-slate-300 mb-4">"{testimonial.text}"</p>

                    <div className="flex space-x-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Join VIP CTA */}
            <Card className="bg-gradient-to-r from-purple-600 to-pink-600 border-none">
              <CardContent className="p-8 text-center">
                <Crown className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-white mb-4">Ready to Join the VIP Circle?</h2>
                <p className="text-purple-100 text-lg mb-6 max-w-2xl mx-auto">
                  Don't let another profitable opportunity slip away. Join over 1,200 successful VIP members who are
                  consistently winning with our exclusive predictions and expert guidance.
                </p>
                <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-8 py-3 text-lg">
                  <Crown className="w-5 h-5 mr-2" />
                  Upgrade to VIP Now
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
