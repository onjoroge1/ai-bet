"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, BarChart3, Target, Download, MessageCircle, Settings, Sparkles, TrendingUp, Users, BookOpen } from "lucide-react"
import Link from "next/link"

export function AIToolsResources() {
  const [hoveredAction, setHoveredAction] = useState<number | null>(null)

  const tools = [
    {
      title: "Match Analysis",
      description: "Deep dive into upcoming matches",
      icon: Brain,
      color: "bg-gradient-to-r from-emerald-500 to-cyan-500",
      textColor: "text-white",
      emoji: "🧠",
      hoverEffect: "hover:from-emerald-400 hover:to-cyan-400",
      href: "/dashboard/match-analysis",
      isNew: true,
    },
    {
      title: "Performance Tracker",
      description: "Track AI prediction accuracy",
      icon: BarChart3,
      color: "bg-gradient-to-r from-blue-500 to-indigo-500",
      textColor: "text-white",
      emoji: "📊",
      hoverEffect: "hover:from-blue-400 hover:to-indigo-400",
      href: "/dashboard/performance",
      isHot: true,
    },
    {
      title: "Confidence Insights",
      description: "Understand AI confidence levels",
      icon: Target,
      color: "bg-gradient-to-r from-purple-500 to-pink-500",
      textColor: "text-white",
      emoji: "🎯",
      hoverEffect: "hover:from-purple-400 hover:to-pink-400",
      href: "/dashboard/confidence-insights",
    },
    {
      title: "Mobile App",
      description: "Download our prediction app",
      icon: Download,
      color: "bg-gradient-to-r from-orange-500 to-red-500",
      textColor: "text-white",
      emoji: "📱",
      hoverEffect: "hover:from-orange-400 hover:to-red-400",
      href: "#",
      external: true,
    },
    {
      title: "Community",
      description: "Join prediction discussions",
      icon: Users,
      color: "bg-gradient-to-r from-green-500 to-teal-500",
      textColor: "text-white",
      emoji: "💬",
      hoverEffect: "hover:from-green-400 hover:to-teal-400",
      href: "/dashboard/community",
    },
    {
      title: "Settings",
      description: "Manage your preferences",
      icon: Settings,
      color: "bg-slate-700",
      textColor: "text-white",
      emoji: "⚙️",
      hoverEffect: "hover:bg-slate-600",
      href: "/dashboard/settings",
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
          <Brain className="w-5 h-5 text-emerald-400" />
          <span>AI Tools & Resources</span>
          <span className="animate-bounce">⚡</span>
        </h2>

        <div className="space-y-3">
          {tools.map((tool, index) => {
            const ToolComponent = tool.external ? "a" : Link
            const toolProps = tool.external
              ? { href: tool.href, target: "_blank", rel: "noopener noreferrer" }
              : { href: tool.href }

            return (
              <ToolComponent key={index} {...toolProps} className="block">
                <Button
                  variant="ghost"
                  className={`w-full justify-start p-4 h-auto ${tool.color} ${tool.hoverEffect} transition-all duration-300 hover:scale-105 hover:shadow-lg relative overflow-hidden group`}
                  onMouseEnter={() => setHoveredAction(index)}
                  onMouseLeave={() => setHoveredAction(null)}
                >
                  {/* Animated background effect */}
                  {hoveredAction === index && <div className="absolute inset-0 bg-white/10 animate-pulse" />}

                  {/* New/Hot badges */}
                  {tool.isNew && (
                    <Badge className="absolute top-1 right-1 bg-green-500 text-white text-xs animate-pulse">NEW</Badge>
                  )}
                  {tool.isHot && (
                    <Badge className="absolute top-1 right-1 bg-red-500 text-white text-xs animate-pulse">HOT</Badge>
                  )}

                  <div className="flex items-center space-x-3">
                    <span
                      className="text-2xl animate-bounce"
                      style={{ animationDuration: "2s", animationDelay: `${index * 0.1}s` }}
                    >
                      {tool.emoji}
                    </span>
                    <tool.icon className={`w-5 h-5 ${tool.textColor} group-hover:animate-pulse`} />
                  </div>
                  <div className="text-left ml-3 flex-1">
                    <div className={`font-medium ${tool.textColor} group-hover:animate-pulse`}>{tool.title}</div>
                    <div className={`text-sm opacity-80 ${tool.textColor}`}>{tool.description}</div>
                  </div>
                  {hoveredAction === index && (
                    <div className="ml-auto">
                      <span className="text-lg animate-bounce">✨</span>
                    </div>
                  )}
                </Button>
              </ToolComponent>
            )
          })}
        </div>

        {/* AI-powered motivation */}
        <div className="mt-6 p-3 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-lg border border-emerald-500/30">
          <div className="flex items-center space-x-2">
            <span className="text-lg animate-bounce">🚀</span>
            <span className="text-emerald-400 text-sm font-medium">
              Explore our AI-powered tools to enhance your prediction insights!
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
} 