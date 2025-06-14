"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import {
  Menu,
  TrendingUp,
  Users,
  Crown,
  HelpCircle,
  CreditCard,
  Globe,
  Bell,
  Home,
  Target,
  Radio,
  User,
  Search,
  Settings,
} from "lucide-react"
import { CountrySelector } from "@/components/country-selector"
import { getCountryFromDomain } from "@/lib/country-pricing"
import Link from "next/link"

export function ResponsiveNavigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState("kenya")
  const [activeTab, setActiveTab] = useState("home")
  const [notifications] = useState(3)

  // Mobile bottom navigation tabs
  const mainTabs = [
    { id: "home", label: "Home", icon: Home, href: "/" },
    { id: "tips", label: "Tips", icon: Target, href: "/daily-tips" },
    { id: "live", label: "Live", icon: Radio, href: "/live-predictions" },
    { id: "vip", label: "VIP", icon: Crown, href: "/weekly-specials" },
    { id: "profile", label: "Profile", icon: User, href: "/dashboard" },
  ]

  useState(() => {
    if (typeof window !== "undefined") {
      const detectedCountry = getCountryFromDomain(window.location.hostname)
      setSelectedCountry(detectedCountry)
    }
  })

  return (
    <>
      {/* Desktop/Tablet Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-slate-900" />
              </div>
              <span className="text-xl font-bold text-white">AI Tipster</span>
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 text-xs hidden sm:inline-flex">
                Global
              </Badge>
            </div>

            {/* Desktop Navigation - Hidden on mobile */}
            <div className="hidden md:block">
              <NavigationMenu>
                <NavigationMenuList className="space-x-1">
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="text-slate-300 hover:text-white">
                      Predictions
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-64 p-4 space-y-2">
                        <NavigationMenuLink href="/daily-tips" className="block p-2 hover:bg-slate-800 rounded">
                          Daily Tips
                        </NavigationMenuLink>
                        <NavigationMenuLink href="/weekly-specials" className="block p-2 hover:bg-slate-800 rounded">
                          Weekly Specials
                        </NavigationMenuLink>
                        <NavigationMenuLink href="/live-predictions" className="block p-2 hover:bg-slate-800 rounded">
                          Live Predictions
                        </NavigationMenuLink>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <NavigationMenuLink
                      href="/weekly-specials"
                      className="text-slate-300 hover:text-white px-3 py-2 rounded-md"
                    >
                      <Crown className="w-4 h-4 inline mr-1" />
                      VIP Zone
                    </NavigationMenuLink>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <NavigationMenuLink className="text-slate-300 hover:text-white px-3 py-2 rounded-md">
                      <Users className="w-4 h-4 inline mr-1" />
                      Community
                    </NavigationMenuLink>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="text-slate-300 hover:text-white">More</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-48 p-4 space-y-2">
                        <NavigationMenuLink className="block p-2 hover:bg-slate-800 rounded">
                          <HelpCircle className="w-4 h-4 inline mr-2" />
                          FAQ
                        </NavigationMenuLink>
                        <NavigationMenuLink className="block p-2 hover:bg-slate-800 rounded">
                          <CreditCard className="w-4 h-4 inline mr-2" />
                          Pricing
                        </NavigationMenuLink>
                        <NavigationMenuLink className="block p-2 hover:bg-slate-800 rounded">
                          <Globe className="w-4 h-4 inline mr-2" />
                          Languages
                        </NavigationMenuLink>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-2 md:space-x-4">
              {/* Country Selector - Hidden on mobile */}
              <div className="hidden lg:block">
                <CountrySelector
                  selectedCountry={selectedCountry}
                  onCountryChange={setSelectedCountry}
                  showCard={false}
                />
              </div>

              {/* Notifications - Mobile optimized */}
              <Button variant="ghost" size="sm" className="relative p-2">
                <Bell className="w-5 h-5 text-slate-300" />
                {notifications > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-medium">{notifications}</span>
                  </div>
                )}
              </Button>

              {/* Desktop Auth Buttons */}
              <div className="hidden md:flex items-center space-x-2">
                <Button variant="ghost" className="text-slate-300 hover:text-white">
                  <Link href="/signin">Login</Link>
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>

              {/* Mobile Menu Button */}
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden p-2">
                    <Menu className="w-5 h-5 text-slate-300" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 bg-slate-900 border-slate-800">
                  <div className="py-6">
                    <div className="space-y-4">
                      {/* Mobile Country Selector */}
                      <div className="px-3">
                        <CountrySelector
                          selectedCountry={selectedCountry}
                          onCountryChange={setSelectedCountry}
                          showCard={false}
                        />
                      </div>

                      {/* Mobile Navigation Links */}
                      <div className="px-3">
                        <h3 className="text-white font-semibold mb-3">Navigation</h3>
                        <div className="space-y-2">
                          <Link href="/daily-tips" className="block px-3 py-2 text-slate-300 hover:text-white rounded">
                            Predictions
                          </Link>
                          <Link
                            href="/weekly-specials"
                            className="block px-3 py-2 text-slate-300 hover:text-white rounded"
                          >
                            VIP Zone
                          </Link>
                          <Link
                            href="/live-predictions"
                            className="block px-3 py-2 text-slate-300 hover:text-white rounded"
                          >
                            Community
                          </Link>
                          <Link href="#" className="block px-3 py-2 text-slate-300 hover:text-white rounded">
                            FAQ
                          </Link>
                        </div>
                      </div>

                      {/* Mobile Quick Actions */}
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

                      {/* Mobile Auth Buttons */}
                      <div className="px-3 pt-4 space-y-2">
                        <Button variant="ghost" className="w-full text-slate-300 hover:text-white">
                          <Link href="/signin">Login</Link>
                        </Button>
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Link href="/signup">Sign Up</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation - Only visible on mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 md:hidden">
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
