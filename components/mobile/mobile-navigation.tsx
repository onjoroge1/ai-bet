"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Home, Target, Crown, Radio, User, Menu, Bell, Search, TrendingUp, Settings } from "lucide-react"
import Link from "next/link"

export function MobileNavigation() {
  const [activeTab, setActiveTab] = useState("home")
  const [notifications] = useState(3)

  const mainTabs = [
    { id: "home", label: "Home", icon: Home, href: "/" },
    { id: "tips", label: "Tips", icon: Target, href: "/daily-tips" },
    { id: "live", label: "Live", icon: Radio, href: "/live-predictions" },
    { id: "vip", label: "VIP", icon: Crown, href: "/weekly-specials" },
    { id: "profile", label: "Profile", icon: User, href: "/dashboard" },
  ]

  return (
    <>
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-slate-900" />
            </div>
            <span className="text-lg font-bold text-white">SnapBet</span>
          </div>

          {/* Header Actions */}
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="relative p-2">
              <Bell className="w-5 h-5 text-slate-300" />
              {notifications > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-medium">{notifications}</span>
                </div>
              )}
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <Menu className="w-5 h-5 text-slate-300" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 bg-slate-900 border-slate-800">
                <div className="py-6">
                  <div className="space-y-4">
                    <div className="px-3">
                      <h3 className="text-white font-semibold mb-3">Quick Actions</h3>
                      <div className="space-y-2">
                        <Button className="w-full justify-start bg-emerald-600 hover:bg-emerald-700">
                          <Crown className="w-4 h-4 mr-2" />
                          Upgrade to VIP
                        </Button>
                        <Button variant="outline" className="w-full justify-start border-slate-600">
                          <Search className="w-4 h-4 mr-2" />
                          Search Matches
                        </Button>
                        <Button variant="outline" className="w-full justify-start border-slate-600">
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800">
        <div className="grid grid-cols-5 h-16">
          {mainTabs.map((tab) => (
            <Link key={tab.id} href={tab.href}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center h-full space-y-1 transition-colors ${
                  activeTab === tab.id ? "text-emerald-400" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{tab.label}</span>
                {tab.id === "live" && (
                  <div className="absolute top-2 right-1/2 translate-x-1/2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
