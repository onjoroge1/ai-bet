"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Menu, X, TrendingUp, User, MapPin, BookOpen, Target, Crown, Radio, HelpCircle, BarChart3, Gift, RefreshCw, Activity } from "lucide-react"
import { useUserCountry } from "@/contexts/user-country-context"
import { useSession } from "next-auth/react"
import { LogoutButton } from "@/components/auth/logout-button"
import { useRouter } from "next/navigation"
import Link from "next/link"

/**
 * Navigation - Server-Side First Authentication
 * 
 * 🔥 NEW ARCHITECTURE: Uses server-side session check for immediate auth state
 * - Checks /api/auth/session directly (no waiting for useSession() sync)
 * - useSession() updates in background for logout detection
 * - Fast and reliable authentication display
 */
export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { countryData, isLoading } = useUserCountry()
  const { data: session, status } = useSession() // Still use for background updates
  const router = useRouter()
  const navRef = useRef<HTMLDivElement>(null)
  
  // ✅ OPTIMIZED: Use useSession() as single source of truth
  // refetchOnMount={true} ensures fresh session check on page load
  // This eliminates timing conflicts and provides consistent auth state
  
  // 🔥 SECURITY: Never show authenticated state on /signin page
  // This prevents the nav bar from showing "logged in" when user visits /signin
  const isOnSignInPage = pathname === '/signin'
  
  // ✅ OPTIMIZED: Single source of truth - useSession() only
  // refetchOnMount ensures session is checked on page load, eliminating delays
  const isAuthenticated = status === 'authenticated' && !!session?.user && !isOnSignInPage
  const displayName = session?.user?.name || session?.user?.email?.split('@')[0] || "Dashboard"

  const handleMobileMenuClose = () => {
    setIsOpen(false)
  }

  const handleCountryRefresh = () => {
    // Clear the country cache and reload the page with force refresh
    localStorage.removeItem('snapbet_user_country')
    localStorage.removeItem('snapbet_country_timestamp')
    
    // Reload the page with force refresh parameter
    const url = new URL(window.location.href)
    url.searchParams.set('refresh_country', 'true')
    window.location.href = url.toString()
  }

  // ✅ FIX: Move useEffect BEFORE early return to prevent React Hooks violation
  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // ✅ FIX: Show loading skeleton while checking auth to prevent flicker
  // This must come AFTER all hooks to maintain hook order
  if (status === 'loading') {
    return (
      <nav ref={navRef} className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo skeleton */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-700 rounded-lg animate-pulse" />
              <div className="h-6 w-24 bg-slate-700 rounded animate-pulse" />
            </div>
            {/* Right side skeleton */}
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex space-x-2">
                <div className="h-8 w-20 bg-slate-700 rounded animate-pulse" />
                <div className="h-8 w-20 bg-slate-700 rounded animate-pulse" />
              </div>
              <div className="h-8 w-24 bg-slate-700 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </nav>
    )
  }

  // Core navigation links - simplified and focused
  const navLinks = [
    { href: isAuthenticated ? "/dashboard/matches" : "/matches", text: "Matches", icon: Target },
    { href: "/blog", text: "Blog", icon: BookOpen },
    { href: "/tips-history", text: "History", icon: BarChart3 },
    { href: "/dashboard/support", text: "Support", icon: HelpCircle },
  ]

  // Additional links for authenticated users
  const authenticatedNavLinks = [
    { href: "/dashboard/clv", text: "CLV Tracker", icon: Activity, badge: "Live" },
    { href: "/referral", text: "Referrals", icon: Gift },
  ]

  // Don't block the entire navbar for country detection
  // Show navbar immediately with fallback country data

  return (
    <nav ref={navRef} className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Simplified with Homepage Link */}
          <Link href="/" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-slate-900" />
            </div>
            <span className="text-xl font-bold text-white">SnapBet</span>
          </Link>

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
                {link.badge && (
                  <Badge className="bg-red-500 text-white text-xs ml-2 animate-pulse">
                    {link.badge}
                  </Badge>
                )}
              </Link>
            ))}
          </div>

          {/* Right Side - Consolidated and Cleaner */}
          <div className="flex items-center space-x-3">
            {/* Country & Currency - Simplified with fallback */}
            {countryData && (
              <div className="hidden lg:flex items-center space-x-2 px-3 py-2 bg-slate-800/30 rounded-md">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-300">{countryData.flag}</span>
                <span className="text-sm font-medium text-white">{countryData.currencySymbol}</span>
                {isLoading && (
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse ml-1" />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCountryRefresh}
                  className="h-6 w-6 p-0 text-slate-400 hover:text-emerald-400"
                  title="Refresh country detection"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
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
                      {session?.user?.name || session?.user?.email?.split('@')[0] || "Dashboard"}
                    </Link>
                  </Button>
                  <LogoutButton 
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                  />
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
              {/* Mobile Country Display - Simplified with fallback */}
              {countryData && (
                <div className="px-3 py-2 flex items-center justify-center space-x-2 bg-slate-800/30 rounded-md mx-3">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-slate-300">{countryData.flag}</span>
                  <span className="text-sm font-medium text-white">{countryData.currencySymbol}</span>
                  {isLoading && (
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse ml-1" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCountryRefresh}
                    className="h-6 w-6 p-0 text-slate-400 hover:text-emerald-400"
                    title="Refresh country detection"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
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
                    className="flex items-center justify-between px-3 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-md transition-all duration-200"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-center space-x-3">
                      <link.icon className="w-4 h-4" />
                      <span className="font-medium">{link.text}</span>
                    </div>
                    {link.badge && (
                      <Badge className="bg-red-500 text-white text-xs animate-pulse">
                        {link.badge}
                      </Badge>
                    )}
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
                        onClick={handleMobileMenuClose}
                      >
                        <Link href="/dashboard" className="flex items-center justify-center w-full">
                          <User className="w-4 h-4 mr-2" />
                          Dashboard
                        </Link>
                      </Button>
                      <div onClick={handleMobileMenuClose}>
                        <LogoutButton 
                          variant="outline"
                          className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="ghost" 
                        className="w-full text-slate-300 hover:text-white hover:bg-slate-800/50"
                        onClick={() => setIsOpen(false)}
                      >
                        <Link href="/signin">Login</Link>
                      </Button>
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => setIsOpen(false)}
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
