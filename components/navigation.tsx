"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Menu, X, TrendingUp, User, LogOut, MapPin, BookOpen, Target, Crown, Radio, HelpCircle, BarChart3, Gift } from "lucide-react"
import { useUserCountry } from "@/contexts/user-country-context"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const { countryData, isLoading } = useUserCountry()
  const { user, isAuthenticated, logout } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await logout()
    router.push("/")
  }

  // Core navigation links - simplified and focused
  const navLinks = [
    { href: "/dashboard/matches", text: "Matches", icon: Target },
    { href: "/blog", text: "Blog", icon: BookOpen },
    { href: "/tips-history", text: "History", icon: BarChart3 },
    { href: "/dashboard/support", text: "Support", icon: HelpCircle },
  ]

  // Additional links for authenticated users
  const authenticatedNavLinks = [
    { href: "/referral", text: "Referrals", icon: Gift },
  ]

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Simplified */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-slate-900" />
            </div>
            <span className="text-xl font-bold text-white">SnapBet</span>
          </div>

          {/* Desktop Navigation - Cleaner spacing */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center space-x-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-md transition-all duration-200"
              >
                <link.icon className="w-4 h-4" />
                <span className="font-medium">{link.text}</span>
              </Link>
            ))}
            
            {/* Authenticated user links */}
            {isAuthenticated && authenticatedNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center space-x-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-md transition-all duration-200"
              >
                <link.icon className="w-4 h-4" />
                <span className="font-medium">{link.text}</span>
              </Link>
            ))}
          </div>

          {/* Right Side - Consolidated and Cleaner */}
          <div className="flex items-center space-x-3">
            {/* Country & Currency - Simplified */}
            {!isLoading && countryData && (
              <div className="hidden lg:flex items-center space-x-2 px-3 py-2 bg-slate-800/30 rounded-md">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-300">{countryData.flag}</span>
                <span className="text-sm font-medium text-white">{countryData.currencySymbol}</span>
              </div>
            )}

            {/* Auth Section - Cleaner buttons */}
            <div className="hidden md:flex items-center space-x-2">
              {isAuthenticated ? (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-slate-300 hover:text-white hover:bg-slate-800/50"
                  >
                    <Link href="/dashboard" className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      {user?.name || "Dashboard"}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-slate-300 hover:text-white hover:bg-slate-800/50"
                  >
                    <Link href="/signin">Login</Link>
                  </Button>
                  <Button 
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Link href="/signup">Sign Up</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="md:hidden text-slate-300 hover:bg-slate-800/50" 
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu - Cleaner and more organized */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            <div className="space-y-3">
              {/* Mobile Country Display - Simplified */}
              {!isLoading && countryData && (
                <div className="px-3 py-2 flex items-center justify-center space-x-2 bg-slate-800/30 rounded-md mx-3">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-slate-300">{countryData.flag}</span>
                  <span className="text-sm font-medium text-white">{countryData.currencySymbol}</span>
                </div>
              )}

              {/* Mobile Navigation Links - Better spacing */}
              <div className="px-3 space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center space-x-3 px-3 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-md transition-all duration-200"
                    onClick={() => setIsOpen(false)}
                  >
                    <link.icon className="w-4 h-4" />
                    <span className="font-medium">{link.text}</span>
                  </Link>
                ))}

                {/* Authenticated user links on mobile */}
                {isAuthenticated && authenticatedNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center space-x-3 px-3 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-md transition-all duration-200"
                    onClick={() => setIsOpen(false)}
                  >
                    <link.icon className="w-4 h-4" />
                    <span className="font-medium">{link.text}</span>
                  </Link>
                ))}
              </div>

              {/* Mobile Auth Buttons - Cleaner separation */}
              <div className="pt-3 border-t border-slate-800 mx-3">
                <div className="space-y-2">
                  {isAuthenticated ? (
                    <>
                      <Button 
                        variant="ghost" 
                        className="w-full text-slate-300 hover:text-white hover:bg-slate-800/50"
                      >
                        <Link href="/dashboard" className="flex items-center justify-center w-full">
                          <User className="w-4 h-4 mr-2" />
                          Dashboard
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                        onClick={handleSignOut}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="ghost" 
                        className="w-full text-slate-300 hover:text-white hover:bg-slate-800/50"
                      >
                        <Link href="/signin">Login</Link>
                      </Button>
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Link href="/signup">Sign Up</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
