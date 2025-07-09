"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Eye, 
  EyeOff, 
  Save, 
  Calendar,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"

export function AccountSettings() {
  const { user } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [profile, setProfile] = useState({
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    phone: '' // TODO: Add phone field to User type if needed
  })

  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: ''
  })

  const handleProfileSave = async () => {
    setIsLoading(true)
    setMessage(null)
    
    try {
      // TODO: Implement API call to update profile
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    if (password.new !== password.confirm) {
      setMessage({ type: 'error', text: 'New passwords do not match.' })
      return
    }

    if (password.new.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long.' })
      return
    }

    setIsLoading(true)
    setMessage(null)
    
    try {
      // TODO: Implement API call to change password
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      setMessage({ type: 'success', text: 'Password changed successfully!' })
      setPassword({ current: '', new: '', confirm: '' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
          <User className="w-6 h-6 text-emerald-400" />
          <span>Account Settings</span>
        </h2>
        <p className="text-slate-400 mt-2">Manage your profile information and account security</p>
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

      {/* Profile Information */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <User className="w-5 h-5 text-emerald-400" />
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
                placeholder="Enter your first name"
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
                placeholder="Enter your last name"
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
                placeholder="Enter your email address"
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
                placeholder="Enter your phone number"
              />
            </div>
          </div>

          <Button 
            onClick={handleProfileSave}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Account Status */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Account Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300">Member Since</span>
              </div>
              <span className="text-white font-medium">
                Recently
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300">Email Verified</span>
              </div>
              <Badge className="bg-green-500/20 text-green-400">
                Verified
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <span>Change Password</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-slate-300">
              Current Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                id="currentPassword"
                type={showPassword ? "text" : "password"}
                value={password.current}
                onChange={(e) => setPassword({ ...password, current: e.target.value })}
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
                value={password.new}
                onChange={(e) => setPassword({ ...password, new: e.target.value })}
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
                value={password.confirm}
                onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white pl-10"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <Button 
            onClick={handlePasswordChange}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Lock className="w-4 h-4 mr-2" />
            )}
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 