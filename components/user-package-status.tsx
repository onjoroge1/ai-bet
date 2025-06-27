"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Crown, Zap, Calendar, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { useUserCountry } from "@/contexts/user-country-context"

interface UserPackage {
  id: string
  purchasedAt: string
  expiresAt: string
  tipsRemaining: number
  totalTips: number
  status: string
  pricePaid: number
  currencyCode: string
  currencySymbol: string
  packageOffer: {
    name: string
    packageType: string
    tipCount: number
    validityDays: number
    iconName: string
    colorGradientFrom: string
    colorGradientTo: string
  }
}

interface PackageStatus {
  userPackages: UserPackage[]
  totalTipsRemaining: string | number
  hasUnlimited: boolean
}

export function UserPackageStatus() {
  const [packageStatus, setPackageStatus] = useState<PackageStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { convertPrice } = useUserCountry()

  useEffect(() => {
    fetchPackageStatus()
  }, [])

  const fetchPackageStatus = async () => {
    try {
      const response = await fetch("/api/user-packages/claim-tip")
      if (!response.ok) throw new Error("Failed to fetch package status")
      const data = await response.json()
      setPackageStatus(data)
    } catch (error) {
      console.error("Error fetching package status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "Zap": return <Zap className="w-4 h-4" />
      case "Calendar": return <Calendar className="w-4 h-4" />
      case "TrendingUp": return <TrendingUp className="w-4 h-4" />
      case "Crown": return <Crown className="w-4 h-4" />
      default: return <Zap className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500"
      case "expired": return "bg-red-500"
      case "completed": return "bg-blue-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="w-4 h-4" />
      case "expired": return <AlertCircle className="w-4 h-4" />
      case "completed": return <CheckCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()
    
    if (diff <= 0) return "Expired"
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h`
    return "Less than 1h"
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-4">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
        </div>
      </Card>
    )
  }

  if (!packageStatus || packageStatus.userPackages.length === 0) {
    return null // Don't show anything if user has no packages
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Your Packages</h3>
        <Badge className="bg-emerald-500 text-white text-xs">
          {packageStatus.hasUnlimited ? "Unlimited" : `${packageStatus.totalTipsRemaining} Tips Left`}
        </Badge>
      </div>

      <div className="space-y-2">
        {packageStatus.userPackages.map((userPackage) => (
          <div
            key={userPackage.id}
            className="flex items-center justify-between p-2 rounded bg-slate-700/50 border border-slate-600"
            style={{
              background: `linear-gradient(135deg, ${userPackage.packageOffer.colorGradientFrom}10, ${userPackage.packageOffer.colorGradientTo}10)`
            }}
          >
            <div className="flex items-center space-x-2">
              <div 
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${userPackage.packageOffer.colorGradientFrom}, ${userPackage.packageOffer.colorGradientTo})`
                }}
              >
                {getIconComponent(userPackage.packageOffer.iconName)}
              </div>
              <div>
                <div className="text-white text-xs font-medium">
                  {userPackage.packageOffer.name}
                </div>
                <div className="text-slate-400 text-xs">
                  {userPackage.packageOffer.tipCount === -1 
                    ? "Unlimited tips" 
                    : `${userPackage.tipsRemaining}/${userPackage.totalTips} tips`
                  }
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="text-right">
                <div className="text-emerald-400 text-xs font-medium">
                  {userPackage.currencySymbol}{userPackage.pricePaid}
                </div>
                <div className="text-slate-400 text-xs">
                  {getTimeRemaining(userPackage.expiresAt)}
                </div>
              </div>
              <Badge className={`${getStatusColor(userPackage.status)} text-white text-xs`}>
                {getStatusIcon(userPackage.status)}
                <span className="ml-1">{userPackage.status}</span>
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-600">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Total Value:</span>
          <span className="text-emerald-400 font-medium">
            {convertPrice(packageStatus.userPackages.reduce((sum, pkg) => sum + pkg.pricePaid, 0))}
          </span>
        </div>
      </div>
    </Card>
  )
} 