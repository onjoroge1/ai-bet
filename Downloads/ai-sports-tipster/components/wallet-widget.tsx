"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle } from "lucide-react"
import { useCountry } from "@/contexts/country-context"

interface WalletData {
  balance: number
  currency: string
  transactions: Array<{
    id: string
    type: string
    amount: number
    status: string
    description: string
    createdAt: string
    paymentMethod?: string
  }>
}

export function WalletWidget() {
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const { convertPrice, countryData } = useCountry()

  useEffect(() => {
    // Simulate fetching wallet data
    const fetchWalletData = async () => {
      // In real implementation, this would fetch from your database
      const mockData: WalletData = {
        balance: 2450,
        currency: "KES",
        transactions: [
          {
            id: "1",
            type: "deposit",
            amount: 1000,
            status: "completed",
            description: "M-Pesa Deposit",
            createdAt: "2024-01-15T10:30:00Z",
            paymentMethod: "M-Pesa",
          },
          {
            id: "2",
            type: "purchase",
            amount: -150,
            status: "completed",
            description: "Daily Tip Purchase",
            createdAt: "2024-01-15T09:15:00Z",
          },
          {
            id: "3",
            type: "bonus",
            amount: 500,
            status: "completed",
            description: "Welcome Bonus",
            createdAt: "2024-01-14T16:20:00Z",
          },
          {
            id: "4",
            type: "withdrawal",
            amount: -800,
            status: "pending",
            description: "Bank Transfer",
            createdAt: "2024-01-14T14:10:00Z",
          },
        ],
      }

      setWalletData(mockData)
      setLoading(false)
    }

    fetchWalletData()
  }, [])

  const getTransactionIcon = (type: string, status: string) => {
    if (status === "pending") return <Clock className="w-4 h-4 text-yellow-400" />
    if (status === "failed") return <XCircle className="w-4 h-4 text-red-400" />

    switch (type) {
      case "deposit":
      case "bonus":
        return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
      case "purchase":
      case "withdrawal":
        return <ArrowUpRight className="w-4 h-4 text-red-400" />
      default:
        return <CheckCircle className="w-4 h-4 text-emerald-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Completed</Badge>
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
          <div className="h-8 bg-slate-700 rounded w-1/2"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (!walletData) return null

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Wallet className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Wallet</h3>
        </div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" />
          Add Funds
        </Button>
      </div>

      {/* Balance Display */}
      <div className="mb-6">
        <div className="text-3xl font-bold text-white mb-1">{convertPrice(walletData.balance)}</div>
        <div className="text-slate-400 text-sm">Available Balance</div>
      </div>

      {/* Recent Transactions */}
      <div>
        <h4 className="text-white font-medium mb-3">Recent Transactions</h4>
        <div className="space-y-3">
          {walletData.transactions.slice(0, 4).map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center space-x-3">
                {getTransactionIcon(transaction.type, transaction.status)}
                <div>
                  <div className="text-white text-sm font-medium">{transaction.description}</div>
                  <div className="text-slate-400 text-xs">{new Date(transaction.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium ${transaction.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {transaction.amount > 0 ? "+" : ""}
                  {convertPrice(Math.abs(transaction.amount))}
                </div>
                {getStatusBadge(transaction.status)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
          View All
        </Button>
        <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
          Withdraw
        </Button>
      </div>
    </Card>
  )
}
