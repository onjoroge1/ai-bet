"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Bell, Zap, Target, TrendingUp, AlertTriangle, Crown } from "lucide-react"

export function SmartNotifications() {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "high_value",
      title: "🔥 High Value Alert",
      message: "Arsenal vs Chelsea - Over 2.5 Goals at 1.85 (Expected: 1.65)",
      confidence: 92,
      timeLeft: "45 minutes",
      isEnabled: true,
    },
    {
      id: 2,
      type: "live_opportunity",
      title: "⚡ Live Opportunity",
      message: "Barcelona leading 1-0, BTTS odds increased to 2.10",
      confidence: 87,
      timeLeft: "Live now",
      isEnabled: true,
    },
    {
      id: 3,
      type: "streak_alert",
      title: "🎯 Streak Alert",
      message: "You're on a 5-win streak! Consider our premium accumulator",
      confidence: null,
      timeLeft: null,
      isEnabled: false,
    },
  ])

  const notificationSettings = [
    { key: "high_value", label: "High Value Bets", icon: TrendingUp, enabled: true },
    { key: "live_opportunities", label: "Live Opportunities", icon: Zap, enabled: true },
    { key: "streak_alerts", label: "Streak Alerts", icon: Target, enabled: false },
    { key: "vip_exclusive", label: "VIP Exclusive", icon: Crown, enabled: true },
    { key: "risk_warnings", label: "Risk Warnings", icon: AlertTriangle, enabled: true },
  ]

  return (
    <div className="space-y-6">
      {/* Notification Settings */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-semibold flex items-center">
            <Bell className="w-5 h-5 mr-2 text-emerald-400" />
            Smart Notifications
          </h3>
          <Button variant="ghost" size="sm" className="text-slate-400">
            Configure
          </Button>
        </div>

        <div className="space-y-4">
          {notificationSettings.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                  <setting.icon className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-white">{setting.label}</span>
              </div>
              <Switch checked={setting.enabled} />
            </div>
          ))}
        </div>
      </Card>

      {/* Active Notifications */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <h3 className="text-white font-semibold mb-4">Active Alerts</h3>
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div key={notification.id} className="bg-slate-900/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="text-white font-medium text-sm mb-1">{notification.title}</div>
                  <div className="text-slate-300 text-sm">{notification.message}</div>
                </div>
                {notification.confidence && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 ml-3">{notification.confidence}%</Badge>
                )}
              </div>

              <div className="flex items-center justify-between mt-3">
                {notification.timeLeft && <div className="text-slate-400 text-xs">{notification.timeLeft}</div>}
                <div className="flex space-x-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    View Tip
                  </Button>
                  <Button variant="ghost" size="sm" className="text-slate-400">
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
