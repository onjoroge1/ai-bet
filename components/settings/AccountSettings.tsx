"use client"

import { useState, useEffect } from "react"
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
  AlertCircle,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"

/**
 * AccountSettings — wires profile updates and password changes to real API endpoints.
 * Profile: PATCH /api/user/profile
 * Password: POST  /api/user/change-password
 */
export function AccountSettings() {
  const { user } = useAuth()
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [memberSince, setMemberSince] = useState<string | null>(null)
  const [emailVerified, setEmailVerified] = useState(false)

  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })

  const [password, setPassword] = useState({
    current: "",
    new: "",
    confirm: "",
  })

  // Load real profile data from API
  useEffect(() => {
    const fetchProfile = async () => {
      setIsDataLoading(true)
      try {
        const res = await fetch("/api/user/profile", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          const nameParts = (data.fullName || user?.name || "").split(" ")
          setProfile({
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            email: data.email || user?.email || "",
            phone: data.phone || "",
          })
          if (data.createdAt) {
            setMemberSince(
              new Date(data.createdAt).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })
            )
          }
          setEmailVerified(data.emailVerified ?? false)
        }
      } catch (err) {
        // Fallback to session data
        const nameParts = (user?.name || "").split(" ")
        setProfile(prev => ({
          ...prev,
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" ") || "",
          email: user?.email || "",
        }))
      } finally {
        setIsDataLoading(false)
      }
    }
    fetchProfile()
  }, [user])

  const handleProfileSave = async () => {
    setIsProfileLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: `${profile.firstName} ${profile.lastName}`.trim(),
          phone: profile.phone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update profile")
      setMessage({ type: "success", text: "Profile updated successfully!" })
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update profile. Please try again.",
      })
    } finally {
      setIsProfileLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    if (password.new !== password.confirm) {
      setMessage({ type: "error", text: "New passwords do not match." })
      return
    }
    if (password.new.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters long." })
      return
    }
    setIsPasswordLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: password.current,
          newPassword: password.new,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to change password")
      setMessage({ type: "success", text: "Password changed successfully!" })
      setPassword({ current: "", new: "", confirm: "" })
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to change password. Please try again.",
      })
    } finally {
      setIsPasswordLoading(false)
    }
  }

  if (isDataLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-48" />
        <div className="h-64 bg-slate-800/50 rounded-lg" />
        <div className="h-48 bg-slate-800/50 rounded-lg" />
      </div>
    )
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

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center space-x-2 ${
            message.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
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
                onChange={e => setProfile({ ...profile, firstName: e.target.value })}
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
                onChange={e => setProfile({ ...profile, lastName: e.target.value })}
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
                readOnly
                className="bg-slate-700/50 border-slate-600 text-slate-400 pl-10 cursor-not-allowed"
                placeholder="Email cannot be changed"
              />
            </div>
            <p className="text-xs text-slate-500">Email address cannot be changed after registration.</p>
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
                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white pl-10"
                placeholder="Enter your phone number"
              />
            </div>
          </div>

          <Button
            onClick={handleProfileSave}
            disabled={isProfileLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isProfileLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
            {memberSince && (
              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">Member Since</span>
                </div>
                <span className="text-white font-medium">{memberSince}</span>
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300">Email Verified</span>
              </div>
              {emailVerified ? (
                <Badge className="bg-green-500/20 text-green-400">Verified</Badge>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-400">Pending</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
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
                type={showCurrentPw ? "text" : "password"}
                value={password.current}
                onChange={e => setPassword({ ...password, current: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white pl-10 pr-10"
                placeholder="Enter current password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 h-6 w-6 p-0"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
              >
                {showCurrentPw ? (
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
                onChange={e => setPassword({ ...password, new: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white pl-10"
                placeholder="Enter new password (min 8 characters)"
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
                onChange={e => setPassword({ ...password, confirm: e.target.value })}
                className={`bg-slate-700 border-slate-600 text-white pl-10 ${
                  password.confirm && password.new !== password.confirm
                    ? "border-red-500/50"
                    : ""
                }`}
                placeholder="Confirm new password"
              />
            </div>
            {password.confirm && password.new !== password.confirm && (
              <p className="text-xs text-red-400">Passwords do not match</p>
            )}
          </div>

          <Button
            onClick={handlePasswordChange}
            disabled={
              isPasswordLoading ||
              !password.current ||
              !password.new ||
              password.new !== password.confirm
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPasswordLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
