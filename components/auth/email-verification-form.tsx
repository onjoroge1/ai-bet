"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, CheckCircle, XCircle, ArrowLeft, Mail } from "lucide-react"
import Link from "next/link"
import { logger } from "@/lib/logger"

export function EmailVerificationForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)

  // Auto-verify on component mount if token is present
  useEffect(() => {
    if (token) {
      verifyEmail()
    } else {
      setIsVerifying(false)
    }
  }, [token])

  const verifyEmail = async () => {
    setIsLoading(true)
    setError("")

    try {
      logger.info('Email verification attempt', { tags: ['auth', 'email-verification'], data: { token: token?.substring(0, 8) + "..." } })

      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      setSuccess(true)
      logger.info('Email verification successful', { tags: ['auth', 'email-verification'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      logger.error('Email verification error', { 
        tags: ['auth', 'email-verification'],
        error: err instanceof Error ? err : undefined,
        data: { token: token?.substring(0, 8) + "..." }
      })
    } finally {
      setIsLoading(false)
      setIsVerifying(false)
    }
  }

  if (isVerifying) {
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
          <h1 className="text-3xl font-bold text-white mb-2">Verifying Email</h1>
          <p className="text-slate-300">Please wait while we verify your email address</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
            <p className="text-slate-300">Verifying your email address...</p>
          </div>
        </Card>
      </div>
    )
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
          <h1 className="text-3xl font-bold text-white mb-2">Email Verified!</h1>
          <p className="text-slate-300">Your email has been verified successfully</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-4">Success!</h2>
            <p className="text-slate-300 mb-6">
              Your email address has been verified successfully. You now have full access to all SnapBet features!
            </p>
            <div className="space-y-3">
              <Link href="/dashboard">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  Go to Dashboard
                </Button>
              </Link>
              <Link href="/signin">
                <Button variant="outline" className="w-full">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (!token) {
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
          <h1 className="text-3xl font-bold text-white mb-2">Invalid Link</h1>
          <p className="text-slate-300">This verification link is invalid</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="w-16 h-16 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-4">Invalid Verification Link</h2>
            <p className="text-slate-300 mb-6">
              This email verification link is invalid or has expired. Please request a new verification email.
            </p>
            <div className="space-y-3">
              <Link href="/signin">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  Sign In
                </Button>
              </Link>
              <p className="text-sm text-slate-400">
                Need a new verification email?{" "}
                <Link href="/resend-verification" className="text-emerald-400 hover:text-emerald-300 underline">
                  Request one here
                </Link>
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
        <h1 className="text-3xl font-bold text-white mb-2">Verification Failed</h1>
        <p className="text-slate-300">We couldn't verify your email address</p>
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

        <div className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="w-16 h-16 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-4">Verification Failed</h2>
          <p className="text-slate-300 mb-6">
            We couldn't verify your email address. This could be because the link has expired or is invalid.
          </p>
          
          <div className="space-y-3">
            <Button 
              onClick={verifyEmail}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? "Retrying..." : "Try Again"}
            </Button>
            
            <Link href="/signin">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>
            
            <p className="text-sm text-slate-400">
              Need a new verification email?{" "}
              <Link href="/resend-verification" className="text-emerald-400 hover:text-emerald-300 underline">
                Request one here
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
} 