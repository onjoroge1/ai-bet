"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TrendingUp, Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { logger } from "@/lib/logger"
import { checkPasswordStrength, PASSWORD_REQUIREMENTS } from "@/lib/auth/password"
import { Progress } from "@/components/ui/progress"
import { clearSessionCache } from "@/lib/session-request-manager"

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; feedback: string[] }>({ score: 0, feedback: [] })
  
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  })

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      router.push('/forgot-password')
    }
  }, [token, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Check password strength when password changes
    if (name === 'password') {
      const strength = checkPasswordStrength(value)
      setPasswordStrength(strength)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    // Validate password strength
    const strength = checkPasswordStrength(formData.password)
    if (!strength.isValid) {
      setError("Password does not meet requirements")
      setIsLoading(false)
      return
    }

    try {
      logger.info('Password reset attempt', { tags: ['auth', 'password-reset'], data: { token: token?.substring(0, 8) + "..." } })

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      // Clear client-side session cache after successful password reset
      // This ensures no stale session data remains cached
      clearSessionCache()
      logger.info('Password reset successful - session cache cleared', { 
        tags: ['auth', 'password-reset', 'cache-clear'] 
      })

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      logger.error('Password reset error', { 
        tags: ['auth', 'password-reset'],
        error: err instanceof Error ? err : undefined,
        data: { token: token?.substring(0, 8) + "..." }
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
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
          <h1 className="text-3xl font-bold text-white mb-2">Password Reset!</h1>
          <p className="text-slate-300">Your password has been updated successfully</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-4">Success!</h2>
            <p className="text-slate-300 mb-6">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <Link href="/signin">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                Sign In
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="w-full max-w-md">
        <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white mb-4">Invalid Reset Link</h2>
            <p className="text-slate-300 mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link href="/forgot-password">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                Request New Reset Link
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
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
        <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-slate-300">Enter your new password</p>
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
          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">
              New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" aria-hidden="true" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your new password"
                className="pl-10 pr-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                required
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                aria-label="New password"
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
            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="mt-2 space-y-2">
                <Progress value={(passwordStrength.score / 5) * 100} className="h-2" />
                <div className="text-xs text-slate-400">
                  {passwordStrength.feedback.map((feedback, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className={passwordStrength.score >= index + 1 ? "text-emerald-400" : "text-red-400"}>
                        {passwordStrength.score >= index + 1 ? "✓" : "×"}
                      </span>
                      <span>{feedback}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-slate-300">
              Confirm New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" aria-hidden="true" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your new password"
                className="pl-10 pr-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                aria-label="Confirm new password"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? "confirm-password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
            disabled={isLoading}
            aria-label={isLoading ? "Resetting password..." : "Reset password"}
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>

          {/* Back to Sign In */}
          <div className="text-center">
            <Link 
              href="/signin" 
              className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center justify-center"
              aria-label="Back to sign in"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Sign In
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
} 