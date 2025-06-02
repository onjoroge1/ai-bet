"use client"

import type React from "react"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Mail, Lock, Eye, EyeOff, User, Globe, Smartphone, Gift } from "lucide-react"
import Link from "next/link"

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => setIsLoading(false), 2000)
  }

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-slate-900" />
          </div>
          <span className="text-2xl font-bold text-white">AI Tipster</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Join AI Tipster</h1>
        <p className="text-slate-300">Start winning with AI-powered predictions</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-300">
              Full Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>
          </div>

          {/* Country Selection */}
          <div className="space-y-2">
            <Label htmlFor="country" className="text-slate-300">
              Country
            </Label>
            <Select>
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ke">🇰🇪 Kenya</SelectItem>
                <SelectItem value="in">🇮🇳 India</SelectItem>
                <SelectItem value="ph">🇵🇭 Philippines</SelectItem>
                <SelectItem value="ng">🇳🇬 Nigeria</SelectItem>
                <SelectItem value="gb">🇬🇧 United Kingdom</SelectItem>
                <SelectItem value="us">🇺🇸 United States</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                className="pl-10 pr-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-slate-300">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                className="pl-10 pr-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="flex items-start space-x-2">
            <Checkbox id="terms" className="mt-1" />
            <Label htmlFor="terms" className="text-slate-300 text-sm leading-relaxed">
              I agree to the{" "}
              <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">
                Privacy Policy
              </Link>
            </Label>
          </div>

          {/* Marketing Consent */}
          <div className="flex items-start space-x-2">
            <Checkbox id="marketing" className="mt-1" />
            <Label htmlFor="marketing" className="text-slate-300 text-sm leading-relaxed">
              Send me tips, updates, and special offers via email
            </Label>
          </div>

          {/* Sign Up Button */}
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-800 px-2 text-slate-400">Or sign up with</span>
            </div>
          </div>

          {/* Social Signup */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <Globe className="w-4 h-4 mr-2" />
              Google
            </Button>
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <Smartphone className="w-4 h-4 mr-2" />
              M-Pesa
            </Button>
          </div>
        </form>

        {/* Sign In Link */}
        <div className="mt-6 text-center">
          <p className="text-slate-400">
            Already have an account?{" "}
            <Link href="/signin" className="text-emerald-400 hover:text-emerald-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>

        {/* Welcome Bonus */}
        <div className="mt-6 p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-medium text-sm">Welcome Bonus</span>
          </div>
          <ul className="text-slate-300 text-sm space-y-1">
            <li>• 7 days free VIP access</li>
            <li>• Exclusive welcome predictions</li>
            <li>• Telegram community access</li>
            <li>• KES 500 referral bonus</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
