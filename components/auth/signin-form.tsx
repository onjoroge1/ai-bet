"use client"

import type React from "react"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { TrendingUp, Mail, Lock, Eye, EyeOff, Globe, Smartphone } from "lucide-react"
import Link from "next/link"

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false)
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
        <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-slate-300">Sign in to access your winning predictions</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="Enter your password"
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

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <Label htmlFor="remember" className="text-slate-300 text-sm">
                Remember me
              </Label>
            </div>
            <Link href="/forgot-password" className="text-emerald-400 hover:text-emerald-300 text-sm">
              Forgot password?
            </Link>
          </div>

          {/* Sign In Button */}
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-800 px-2 text-slate-400">Or continue with</span>
            </div>
          </div>

          {/* Social Login */}
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

        {/* Sign Up Link */}
        <div className="mt-6 text-center">
          <p className="text-slate-400">
            Don't have an account?{" "}
            <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-medium">
              Sign up for free
            </Link>
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-medium text-sm">Member Benefits</span>
          </div>
          <ul className="text-slate-300 text-sm space-y-1">
            <li>• 3 free predictions daily</li>
            <li>• AI-powered analysis</li>
            <li>• Community access</li>
            <li>• Mobile app access</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
