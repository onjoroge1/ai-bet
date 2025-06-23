"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  User,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Download,
  Trash2,
  CheckCircle,
} from "lucide-react"

import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb"

export default function SettingsPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [notifications, setNotifications] = useState({
    email: true,
    sms: true,
    push: true,
    marketing: false,
  })

  const [profile, setProfile] = useState({
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "+254712345678",
    country: "Kenya",
    currency: "KES",
    language: "English",
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <div className="max-w-4xl mx-auto">
        <DashboardBreadcrumb />
        {/* OR */}
        {/* <DashboardNavHeader /> */}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Settings className="w-8 h-8 text-emerald-400" />
            <h1 className="text-3xl font-bold text-white">Settings</h1>
          </div>
          <p className="text-slate-300 text-lg">Manage your account preferences and settings</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700 grid w-full grid-cols-5">
            <TabsTrigger value="profile" className="data-[state=active]:bg-emerald-600">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-emerald-600">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-emerald-600">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-emerald-600">
              <CreditCard className="w-4 h-4 mr-2" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-emerald-600">
              <Globe className="w-4 h-4 mr-2" />
              Preferences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-slate-300">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      value={profile.firstName}
                      onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-slate-300">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      value={profile.lastName}
                      onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-300">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      id="phone"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white pl-10"
                    />
                  </div>
                </div>

                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Bell className="w-5 h-5" />
                  <span>Notification Preferences</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">Email Notifications</h3>
                      <p className="text-slate-400 text-sm">Receive tips and updates via email</p>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">SMS Notifications</h3>
                      <p className="text-slate-400 text-sm">Get instant alerts via SMS</p>
                    </div>
                    <Switch
                      checked={notifications.sms}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, sms: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">Push Notifications</h3>
                      <p className="text-slate-400 text-sm">Browser and mobile app notifications</p>
                    </div>
                    <Switch
                      checked={notifications.push}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">Marketing Communications</h3>
                      <p className="text-slate-400 text-sm">Promotional offers and news</p>
                    </div>
                    <Switch
                      checked={notifications.marketing}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, marketing: checked })}
                    />
                  </div>
                </div>

                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Security Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-slate-300">
                      Current Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input
                        id="currentPassword"
                        type={showPassword ? "text" : "password"}
                        className="bg-slate-700 border-slate-600 text-white pl-10 pr-10"
                        placeholder="Enter current password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-2 h-6 w-6 p-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 text-slate-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-400" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-slate-300">
                      New Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input
                        id="newPassword"
                        type="password"
                        className="bg-slate-700 border-slate-600 text-white pl-10"
                        placeholder="Enter new password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-300">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        className="bg-slate-700 border-slate-600 text-white pl-10"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-6">
                  <h3 className="text-white font-medium mb-4">Two-Factor Authentication</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-300">Enable 2FA for extra security</p>
                      <p className="text-slate-400 text-sm">Protect your account with SMS verification</p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                    >
                      Enable 2FA
                    </Button>
                  </div>
                </div>

                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Update Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <CreditCard className="w-5 h-5" />
                  <span>Billing & Subscription</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-medium">Current Plan</h3>
                      <p className="text-slate-400">Free Plan</p>
                    </div>
                    <Badge className="bg-slate-600 text-white">Active</Badge>
                  </div>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Upgrade to VIP</Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-white font-medium">Payment Methods</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                          <Phone className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium">M-Pesa</p>
                          <p className="text-slate-400 text-sm">+254712345678</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                        Edit
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                  >
                    Add Payment Method
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-white font-medium">Billing History</h3>
                  <div className="text-center py-8">
                    <CreditCard className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No billing history yet</p>
                    <p className="text-slate-500 text-sm">Your payment history will appear here</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Globe className="w-5 h-5" />
                  <span>App Preferences</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Language</Label>
                    <select className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md text-white">
                      <option value="en">English</option>
                      <option value="sw">Swahili</option>
                      <option value="fr">French</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Currency</Label>
                    <select className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md text-white">
                      <option value="KES">KES (Kenyan Shilling)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Time Zone</Label>
                    <select className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md text-white">
                      <option value="EAT">East Africa Time (EAT)</option>
                      <option value="UTC">UTC</option>
                      <option value="GMT">GMT</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Date Format</Label>
                    <select className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md text-white">
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-6">
                  <h3 className="text-white font-medium mb-4">Data & Privacy</h3>
                  <div className="space-y-4">
                    <Button
                      variant="outline"
                      className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download My Data
                    </Button>
                    <Button variant="outline" className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Account
                    </Button>
                  </div>
                </div>

                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
