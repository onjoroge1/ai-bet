"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, CheckCircle, AlertCircle, Gift, TrendingUp, Settings } from "lucide-react"

interface Notification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
}

export function NotificationsWidget() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate fetching notifications
    const fetchNotifications = async () => {
      const mockNotifications: Notification[] = [
        {
          id: "1",
          title: "Prediction Won! 🎉",
          message: "Your Arsenal vs Chelsea tip won! +KES 850 added to wallet",
          type: "tip",
          isRead: false,
          createdAt: "2024-01-15T11:30:00Z",
        },
        {
          id: "2",
          title: "Weekend Special Available",
          message: "New weekend accumulator with 87% confidence now available",
          type: "promotion",
          isRead: false,
          createdAt: "2024-01-15T09:00:00Z",
        },
        {
          id: "3",
          title: "Payment Confirmed",
          message: "M-Pesa deposit of KES 1,000 has been processed successfully",
          type: "payment",
          isRead: true,
          createdAt: "2024-01-15T08:45:00Z",
        },
        {
          id: "4",
          title: "Achievement Unlocked!",
          message: "You've earned the '5-Win Streak' badge! Bonus KES 200 added",
          type: "system",
          isRead: true,
          createdAt: "2024-01-14T16:20:00Z",
        },
        {
          id: "5",
          title: "VIP Membership Expiring",
          message: "Your VIP membership expires in 3 days. Renew now for 20% off!",
          type: "system",
          isRead: false,
          createdAt: "2024-01-14T10:00:00Z",
        },
      ]

      setNotifications(mockNotifications)
      setLoading(false)
    }

    fetchNotifications()
  }, [])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "tip":
        return <TrendingUp className="w-4 h-4 text-emerald-400" />
      case "payment":
        return <CheckCircle className="w-4 h-4 text-blue-400" />
      case "promotion":
        return <Gift className="w-4 h-4 text-purple-400" />
      case "system":
        return <AlertCircle className="w-4 h-4 text-yellow-400" />
      default:
        return <Bell className="w-4 h-4 text-slate-400" />
    }
  }

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((notif) => (notif.id === id ? { ...notif, isRead: true } : notif)))
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/2"></div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-700 rounded"></div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Bell className="w-5 h-5 text-emerald-400" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && <Badge className="bg-red-500 text-white">{unreadCount}</Badge>}
        </div>
        <Button variant="ghost" size="sm" className="text-slate-400">
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              notification.isRead
                ? "bg-slate-700/30 border-slate-600"
                : "bg-slate-700/50 border-emerald-500/30 hover:border-emerald-500/50"
            }`}
            onClick={() => markAsRead(notification.id)}
          >
            <div className="flex items-start space-x-3">
              {getNotificationIcon(notification.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className={`text-sm font-medium ${notification.isRead ? "text-slate-300" : "text-white"}`}>
                    {notification.title}
                  </h4>
                  {!notification.isRead && <div className="w-2 h-2 bg-emerald-400 rounded-full" />}
                </div>
                <p className={`text-xs ${notification.isRead ? "text-slate-400" : "text-slate-300"}`}>
                  {notification.message}
                </p>
                <div className="text-xs text-slate-500 mt-1">{new Date(notification.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Button variant="outline" size="sm" className="w-full border-slate-600 text-slate-300">
          View All Notifications
        </Button>
      </div>
    </Card>
  )
}
