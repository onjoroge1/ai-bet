"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Crown, CreditCard, MessageCircle, Download, Settings, HelpCircle, Sparkles } from "lucide-react"
import Link from "next/link"

export function QuickActions() {
  const [hoveredAction, setHoveredAction] = useState<number | null>(null)

  const actions = [
    {
      title: "Upgrade to Pro",
      description: "Get access to all leagues",
      icon: Crown,
      color: "bg-gradient-to-r from-yellow-500 to-orange-500",
      textColor: "text-white",
      emoji: "👑",
      hoverEffect: "hover:from-yellow-400 hover:to-orange-400",
      href: "/weekly-specials",
    },
    {
      title: "Add Funds",
      description: "Top up via M-Pesa",
      icon: CreditCard,
      color: "bg-emerald-600",
      textColor: "text-white",
      emoji: "💳",
      hoverEffect: "hover:bg-emerald-500",
      href: "#",
    },
    {
      title: "Join Telegram",
      description: "Get instant alerts",
      icon: MessageCircle,
      color: "bg-blue-600",
      textColor: "text-white",
      emoji: "📱",
      hoverEffect: "hover:bg-blue-500",
      href: "#",
    },
    {
      title: "Download App",
      description: "Mobile predictions",
      icon: Download,
      color: "bg-purple-600",
      textColor: "text-white",
      emoji: "📲",
      hoverEffect: "hover:bg-purple-500",
      href: "#",
    },
    {
      title: "Account Settings",
      description: "Manage your profile",
      icon: Settings,
      color: "bg-slate-700",
      textColor: "text-white",
      emoji: "⚙️",
      hoverEffect: "hover:bg-slate-600",
      href: "#",
    },
    {
      title: "Help & Support",
      description: "Get assistance",
      icon: HelpCircle,
      color: "bg-indigo-600",
      textColor: "text-white",
      emoji: "🆘",
      hoverEffect: "hover:bg-indigo-500",
      href: "#",
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

        <div className="space-y-3">
          {actions.map((action, index) => (
            <Link href={action.href || "#"} key={index}>
              <Button
                variant="ghost"
                className={`w-full justify-start p-4 h-auto ${action.color} ${action.hoverEffect} transition-all duration-300 hover:scale-105 hover:shadow-lg relative overflow-hidden group`}
                onMouseEnter={() => setHoveredAction(index)}
                onMouseLeave={() => setHoveredAction(null)}
              >
                {/* Animated background effect */}
                {hoveredAction === index && <div className="absolute inset-0 bg-white/10 animate-pulse" />}

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
            </Link>
          ))}
        </div>

        {/* Fun motivational message */}
        <div className="mt-6 p-3 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-lg border border-emerald-500/30">
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
