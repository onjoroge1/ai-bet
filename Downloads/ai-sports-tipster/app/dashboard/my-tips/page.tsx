"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TipReceipt } from "@/components/tip-receipt"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface Tip {
  id: string
  purchaseDate: string
  amount: number
  paymentMethod: string
  tip: {
    name: string
    type: string
    price: number
    description: string
    features: string[]
    isUrgent: boolean
    timeLeft: string
    currencySymbol: string
    currencyCode: string
  }
}

export default function MyTipsPage() {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTip, setSelectedTip] = useState<Tip | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  useEffect(() => {
    fetchTips()
  }, [])

  const fetchTips = async () => {
    try {
      const response = await fetch("/api/my-tips")
      if (!response.ok) throw new Error("Failed to fetch tips")
      const data = await response.json()
      setTips(data)
    } catch (error) {
      console.error("Error fetching tips:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewTip = (tip: Tip) => {
    setSelectedTip(tip)
    setShowReceipt(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold text-white mb-6">My Purchased Tips</h1>
      
      {tips.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700 p-6 text-center">
          <p className="text-slate-400">You haven't purchased any tips yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tips.map((tip) => (
            <Card key={tip.id} className="bg-slate-800 border-slate-700 p-4">
              <div className="flex flex-col space-y-4">
                <div>
                  <h3 className="text-white font-medium">{tip.tip.name}</h3>
                  <p className="text-slate-400 text-sm">
                    {tip.tip.type} • {new Date(tip.purchaseDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-emerald-400 font-medium">
                    {tip.tip.currencySymbol}{tip.tip.price}
                  </p>
                  <p className="text-slate-400 text-sm">
                    {tip.tip.isUrgent && "Urgent • "}{tip.tip.timeLeft} left
                  </p>
                </div>
                <div className="flex justify-center">
                  <Button
                    onClick={() => handleViewTip(tip)}
                    className="bg-emerald-600 hover:bg-emerald-700 w-1/4"
                  >
                    View Tip
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedTip && (
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
            <TipReceipt tip={selectedTip.tip} onClose={() => setShowReceipt(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
} 