"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Save, 
  CheckCircle,
  AlertCircle,
  Zap,
  Target,
  Calendar,
  DollarSign
} from "lucide-react"

export function NotificationSettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [notifications, setNotifications] = useState({
    // Email notifications
    emailNewPredictions: true,
    emailMatchResults: true,
    emailPaymentConfirmations: true,
    emailPromotional: false,
    emailNewsletter: true,
    
    // Push notifications
    pushNewPredictions: true,
    pushMatchResults: true,
    pushPaymentConfirmations: true,
    pushPromotional: false,
    
    // In-app notifications
    inAppSound: true,
    inAppBadges: true,
    inAppFrequency: 'immediate' // 'immediate' | 'hourly' | 'daily'
  })

  const handleSave = async () => {
    setIsLoading(true)
    setMessage(null)
    
    try {
      // TODO: Implement API call to save notification preferences
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      setMessage({ type: 'success', text: 'Notification preferences saved successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save preferences. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const updateNotification = (key: keyof typeof notifications, value: boolean | string) => {
    setNotifications(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
          <Bell className="w-6 h-6 text-emerald-400" />
          <span>Notification Settings</span>
        </h2>
        <p className="text-slate-400 mt-2">Manage how you receive notifications and updates</p>
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

      {/* Email Notifications */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Mail className="w-5 h-5 text-emerald-400" />
            <span>Email Notifications</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Target className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-white font-medium">New Predictions</h3>
                  <p className="text-slate-400 text-sm">Get notified when new AI predictions are available</p>
                </div>
              </div>
              <Switch
                checked={notifications.emailNewPredictions}
                onCheckedChange={(checked) => updateNotification('emailNewPredictions', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Calendar className="w-4 h-4 text-blue-400" />
                <div>
                  <h3 className="text-white font-medium">Match Results</h3>
                  <p className="text-slate-400 text-sm">Receive updates when your predicted matches end</p>
                </div>
              </div>
              <Switch
                checked={notifications.emailMatchResults}
                onCheckedChange={(checked) => updateNotification('emailMatchResults', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <DollarSign className="w-4 h-4 text-green-400" />
                <div>
                  <h3 className="text-white font-medium">Payment Confirmations</h3>
                  <p className="text-slate-400 text-sm">Get receipts and payment confirmations</p>
                </div>
              </div>
              <Switch
                checked={notifications.emailPaymentConfirmations}
                onCheckedChange={(checked) => updateNotification('emailPaymentConfirmations', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Zap className="w-4 h-4 text-yellow-400" />
                <div>
                  <h3 className="text-white font-medium">Promotional Offers</h3>
                  <p className="text-slate-400 text-sm">Special deals and promotional content</p>
                </div>
              </div>
              <Switch
                checked={notifications.emailPromotional}
                onCheckedChange={(checked) => updateNotification('emailPromotional', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Bell className="w-4 h-4 text-purple-400" />
                <div>
                  <h3 className="text-white font-medium">Newsletter</h3>
                  <p className="text-slate-400 text-sm">Weekly insights and betting tips</p>
                </div>
              </div>
              <Switch
                checked={notifications.emailNewsletter}
                onCheckedChange={(checked) => updateNotification('emailNewsletter', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <span>Push Notifications</span>
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 text-xs">
              Mobile & Browser
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Target className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-white font-medium">New Predictions</h3>
                  <p className="text-slate-400 text-sm">Instant alerts for new AI predictions</p>
                </div>
              </div>
              <Switch
                checked={notifications.pushNewPredictions}
                onCheckedChange={(checked) => updateNotification('pushNewPredictions', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Calendar className="w-4 h-4 text-blue-400" />
                <div>
                  <h3 className="text-white font-medium">Match Results</h3>
                  <p className="text-slate-400 text-sm">Real-time match outcome notifications</p>
                </div>
              </div>
              <Switch
                checked={notifications.pushMatchResults}
                onCheckedChange={(checked) => updateNotification('pushMatchResults', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <DollarSign className="w-4 h-4 text-green-400" />
                <div>
                  <h3 className="text-white font-medium">Payment Confirmations</h3>
                  <p className="text-slate-400 text-sm">Instant payment status updates</p>
                </div>
              </div>
              <Switch
                checked={notifications.pushPaymentConfirmations}
                onCheckedChange={(checked) => updateNotification('pushPaymentConfirmations', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Zap className="w-4 h-4 text-yellow-400" />
                <div>
                  <h3 className="text-white font-medium">Promotional Offers</h3>
                  <p className="text-slate-400 text-sm">Special deals and limited-time offers</p>
                </div>
              </div>
              <Switch
                checked={notifications.pushPromotional}
                onCheckedChange={(checked) => updateNotification('pushPromotional', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* In-App Settings */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Bell className="w-5 h-5 text-emerald-400" />
            <span>In-App Notifications</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Bell className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-white font-medium">Notification Sound</h3>
                  <p className="text-slate-400 text-sm">Play sound for new notifications</p>
                </div>
              </div>
              <Switch
                checked={notifications.inAppSound}
                onCheckedChange={(checked) => updateNotification('inAppSound', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Badge className="w-4 h-4 bg-red-500 rounded-full" />
                <div>
                  <h3 className="text-white font-medium">Unread Badges</h3>
                  <p className="text-slate-400 text-sm">Show unread notification count</p>
                </div>
              </div>
              <Switch
                checked={notifications.inAppBadges}
                onCheckedChange={(checked) => updateNotification('inAppBadges', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={isLoading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Preferences
        </Button>
      </div>
    </div>
  )
} 