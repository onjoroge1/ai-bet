"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lock, Crown, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface PremiumGateProps {
  title?: string
  description?: string
  featureName?: string
}

export function PremiumGate({ 
  title = "Premium Feature",
  description = "This feature requires an active premium subscription.",
  featureName = "premium feature"
}: PremiumGateProps) {
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkPremiumAccess()
  }, [])

  const checkPremiumAccess = async () => {
    try {
      const response = await fetch('/api/premium/check')
      if (response.ok) {
        const data = await response.json()
        setHasAccess(data.hasAccess)
      } else {
        setHasAccess(false)
      }
    } catch (error) {
      console.error('Error checking premium access:', error)
      setHasAccess(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  if (hasAccess) {
    return null // User has access, don't show gate
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 max-w-2xl mx-auto">
        <CardContent className="p-12 text-center">
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
              <Lock className="h-16 w-16 text-emerald-400 relative z-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-white">{title}</h2>
              <p className="text-slate-400 text-lg">{description}</p>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-6 w-full max-w-md space-y-4">
              <h3 className="text-xl font-semibold text-white flex items-center justify-center gap-2">
                <Crown className="h-5 w-5 text-yellow-400" />
                Premium Subscription Benefits
              </h3>
              <ul className="text-left space-y-2 text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span>Access to {featureName}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span>Monthly recurring subscription</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span>Cancel anytime</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span>Priority support</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <Link href="/dashboard/vip" className="flex-1">
                <Button className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Premium
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => router.back()}
              >
                Go Back
              </Button>
            </div>

            <p className="text-xs text-slate-500 mt-4">
              Already have premium? Try refreshing the page or contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}



