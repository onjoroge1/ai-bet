"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Globe, 
  Calendar,
  Loader2,
  RefreshCw
} from "lucide-react"

interface RevenueData {
  totalUSD: number
  breakdown: {
    currency: string
    amount: number
    usdEquivalent: number
    percentage: number
  }[]
  monthlyGrowth: number
  topCountries: {
    country: string
    revenue: number
    currency: string
  }[]
}

export function RevenueAnalytics() {
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRevenueData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await fetch("/api/admin/revenue-analytics")
      if (!response.ok) {
        throw new Error("Failed to fetch revenue analytics")
      }

      const data = await response.json()
      setRevenueData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load revenue data")
      console.error("Error fetching revenue analytics:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRevenueData()
  }, [])

  const handleRefresh = () => {
    fetchRevenueData(true)
  }

  const formatUSD = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`
    return `$${amount.toFixed(2)}`
  }

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: { [key: string]: string } = {
      'USD': '$',
      'KES': 'KES ',
      'EUR': '€',
      'GBP': '£',
      'NGN': '₦',
      'GHS': 'GH₵',
      'ZAR': 'R',
    }
    const symbol = symbols[currency] || currency + ' '
    
    if (amount >= 1000000) return `${symbol}${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${symbol}${(amount / 1000).toFixed(1)}K`
    return `${symbol}${amount.toFixed(2)}`
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>Revenue Analytics</span>
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="bg-slate-900/50 rounded-lg p-4 animate-pulse">
                <div className="h-6 bg-slate-700 rounded mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span>Revenue Analytics</span>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <TrendingDown className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 mb-2">Failed to load revenue analytics</p>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!revenueData) return null

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>Revenue Analytics</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Revenue */}
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">Total Revenue (USD)</h3>
            <Badge 
              className={`${
                revenueData.monthlyGrowth >= 0 
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                  : "bg-red-500/20 text-red-400 border-red-500/30"
              }`}
            >
              {revenueData.monthlyGrowth >= 0 ? "+" : ""}{revenueData.monthlyGrowth.toFixed(1)}%
            </Badge>
          </div>
          <div className="text-3xl font-bold text-emerald-400 mb-1">
            {formatUSD(revenueData.totalUSD)}
          </div>
          <p className="text-slate-400 text-sm">All currencies converted to USD</p>
        </div>

        {/* Currency Breakdown */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
            <Globe className="w-4 h-4 mr-2 text-blue-400" />
            Revenue by Currency
          </h3>
          <div className="space-y-2">
            {revenueData.breakdown.map((item) => (
              <div key={item.currency} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400 text-sm font-medium">{item.currency}</span>
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {formatCurrency(item.amount, item.currency)}
                    </div>
                    <div className="text-slate-400 text-xs">
                      {formatUSD(item.usdEquivalent)} ({item.percentage.toFixed(1)}%)
                    </div>
                  </div>
                </div>
                <div className="w-16 bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-400 h-2 rounded-full" 
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Countries */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
            <Globe className="w-4 h-4 mr-2 text-purple-400" />
            Top Revenue Countries
          </h3>
          <div className="space-y-2">
            {revenueData.topCountries.map((country, index) => (
              <div key={country.country} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-purple-400 text-sm font-bold">#{index + 1}</span>
                  </div>
                  <div>
                    <div className="text-white font-medium">{country.country}</div>
                    <div className="text-slate-400 text-xs">
                      {formatCurrency(country.revenue, country.currency)}
                    </div>
                  </div>
                </div>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                  {country.currency}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 