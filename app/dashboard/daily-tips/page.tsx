"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Zap, Crown, TrendingUp, Clock, Target, Star, CheckCircle, Lock, Calendar, Trophy } from "lucide-react"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"

export default function DailyTipsPage() {
  const [selectedTip, setSelectedTip] = useState<number | null>(null)

  const todaysTips = [
    {
      id: 1,
      match: "Arsenal vs Chelsea",
      league: "Premier League",
      time: "15:30",
      prediction: "Over 2.5 Goals",
      odds: "1.85",
      confidence: 85,
      analysis: "Both teams have strong attacking records. Arsenal scored in their last 8 home games.",
      status: "available",
      price: 150,
    },
    {
      id: 2,
      match: "Barcelona vs Real Madrid",
      league: "La Liga",
      time: "18:00",
      prediction: "BTTS Yes",
      odds: "1.75",
      confidence: 90,
      analysis: "El Clasico always delivers goals. Both teams need points in title race.",
      status: "premium",
      price: 250,
    },
    {
      id: 3,
      match: "Bayern vs Dortmund",
      league: "Bundesliga",
      time: "20:30",
      prediction: "Bayern Win",
      odds: "1.65",
      confidence: 78,
      analysis: "Bayern's home record is exceptional. Dortmund missing key players.",
      status: "vip",
      price: 350,
    },
  ]

  const packages = [
    {
      name: "Single Tip",
      price: "KES 150",
      description: "One premium prediction",
      features: ["Detailed analysis", "Confidence rating", "Live updates"],
      popular: false,
    },
    {
      name: "Daily Bundle",
      price: "KES 350",
      description: "All today's tips",
      features: ["3-5 premium tips", "VIP analysis", "Money-back guarantee", "Telegram alerts"],
      popular: true,
    },
    {
      name: "Weekly Pass",
      price: "KES 1,200",
      description: "7 days unlimited",
      features: ["Unlimited daily tips", "VIP predictions", "Expert analysis", "Priority support"],
      popular: false,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Navigation Options - Choose one */}
        <DashboardBreadcrumb />
        {/* OR */}
        {/* <DashboardNavHeader /> */}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Zap className="w-8 h-8 text-yellow-400" />
            <h1 className="text-3xl font-bold text-white">Daily Tips</h1>
            <Badge className="bg-green-500 text-white animate-pulse">LIVE</Badge>
          </div>
          <p className="text-slate-300 text-lg">Get today's premium predictions from our AI-powered analysis</p>
        </div>

        <Tabs defaultValue="today" className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="today" className="data-[state=active]:bg-emerald-600">
              Today's Tips
            </TabsTrigger>
            <TabsTrigger value="packages" className="data-[state=active]:bg-emerald-600">
              Packages
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-emerald-600">
              Purchase History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-sm text-slate-400">Today's Win Rate</p>
                      <p className="text-xl font-bold text-white">87%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-sm text-slate-400">Available Tips</p>
                      <p className="text-xl font-bold text-white">{todaysTips.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-sm text-slate-400">Avg Odds</p>
                      <p className="text-xl font-bold text-white">1.75</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-sm text-slate-400">Next Update</p>
                      <p className="text-xl font-bold text-white">2h 15m</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Today's Tips */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {todaysTips.map((tip) => (
                <Card
                  key={tip.id}
                  className={`bg-slate-800/50 border-slate-700 hover:border-emerald-500 transition-all duration-300 cursor-pointer ${
                    selectedTip === tip.id ? "ring-2 ring-emerald-500" : ""
                  }`}
                  onClick={() => setSelectedTip(tip.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white text-lg">{tip.match}</CardTitle>
                        <p className="text-slate-400 text-sm">{tip.league}</p>
                      </div>
                      <div className="text-right">
                        <Badge
                          className={`${
                            tip.status === "available"
                              ? "bg-green-500"
                              : tip.status === "premium"
                                ? "bg-purple-500"
                                : "bg-yellow-500"
                          } text-white`}
                        >
                          {tip.status === "available" ? "Available" : tip.status === "premium" ? "Premium" : "VIP"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300">{tip.time}</span>
                      </div>
                      <div className="text-emerald-400 font-semibold">Odds: {tip.odds}</div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{tip.prediction}</span>
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-400" />
                          <span className="text-yellow-400">{tip.confidence}%</span>
                        </div>
                      </div>

                      {tip.status === "available" ? (
                        <p className="text-slate-300 text-sm">{tip.analysis}</p>
                      ) : (
                        <div className="flex items-center space-x-2 text-slate-400">
                          <Lock className="w-4 h-4" />
                          <span className="text-sm">Unlock for detailed analysis</span>
                        </div>
                      )}
                    </div>

                    <Button
                      className={`w-full ${
                        tip.status === "available"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : tip.status === "premium"
                            ? "bg-purple-600 hover:bg-purple-700"
                            : "bg-yellow-600 hover:bg-yellow-700"
                      } text-white`}
                    >
                      {tip.status === "available" ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Free Access
                        </>
                      ) : (
                        <>
                          <Crown className="w-4 h-4 mr-2" />
                          Buy for KES {tip.price}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="packages" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.map((pkg, index) => (
                <Card
                  key={index}
                  className={`bg-slate-800/50 border-slate-700 relative ${
                    pkg.popular ? "ring-2 ring-emerald-500" : ""
                  }`}
                >
                  {pkg.popular && (
                    <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white">
                      MOST POPULAR
                    </Badge>
                  )}
                  <CardHeader className="text-center">
                    <CardTitle className="text-white text-xl">{pkg.name}</CardTitle>
                    <div className="text-3xl font-bold text-emerald-400">{pkg.price}</div>
                    <p className="text-slate-400">{pkg.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {pkg.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center space-x-2 text-slate-300">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full ${
                        pkg.popular ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-700 hover:bg-slate-600"
                      } text-white`}
                    >
                      Purchase Package
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Purchase History</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">No purchases yet</p>
                  <p className="text-slate-500">Your purchase history will appear here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
