"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  CreditCard, 
  Plus, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  Calendar,
  DollarSign,
  Phone,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react"

export function PaymentSettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Mock data - replace with real API calls
  const [paymentMethods] = useState([
    {
      id: '1',
      type: 'mpesa',
      name: 'M-Pesa',
      number: '+254712345678',
      isDefault: true,
      icon: Phone
    },
    {
      id: '2',
      type: 'card',
      name: 'Visa Card',
      number: '**** **** **** 1234',
      isDefault: false,
      icon: CreditCard
    }
  ])

  const [billingHistory] = useState([
    {
      id: '1',
      date: '2024-01-15',
      amount: 450,
      currency: 'KES',
      description: 'Weekend Package',
      status: 'completed'
    },
    {
      id: '2',
      date: '2024-01-10',
      amount: 680,
      currency: 'KES',
      description: 'Weekly Package',
      status: 'completed'
    }
  ])

  const handleAddPaymentMethod = () => {
    // TODO: Implement add payment method flow
    setMessage({ type: 'success', text: 'Add payment method functionality coming soon!' })
  }

  const handleDownloadReceipt = (id: string) => {
    // TODO: Implement download receipt functionality
    setMessage({ type: 'success', text: 'Receipt download functionality coming soon!' })
  }

  const handleEditPaymentMethod = (id: string) => {
    // TODO: Implement edit payment method functionality
    setMessage({ type: 'success', text: 'Edit payment method functionality coming soon!' })
  }

  const handleDeletePaymentMethod = async (id: string) => {
    setIsLoading(true)
    setMessage(null)
    
    try {
      // TODO: Implement API call to delete payment method
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      setMessage({ type: 'success', text: 'Payment method removed successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove payment method. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
          <CreditCard className="w-6 h-6 text-emerald-400" />
          <span>Payment & Billing</span>
        </h2>
        <p className="text-slate-400 mt-2">Manage your payment methods and view billing history</p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Current Plan */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
            <div>
              <h3 className="text-white font-medium text-lg">Free Plan</h3>
              <p className="text-slate-400">Basic access to predictions</p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge className="bg-green-500/20 text-green-400">Active</Badge>
              <Button 
                variant="outline" 
                className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
              >
                Upgrade to VIP
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Payment Methods</CardTitle>
            <Button 
              onClick={handleAddPaymentMethod}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentMethods.map((method) => (
            <div key={method.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <method.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">{method.name}</p>
                  <p className="text-slate-400 text-sm">{method.number}</p>
                  {method.isDefault && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 text-xs mt-1">Default</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleEditPaymentMethod(method.id)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-600"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDeletePaymentMethod(method.id)}
                  disabled={isLoading}
                  className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          {billingHistory.length > 0 ? (
            <div className="space-y-3">
              {billingHistory.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{item.description}</p>
                      <p className="text-slate-400 text-sm">
                        {new Date(item.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-white font-medium">
                        {item.currency} {item.amount}
                      </p>
                      <Badge className={item.status === 'completed' ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}>
                        {item.status}
                      </Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDownloadReceipt(item.id)}
                      className="border-slate-600 text-slate-300 hover:bg-slate-600"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No billing history yet</p>
              <p className="text-slate-500 text-sm">Your payment history will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Preferences */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Billing Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div>
                <h3 className="text-white font-medium">Currency</h3>
                <p className="text-slate-400 text-sm">KES (Kenyan Shilling)</p>
              </div>
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                Change
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div>
                <h3 className="text-white font-medium">Tax Information</h3>
                <p className="text-slate-400 text-sm">Not configured</p>
              </div>
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 