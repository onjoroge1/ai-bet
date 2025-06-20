import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Share2, Download, Target, Star, Shield, Brain } from "lucide-react"
import Link from "next/link"

interface TipReceiptProps {
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
  onClose: () => void
}

export function TipReceipt({ tip, onClose }: TipReceiptProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Purchase Receipt</h2>
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">{tip.name}</h3>
              <p className="text-slate-400 text-sm">{tip.type}</p>
            </div>
            <Badge className="bg-emerald-500 text-white">
              {tip.isUrgent ? "Urgent" : "Regular"}
            </Badge>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Amount Paid</span>
              <span className="text-white font-medium">
                {tip.currencySymbol}{tip.price}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-slate-400">Time Left</span>
              <span className="text-white">
                {tip.timeLeft}
              </span>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="details" className="border-slate-700">
              <AccordionTrigger className="text-slate-300 hover:text-white">
                <div className="flex items-center">
                  <Target className="w-4 h-4 mr-2" />
                  <span>Purchase Details</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-slate-400">
                <div className="space-y-2">
                  <p>{tip.description}</p>
                  <div className="flex items-center space-x-2 mt-4">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm">Secure Payment</span>
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
            <a>View Tip</a>
          </Button>
        </Link>
      </div>
    </div>
  )
} 