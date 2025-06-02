"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { Menu, X, TrendingUp, Users, Crown, HelpCircle, CreditCard, Globe, Moon, Sun } from "lucide-react"
import { CountrySelector } from "@/components/country-selector"
import { getCountryFromDomain } from "@/lib/country-pricing"
import Link from "next/link"

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [selectedCountry, setSelectedCountry] = useState("kenya")

  useState(() => {
    if (typeof window !== "undefined") {
      const detectedCountry = getCountryFromDomain(window.location.hostname)
      setSelectedCountry(detectedCountry)
    }
  })

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-slate-900" />
            </div>
            <span className="text-xl font-bold text-white">AI Tipster</span>
            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 text-xs">
              Global
            </Badge>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <NavigationMenu>
              <NavigationMenuList className="space-x-1">
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="text-slate-300 hover:text-white">Predictions</NavigationMenuTrigger>
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
          <div className="flex items-center space-x-4">
            {/* Country Selector */}
            <div className="hidden lg:block">
              <CountrySelector
                selectedCountry={selectedCountry}
                onCountryChange={setSelectedCountry}
                showCard={false}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDark(!isDark)}
              className="text-slate-300 hover:text-white"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <div className="hidden md:flex items-center space-x-2">
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                <Link href="/signin">Login</Link>
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <Button variant="ghost" size="sm" className="md:hidden text-slate-300" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            <div className="space-y-2">
              {/* Mobile Country Selector */}
              <div className="px-3 py-2">
                <CountrySelector
                  selectedCountry={selectedCountry}
                  onCountryChange={setSelectedCountry}
                  showCard={false}
                />
              </div>

              <a href="/daily-tips" className="block px-3 py-2 text-slate-300 hover:text-white">
                Predictions
              </a>
              <a href="/weekly-specials" className="block px-3 py-2 text-slate-300 hover:text-white">
                VIP Zone
              </a>
              <a href="/live-predictions" className="block px-3 py-2 text-slate-300 hover:text-white">
                Community
              </a>
              <a href="#" className="block px-3 py-2 text-slate-300 hover:text-white">
                FAQ
              </a>
              <a href="#" className="block px-3 py-2 text-slate-300 hover:text-white">
                Pricing
              </a>
              <div className="pt-4 space-y-2">
                <Button variant="ghost" className="w-full text-slate-300 hover:text-white">
                  <Link href="/signin">Login</Link>
                </Button>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
