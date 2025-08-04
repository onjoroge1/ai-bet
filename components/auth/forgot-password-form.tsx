"use client"

import type React from "react"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TrendingUp, Mail, ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"
import { logger } from "@/lib/logger"

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      logger.info('Password reset request', { tags: ['auth', 'password-reset'], data: { email } })

      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      setSuccess(true)
      logger.info('Password reset email sent', { tags: ['auth', 'password-reset'], data: { email } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      logger.error('Password reset error', { 
        tags: ['auth', 'password-reset'],
        error: err instanceof Error ? err : undefined,
        data: { email }
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
          <h1 className="text-3xl font-bold text-white mb-2">Check Your Email</h1>
          <p className="text-slate-300">We've sent you a password reset link</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-4">Reset Link Sent!</h2>
            <p className="text-slate-300 mb-6">
              We've sent a password reset link to <span className="font-medium text-white">{email}</span>. 
              Please check your email and click the link to reset your password.
            </p>
            <div className="space-y-3">
              <Link href="/signin">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </Link>
              <p className="text-sm text-slate-400">
                Didn't receive the email? Check your spam folder or{" "}
                <button 
                  onClick={() => setSuccess(false)}
                  className="text-emerald-400 hover:text-emerald-300 underline"
                >
                  try again
                </button>
              </p>
            </div>
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
        <h1 className="text-3xl font-bold text-white mb-2">Forgot Password?</h1>
        <p className="text-slate-300">Enter your email to reset your password</p>
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-label="Email address"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? "email-error" : undefined}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
            disabled={isLoading}
            aria-label={isLoading ? "Sending reset link..." : "Send reset link"}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
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