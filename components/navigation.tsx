"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Menu, X, TrendingUp, User, LogOut, MapPin, BookOpen, Target, Crown, Radio, HelpCircle, BarChart3 } from "lucide-react"
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

  // Navigation links based on actual pages that exist
  const navLinks = [
    { href: "/dashboard/predictions", text: "Matches", icon: Target },
    { href: "/blog", text: "Blog", icon: BookOpen },
    { href: "/tips-history", text: "Predictions History", icon: Target },
    { href: "/dashboard/support", text: "Support", icon: HelpCircle },
  ]

  // Additional links for authenticated users (removed Dashboard since it's in auth section)
  const authenticatedNavLinks = [
    // Tips History moved to public navLinks since it's now a public page
  ]

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-slate-900" />
            </div>
            <span className="text-xl font-bold text-white">SnapBet</span>
            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 text-xs">
              Global
            </Badge>
          </div>

          {/* Desktop Navigation - Based on actual pages */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center space-x-1 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              >
                <link.icon className="w-4 h-4" />
                <span>{link.text}</span>
              </Link>
            ))}
            
            {/* Show additional links for authenticated users */}
            {isAuthenticated && authenticatedNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center space-x-1 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              >
                <link.icon className="w-4 h-4" />
                <span>{link.text}</span>
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* User Country Display */}
            {!isLoading && countryData && (
              <div className="hidden lg:flex items-center space-x-2 text-slate-300">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{countryData.flag} {countryData.name}</span>
                <Badge variant="secondary" className="bg-slate-700/50 text-slate-300 text-xs">
                  {countryData.currencySymbol}
                </Badge>
              </div>
            )}

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center space-x-2">
              {isAuthenticated ? (
                <>
                  <Button variant="ghost" className="text-slate-300 hover:text-white">
                    <Link href="/dashboard" className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      {user?.name || "Dashboard"}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" className="text-slate-300 hover:text-white">
                    <Link href="/signin">Login</Link>
                  </Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Link href="/signup">Sign Up</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button variant="ghost" size="sm" className="md:hidden text-slate-300" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu - Based on actual pages */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            <div className="space-y-2">
              {/* Mobile User Country Display */}
              {!isLoading && countryData && (
                <div className="px-3 py-2 flex items-center space-x-2 text-slate-300">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{countryData.flag} {countryData.name}</span>
                  <Badge variant="secondary" className="bg-slate-700/50 text-slate-300 text-xs">
                    {countryData.currencySymbol}
                  </Badge>
                </div>
              )}

              {/* Mobile Navigation Links */}
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center space-x-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
                  onClick={() => setIsOpen(false)}
                >
                  <link.icon className="w-4 h-4" />
                  <span>{link.text}</span>
                </Link>
              ))}

              {/* Show additional links for authenticated users on mobile */}
              {isAuthenticated && authenticatedNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center space-x-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
                  onClick={() => setIsOpen(false)}
                >
                  <link.icon className="w-4 h-4" />
                  <span>{link.text}</span>
                </Link>
              ))}

              {/* Mobile Auth Buttons */}
              <div className="pt-4 border-t border-slate-800">
                {isAuthenticated ? (
                  <>
                    <Button variant="ghost" className="w-full text-slate-300 hover:text-white">
                      <Link href="/dashboard" className="flex items-center justify-center w-full">
                        <User className="w-4 h-4 mr-2" />
                        Dashboard
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                      onClick={handleSignOut}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="w-full text-slate-300 hover:text-white">
                      <Link href="/signin">Login</Link>
                    </Button>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Link href="/signup">Sign Up</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
