"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  Shield, 
  Eye, 
  Download, 
  Trash2, 
  Save, 
  CheckCircle,
  AlertCircle,
  Lock,
  User,
  Globe,
  Smartphone,
  Calendar,
  AlertTriangle
} from "lucide-react"

export function PrivacySettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [privacySettings, setPrivacySettings] = useState({
    // Profile visibility
    profileVisibility: 'public', // 'public' | 'private' | 'friends'
    sharePredictionHistory: false,
    shareAnalytics: true,
    
    // Data usage
    allowDataAnalytics: true,
    allowMarketingData: false,
    allowThirdPartyData: false,
    
    // Security
    twoFactorAuth: false,
    sessionTimeout: 30, // minutes
    loginNotifications: true,
    
    // Data export
    autoExportData: false,
    exportFrequency: 'monthly' // 'weekly' | 'monthly' | 'quarterly'
  })

  const handleSave = async () => {
    setIsLoading(true)
    setMessage(null)
    
    try {
      // TODO: Implement API call to save privacy settings
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      setMessage({ type: 'success', text: 'Privacy settings saved successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadData = async () => {
    setIsLoading(true)
    setMessage(null)
    
    try {
      // TODO: Implement API call to export user data
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call
      setMessage({ type: 'success', text: 'Data export started! You will receive an email when ready.' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to export data. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAccount = () => {
    // TODO: Implement account deletion flow with confirmation
    setMessage({ type: 'error', text: 'Account deletion requires additional confirmation. Please contact support.' })
  }

  const updateSetting = (key: keyof typeof privacySettings, value: boolean | string | number) => {
    setPrivacySettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
          <Shield className="w-6 h-6 text-emerald-400" />
          <span>Privacy & Security</span>
        </h2>
        <p className="text-slate-400 mt-2">Manage your privacy settings and account security</p>
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

      {/* Profile Privacy */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <User className="w-5 h-5 text-emerald-400" />
            <span>Profile Privacy</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Eye className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-white font-medium">Profile Visibility</h3>
                  <p className="text-slate-400 text-sm">Control who can see your profile</p>
                </div>
              </div>
              <select 
                value={privacySettings.profileVisibility}
                onChange={(e) => updateSetting('profileVisibility', e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1 text-white"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="friends">Friends Only</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Calendar className="w-4 h-4 text-blue-400" />
                <div>
                  <h3 className="text-white font-medium">Share Prediction History</h3>
                  <p className="text-slate-400 text-sm">Allow others to see your prediction history</p>
                </div>
              </div>
              <Switch
                checked={privacySettings.sharePredictionHistory}
                onCheckedChange={(checked) => updateSetting('sharePredictionHistory', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Globe className="w-4 h-4 text-purple-400" />
                <div>
                  <h3 className="text-white font-medium">Share Analytics</h3>
                  <p className="text-slate-400 text-sm">Share your success rate and performance</p>
                </div>
              </div>
              <Switch
                checked={privacySettings.shareAnalytics}
                onCheckedChange={(checked) => updateSetting('shareAnalytics', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Usage */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            <span>Data Usage & Analytics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Shield className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-white font-medium">Allow Data Analytics</h3>
                  <p className="text-slate-400 text-sm">Help improve our AI predictions with your data</p>
                </div>
              </div>
              <Switch
                checked={privacySettings.allowDataAnalytics}
                onCheckedChange={(checked) => updateSetting('allowDataAnalytics', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Smartphone className="w-4 h-4 text-blue-400" />
                <div>
                  <h3 className="text-white font-medium">Marketing Data Usage</h3>
                  <p className="text-slate-400 text-sm">Allow data to be used for personalized marketing</p>
                </div>
              </div>
              <Switch
                checked={privacySettings.allowMarketingData}
                onCheckedChange={(checked) => updateSetting('allowMarketingData', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Globe className="w-4 h-4 text-purple-400" />
                <div>
                  <h3 className="text-white font-medium">Third-Party Data Sharing</h3>
                  <p className="text-slate-400 text-sm">Share data with trusted third-party services</p>
                </div>
              </div>
              <Switch
                checked={privacySettings.allowThirdPartyData}
                onCheckedChange={(checked) => updateSetting('allowThirdPartyData', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <span>Security Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Shield className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-white font-medium">Two-Factor Authentication</h3>
                  <p className="text-slate-400 text-sm">Add an extra layer of security to your account</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Badge className={privacySettings.twoFactorAuth ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                  {privacySettings.twoFactorAuth ? "Enabled" : "Disabled"}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                >
                  {privacySettings.twoFactorAuth ? "Manage" : "Enable"}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Calendar className="w-4 h-4 text-blue-400" />
                <div>
                  <h3 className="text-white font-medium">Session Timeout</h3>
                  <p className="text-slate-400 text-sm">Automatically log out after inactivity</p>
                </div>
              </div>
              <select 
                value={privacySettings.sessionTimeout}
                onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value))}
                className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1 text-white"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Smartphone className="w-4 h-4 text-purple-400" />
                <div>
                  <h3 className="text-white font-medium">Login Notifications</h3>
                  <p className="text-slate-400 text-sm">Get notified of new login attempts</p>
                </div>
              </div>
              <Switch
                checked={privacySettings.loginNotifications}
                onCheckedChange={(checked) => updateSetting('loginNotifications', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Download className="w-5 h-5 text-emerald-400" />
            <span>Data Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Download className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-white font-medium">Export My Data</h3>
                  <p className="text-slate-400 text-sm">Download all your data in a portable format</p>
                </div>
              </div>
              <Button 
                onClick={handleDownloadData}
                disabled={isLoading}
                variant="outline" 
                className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export Data
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <div>
                  <h3 className="text-white font-medium">Delete Account</h3>
                  <p className="text-slate-400 text-sm">Permanently delete your account and all data</p>
                </div>
              </div>
              <Button 
                onClick={handleDeleteAccount}
                variant="outline" 
                className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
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
          Save Settings
        </Button>
      </div>
    </div>
  )
} 