import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Share2, Download, Gift, Star, Shield, Brain, Calendar, CreditCard, CheckCircle, Zap, Crown } from "lucide-react"
import Link from "next/link"

interface PremiumPackageReceiptProps {
  package: {
    id: string
    purchaseId?: string
    name: string
    type: string
    price: number
    amount: number
    description: string
    features: string[]
    currencySymbol: string
    currencyCode: string
    purchaseDate: string
    paymentMethod: string
    packageType: string
    creditsGained: number
    tipsIncluded: number
    validityDays: number
    expiresAt?: string
  }
  onClose: () => void
}

export function PremiumPackageReceipt({ package: pkg, onClose }: PremiumPackageReceiptProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const getPackageIcon = () => {
    switch (pkg.packageType) {
      case 'weekend_pass':
        return <Calendar className="w-6 h-6 text-blue-400" />
      case 'weekly_pass':
        return <Zap className="w-6 h-6 text-yellow-400" />
      case 'monthly_sub':
        return <Crown className="w-6 h-6 text-purple-400" />
      default:
        return <Gift className="w-6 h-6 text-emerald-400" />
    }
  }

  const getPackageTypeLabel = (type: string) => {
    switch (type) {
      case 'weekend_pass':
        return 'Weekend Package'
      case 'weekly_pass':
        return 'Weekly Package'
      case 'monthly_sub':
        return 'Monthly Subscription'
      default:
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const getValidityText = (days: number) => {
    if (days === -1) return 'Unlimited'
    if (days === 1) return '1 day'
    if (days === 3) return '3 days'
    if (days === 7) return '1 week'
    if (days === 30) return '1 month'
    return `${days} days`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
          <div>
            <h2 className="text-2xl font-bold text-white">Package Purchase Successful!</h2>
            <p className="text-slate-400 text-sm">Your premium package is now active</p>
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

      <Card className="bg-slate-800/50 border-slate-700">
        <div className="p-6 space-y-6">
          {/* Package Information */}
          <div className="border-b border-slate-700 pb-4">
            <div className="flex items-center space-x-3 mb-4">
              {getPackageIcon()}
              <div>
                <h3 className="text-xl font-bold text-white">{getPackageTypeLabel(pkg.packageType)}</h3>
                <p className="text-slate-400 text-sm">{pkg.description}</p>
              </div>
            </div>
            
            {/* Credits and Tips Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Star className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Credits Gained</span>
                </div>
                <div className="text-2xl font-bold text-white">{pkg.creditsGained}</div>
                <p className="text-slate-400 text-sm">Prediction credits added to your account</p>
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <span className="text-blue-400 font-semibold">Tips Included</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {pkg.tipsIncluded === -1 ? 'Unlimited' : pkg.tipsIncluded}
                </div>
                <p className="text-slate-400 text-sm">Premium tips available</p>
              </div>
              
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <span className="text-purple-400 font-semibold">Validity</span>
                </div>
                <div className="text-2xl font-bold text-white">{getValidityText(pkg.validityDays)}</div>
                <p className="text-slate-400 text-sm">Package duration</p>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="border-b border-slate-700 pb-4">
            <h4 className="text-white font-medium mb-3">Payment Information</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="text-white font-mono text-sm">{pkg.purchaseId || pkg.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Amount Paid:</span>
                <span className="text-white font-medium text-lg">
                  {pkg.currencySymbol}{Number(pkg.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Payment Method:</span>
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span className="text-white capitalize">{pkg.paymentMethod}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Purchase Date:</span>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-white">{formatDate(pkg.purchaseDate)}</span>
                </div>
              </div>
              {pkg.expiresAt && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Expires:</span>
                  <span className="text-white">
                    {formatDate(pkg.expiresAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Package Features */}
          <div className="border-b border-slate-700 pb-4">
            <h4 className="text-white font-medium mb-3">Package Features</h4>
            <div className="space-y-2">
              {pkg.features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2 text-slate-300 text-sm">
                  <Star className="w-3 h-3 text-yellow-400" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Details */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="details" className="border-slate-700">
              <AccordionTrigger className="text-slate-300 hover:text-white">
                <div className="flex items-center">
                  <Gift className="w-4 h-4 mr-2" />
                  <span>Package Details</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-slate-400">
                <div className="space-y-2">
                  <p>{pkg.description}</p>
                  <div className="flex items-center space-x-2 mt-4">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm">Secure Payment Processed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span className="text-sm">AI-Powered Premium Tips</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm">Credits Added to Your Account</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={onClose}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          View My Packages
        </Button>
        <Button 
          variant="outline" 
          className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          asChild
        >
          <Link href="/dashboard/my-tips">
            Browse Tips
          </Link>
        </Button>
      </div>
    </div>
  )
} 