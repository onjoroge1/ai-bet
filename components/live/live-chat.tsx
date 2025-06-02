"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Send, Users } from "lucide-react"

export function LiveChat() {
  const [message, setMessage] = useState("")

  const messages = [
    {
      user: "James K.",
      country: "🇰🇪",
      message: "Arsenal looking strong! Going with the AI tip",
      time: "2m ago",
      isVip: true,
    },
    {
      user: "Priya S.",
      country: "🇮🇳",
      message: "Barcelona vs Madrid is going to be epic!",
      time: "3m ago",
      isVip: false,
    },
    {
      user: "Miguel R.",
      country: "🇵🇭",
      message: "AI predictions have been spot on today 🔥",
      time: "5m ago",
      isVip: true,
    },
    {
      user: "Sarah L.",
      country: "🇬🇧",
      message: "Anyone else backing the City vs Liverpool BTTS?",
      time: "7m ago",
      isVip: false,
    },
  ]

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-emerald-400" />
          <span>Live Chat</span>
        </h3>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          <Users className="w-3 h-3 mr-1" />
          247 online
        </Badge>
      </div>

      <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
        {messages.map((msg, index) => (
          <div key={index} className="bg-slate-900/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-white font-medium text-sm">{msg.user}</span>
              <span className="text-lg">{msg.country}</span>
              {msg.isVip && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">VIP</Badge>
              )}
              <span className="text-slate-400 text-xs ml-auto">{msg.time}</span>
            </div>
            <div className="text-slate-300 text-sm">{msg.message}</div>
          </div>
        ))}
      </div>

      <div className="flex space-x-2">
        <Input
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
        />
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <div className="mt-3 text-center">
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs">
          Join Telegram for more chat
        </Button>
      </div>
    </Card>
  )
}
