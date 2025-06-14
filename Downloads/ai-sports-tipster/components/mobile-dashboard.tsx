"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  Target,
  Trophy,
  Calendar,
  Crown,
  CreditCard,
  MessageCircle,
  Settings,
  ChevronRight,
  Zap,
  FlameIcon as Fire,
} from "lucide-react"

export function MobileDashboard() {
  const [streak] = useState(5)

  const stats = [
    { title: "Win Rate", value: "87%", icon: Target, color: "emerald" },
    { title: "Total Bets", value: "156", icon: Calendar, color: "blue" },
    { title: "Profit", value: "KES 45K", icon: TrendingUp, color: "emerald" },
    { title: "Streak", value: `${streak} wins`, icon: Trophy, color: "yellow" },
  ]

  const quickActions = [
    {
      title: "Upgrade to VIP",
      description: "Get unlimited predictions",
      icon: Crown,
      color: "bg-gradient-to-r from-yellow-500 to-orange-500",
      href: "/weekly-specials",
    },
    {
      title: "Add Funds",
      description: "Top up via M-Pesa",
      icon: CreditCard,
      color: "bg-emerald-600",
      href: "#",
    },
    {
      title: "Join Community",
      description: "Connect with other bettors",
      icon: MessageCircle,
      color: "bg-blue-600",
      href: "#",
    },
    {
      title: "Settings",
      description: "Manage your account",
      icon: Settings,
      color: "bg-slate-700",
      href: "#",
    },
  ]

  const recentPredictions = [
    {
      match: "Arsenal vs Chelsea",
      prediction: "Over 2.5 Goals",
      status: "won",
      profit: "+KES 3,500",
      time: "2h ago",
    },
    {
      match: "Man City vs Liverpool",
      prediction: "BTTS",
      status: "pending",
      profit: "KES 2,000",
      time: "Live",
    },
    {
      match: "Barcelona vs Madrid",
      prediction: "Barcelona Win",
      status: "lost",
      profit: "-KES 1,500",
      time: "Yesterday",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 md:hidden">
      <div className="px-4 pb-20 pt-4">
        {/* Welcome Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <h1 className="text-2xl font-bold text-white">Welcome back!</h1>
            {streak >= 5 && <Fire className="w-6 h-6 text-orange-400 animate-pulse" />}
          </div>
          <p className="text-slate-300 text-sm">Here's your betting performance</p>
          {streak >= 3 && (
            <div className="flex items-center mt-2">
              <Target className="w-4 h-4 text-emerald-400 mr-1" />
              <span className="text-emerald-400 text-sm font-medium">🔥 {streak} win streak! You're on fire!</span>
            </div>
          )}
        </div>

        {/* Account Overview */}
        <Card className="bg-slate-800/50 border-slate-700 p-4 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center">
              <span className="text-slate-900 font-bold">JK</span>
            </div>
            <div>
              <h3 className="text-white font-semibold">James Kiprotich</h3>
              <p className="text-slate-400 text-sm">VIP Member</p>
            </div>
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ml-auto">
              <Crown className="w-3 h-3 mr-1" />
              VIP
            </Badge>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400 mb-1">KES 127,500</div>
            <div className="text-slate-400 text-sm">Total Winnings</div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((stat, index) => (
            <Card key={index} className="bg-slate-800/50 border-slate-700 p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    stat.color === "emerald"
                      ? "bg-emerald-500/20"
                      : stat.color === "blue"
                        ? "bg-blue-500/20"
                        : stat.color === "yellow"
                          ? "bg-yellow-500/20"
                          : "bg-slate-500/20"
                  }`}
                >
                  <stat.icon
                    className={`w-4 h-4 ${
                      stat.color === "emerald"
                        ? "text-emerald-400"
                        : stat.color === "blue"
                          ? "text-blue-400"
                          : stat.color === "yellow"
                            ? "text-yellow-400"
                            : "text-slate-400"
                    }`}
                  />
                </div>
              </div>
              <div className="text-lg font-bold text-white">{stat.value}</div>
              <div className="text-slate-400 text-xs">{stat.title}</div>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h3 className="text-white font-semibold mb-3 flex items-center">
            <Zap className="w-4 h-4 mr-2 text-emerald-400" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="ghost"
                className={`w-full justify-start p-4 h-auto ${action.color} hover:opacity-90 transition-opacity`}
              >
                <action.icon className="w-5 h-5 mr-3 text-white" />
                <div className="text-left flex-1">
                  <div className="font-medium text-white text-sm">{action.title}</div>
                  <div className="text-white/80 text-xs">{action.description}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-white ml-2" />
              </Button>
            ))}
          </div>
        </div>

        {/* Recent Predictions */}
        <div>
          <h3 className="text-white font-semibold mb-3">Recent Predictions</h3>
          <div className="space-y-3">
            {recentPredictions.map((prediction, index) => (
              <Card key={index} className="bg-slate-800/50 border-slate-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-white font-medium text-sm">{prediction.match}</div>
                    <div className="text-slate-400 text-xs">{prediction.prediction}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-semibold text-sm ${
                        prediction.status === "won"
                          ? "text-emerald-400"
                          : prediction.status === "lost"
                            ? "text-red-400"
                            : "text-yellow-400"
                      }`}
                    >
                      {prediction.profit}
                    </div>
                    <div className="text-slate-400 text-xs">{prediction.time}</div>
                  </div>
                </div>
                <Badge
                  className={`text-xs ${
                    prediction.status === "won"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : prediction.status === "lost"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-yellow-500/20 text-yellow-400"
                  }`}
                >
                  {prediction.status}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
