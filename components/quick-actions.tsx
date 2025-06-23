"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Crown, CreditCard, MessageCircle, Sparkles, Zap, Gift, Target, Star, TrendingUp, Clock, Users } from "lucide-react"
import { useUserCountry } from "@/contexts/user-country-context"
import Link from "next/link"

export function QuickActions() {
  const [hoveredAction, setHoveredAction] = useState<number | null>(null)
  const { convertPrice } = useUserCountry()

  const actions = [
    {
      title: "Buy Daily Tips",
      description: `${convertPrice(150)} - Instant access`,
      icon: Zap,
      color: "bg-gradient-to-r from-emerald-500 to-cyan-500",
      textColor: "text-white",
      emoji: "⚡",
      hoverEffect: "hover:from-emerald-400 hover:to-cyan-400",
      href: "/dashboard/daily-tips",
      isNew: true,
    },
    {
      title: "Weekend Special",
      description: `${convertPrice(350)} - 3 premium picks`,
      icon: Gift,
      color: "bg-gradient-to-r from-purple-500 to-pink-500",
      textColor: "text-white",
      emoji: "🎁",
      hoverEffect: "hover:from-purple-400 hover:to-pink-400",
      href: "/dashboard/weekend-special",
      isHot: true,
    },
    {
      title: "Upgrade to VIP",
      description: "Unlimited access",
      icon: Crown,
      color: "bg-gradient-to-r from-yellow-500 to-orange-500",
      textColor: "text-white",
      emoji: "👑",
      hoverEffect: "hover:from-yellow-400 hover:to-orange-400",
      href: "/dashboard/vip",
    },
    {
      title: "Add Funds",
      description: "Top up via mobile money",
      icon: CreditCard,
      color: "bg-emerald-600",
      textColor: "text-white",
      emoji: "💳",
      hoverEffect: "hover:bg-emerald-500",
      href: "/dashboard/settings?tab=billing",
    },
    {
      title: "Join Telegram",
      description: "Get instant alerts",
      icon: MessageCircle,
      color: "bg-blue-600",
      textColor: "text-white",
      emoji: "📱",
      hoverEffect: "hover:bg-blue-500",
      href: "https://t.me/aisportstipster",
      external: true,
    },
  ]

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6 relative overflow-hidden">
      {/* Animated background sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <Sparkles
            key={i}
            className="absolute w-3 h-3 text-cyan-400/20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
          <span>Quick Actions</span>
          <span className="animate-bounce">⚡</span>
        </h2>

        <div className="space-y-4">
          {actions.map((action, index) => {
            const ActionComponent = action.external ? "a" : Link
            const actionProps = action.external
              ? { href: action.href, target: "_blank", rel: "noopener noreferrer" }
              : { href: action.href }

            return (
              <ActionComponent key={index} {...actionProps} className="block mb-4">
                <Button
                  variant="ghost"
                  className={`w-full justify-start p-4 h-auto ${action.color} ${action.hoverEffect} transition-all duration-300 hover:scale-105 hover:shadow-lg relative overflow-hidden group`}
                  onMouseEnter={() => setHoveredAction(index)}
                  onMouseLeave={() => setHoveredAction(null)}
                >
                  {/* Animated background effect */}
                  {hoveredAction === index && <div className="absolute inset-0 bg-white/10 animate-pulse" />}

                  {/* New/Hot badges */}
                  {action.isNew && (
                    <Badge className="absolute top-1 right-1 bg-green-500 text-white text-xs animate-pulse">NEW</Badge>
                  )}
                  {action.isHot && (
                    <Badge className="absolute top-1 right-1 bg-red-500 text-white text-xs animate-pulse">HOT</Badge>
                  )}

                  <div className="relative flex items-center w-full">
                    <div className="flex items-center space-x-3">
                      <span
                        className="text-2xl animate-bounce"
                        style={{ animationDuration: "2s", animationDelay: `${index * 0.1}s` }}
                      >
                        {action.emoji}
                      </span>
                      <action.icon className={`w-5 h-5 ${action.textColor} group-hover:animate-pulse`} />
                    </div>
                    <div className="text-left ml-3 flex-1">
                      <div className={`font-medium ${action.textColor} group-hover:animate-pulse`}>{action.title}</div>
                      <div className={`text-sm opacity-80 ${action.textColor}`}>{action.description}</div>
                    </div>
                    {hoveredAction === index && (
                      <div className="ml-auto">
                        <span className="text-lg animate-bounce">✨</span>
                      </div>
                    )}
                  </div>
                </Button>
              </ActionComponent>
            )
          })}
        </div>

        {/* Fun motivational message */}
        <div className="mt-8 p-3 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-lg border border-emerald-500/30">
          <div className="flex items-center space-x-2">
            <span className="text-lg animate-bounce">🚀</span>
            <span className="text-emerald-400 text-sm font-medium">
              You're doing great! Keep up the winning streak!
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
