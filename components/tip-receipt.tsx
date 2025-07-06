import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Share2, Download, Target, Star, Shield, Brain, Calendar, CreditCard, CheckCircle } from "lucide-react"
import Link from "next/link"

interface TipReceiptProps {
  tip: {
    id: string
    purchaseId?: string
    name: string
    type: string
    price: number
    amount: number
    description: string
    features: string[]
    isUrgent: boolean
    timeLeft: string | null
    currencySymbol: string
    currencyCode: string
    purchaseDate: string
    paymentMethod: string
    homeTeam?: string
    awayTeam?: string
    matchDate?: string | null
    league?: string | null
    predictionType?: string | null
    confidenceScore?: number | null
    odds?: number | null
    valueRating?: string | null
  }
  onClose: () => void
}

export function TipReceipt({ tip, onClose }: TipReceiptProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatMatchDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPredictionTypeLabel = (type: string | null) => {
    if (!type) return 'No Prediction'
    switch (type) {
      case 'home_win': return 'Home Win'
      case 'away_win': return 'Away Win'
      case 'draw': return 'Draw'
      default: return type
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
          <div>
            <h2 className="text-2xl font-bold text-white">Purchase Successful!</h2>
            <p className="text-slate-400 text-sm">Your tip has been purchased and is ready to use</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" className="text-slate-400">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="text-slate-400">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="space-y-4">
          {/* Tip Details */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium text-lg">{tip.name}</h3>
              <p className="text-slate-400 text-sm">{tip.type}</p>
            </div>
            <Badge className="bg-emerald-500 text-white">
              {tip.isUrgent ? "Urgent" : "Regular"}
            </Badge>
          </div>

          {/* Match Information */}
          {tip.homeTeam && tip.awayTeam && (
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Match Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Teams:</span>
                  <span className="text-white font-medium">
                    {tip.homeTeam} vs {tip.awayTeam}
                  </span>
                </div>
                {tip.league && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">League:</span>
                    <span className="text-white">{tip.league}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Match Date:</span>
                  <span className="text-white">{formatMatchDate(tip.matchDate)}</span>
                </div>
                {tip.predictionType && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Prediction:</span>
                    <Badge className="bg-blue-500/20 text-blue-400">
                      {getPredictionTypeLabel(tip.predictionType)}
                    </Badge>
                  </div>
                )}
                {tip.confidenceScore && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Confidence:</span>
                    <Badge className="bg-purple-500/20 text-purple-400">
                      {tip.confidenceScore}%
                    </Badge>
                  </div>
                )}
                {tip.odds && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Odds:</span>
                    <span className="text-white">{tip.odds}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Information */}
          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-white font-medium mb-3">Payment Information</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="text-white font-mono text-sm">{tip.purchaseId || tip.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Amount Paid:</span>
                <span className="text-white font-medium text-lg">
                  {tip.currencySymbol}{tip.amount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Payment Method:</span>
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span className="text-white capitalize">{tip.paymentMethod}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Purchase Date:</span>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-white">{formatDate(tip.purchaseDate)}</span>
                </div>
              </div>
              {tip.timeLeft && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Time Left:</span>
                  <span className="text-white">
                    {tip.timeLeft}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Features */}
          {tip.features && tip.features.length > 0 && (
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-white font-medium mb-3">What's Included</h4>
              <div className="space-y-2">
                {tip.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2 text-slate-300 text-sm">
                    <Star className="w-3 h-3 text-yellow-400" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Details */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="details" className="border-slate-700">
              <AccordionTrigger className="text-slate-300 hover:text-white">
                <div className="flex items-center">
                  <Target className="w-4 h-4 mr-2" />
                  <span>Additional Details</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-slate-400">
                <div className="space-y-2">
                  <p>{tip.description}</p>
                  <div className="flex items-center space-x-2 mt-4">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm">Secure Payment Processed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span className="text-sm">AI-Powered Analysis</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
          Close
        </Button>
        <Link href="/dashboard/my-tips" passHref legacyBehavior>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <a>View My Tips</a>
          </Button>
        </Link>
      </div>
    </div>
  )
} 