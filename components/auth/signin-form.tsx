"use client"

import type React from "react"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { TrendingUp, Mail, Lock, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { logger } from "@/lib/logger"

export function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      logger.info('Attempting sign in', { tags: ['auth', 'signin'], data: { email: formData.email } })

      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        logger.error('Sign in failed', { 
          tags: ['auth', 'signin'],
          data: { email: formData.email, error: result.error }
        })
        throw new Error(result.error)
      }

      logger.info("Sign in successful", { tags: ["auth", "signin"] })
      router.push(callbackUrl)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      logger.error('Sign in error', { 
        tags: ['auth', 'signin'],
        error: err instanceof Error ? err : undefined,
        data: { email: formData.email }
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-slate-900" />
          </div>
          <span className="text-2xl font-bold text-white">SnapBet</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-slate-300">Sign in to your account</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
        {error && (
          <div 
            className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" aria-hidden="true" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                required
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                aria-label="Email address"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? "email-error" : undefined}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" aria-hidden="true" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="pl-10 pr-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                required
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                aria-label="Password"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? "password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                name="remember"
                checked={formData.remember}
                onCheckedChange={(checked) => handleChange({ target: { name: 'remember', checked } } as any)}
                aria-label="Remember me"
              />
              <Label htmlFor="remember" className="text-slate-300 text-sm">
                Remember me
              </Label>
            </div>
            <Link 
              href="/forgot-password" 
              className="text-emerald-400 hover:text-emerald-300 text-sm"
              aria-label="Forgot password?"
            >
              Forgot password?
            </Link>
          </div>

          {/* Sign In Button */}
          <Button 
            type="submit" 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
            disabled={isLoading}
            aria-label={isLoading ? "Signing in..." : "Sign in"}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-slate-400">
              Don't have an account?{" "}
              <Link 
                href="/signup" 
                className="text-emerald-400 hover:text-emerald-300 font-medium"
                aria-label="Sign up for free"
              >
                Sign up for free
              </Link>
            </p>
          </div>
        </form>
      </Card>
    </div>
  )
}
