"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Mail, Lock, Eye, EyeOff, User, Globe, Smartphone, Gift, AlertCircle } from "lucide-react"
import Link from "next/link"
import { logger } from "@/lib/logger"

type Country = {
  id: string
  name: string
  code: string
  flagEmoji: string
  currencySymbol: string
  currencyCode: string
}

export function SignUpForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [countries, setCountries] = useState<Country[]>([])
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    countryId: "",
    password: "",
    confirmPassword: "",
    terms: false,
    marketing: false,
  })

  // Load countries on component mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        // For now, we'll use static countries. In production, you'd fetch from your API
        const staticCountries: Country[] = [
          { id: "ke", name: "Kenya", code: "KE", flagEmoji: "🇰🇪", currencySymbol: "KES", currencyCode: "KES" },
          { id: "ng", name: "Nigeria", code: "NG", flagEmoji: "🇳🇬", currencySymbol: "₦", currencyCode: "NGN" },
          { id: "za", name: "South Africa", code: "ZA", flagEmoji: "🇿🇦", currencySymbol: "R", currencyCode: "ZAR" },
          { id: "gh", name: "Ghana", code: "GH", flagEmoji: "🇬🇭", currencySymbol: "₵", currencyCode: "GHS" },
          { id: "ug", name: "Uganda", code: "UG", flagEmoji: "🇺🇬", currencySymbol: "USh", currencyCode: "UGX" },
          { id: "tz", name: "Tanzania", code: "TZ", flagEmoji: "🇹🇿", currencySymbol: "TSh", currencyCode: "TZS" },
        ]
        setCountries(staticCountries)
        setFormData((prev) => ({ ...prev, countryId: "ke" })) // Default to Kenya
      } catch (error) {
        console.error("Failed to load countries:", error)
      }
    }

    loadCountries()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleCountryChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      countryId: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate form
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long")
      return
    }

    if (!formData.terms) {
      setError("You must agree to the Terms of Service")
      return
    }

    setIsLoading(true)

    try {
      logger.info("Attempting sign up", {
        tags: ["auth", "signup"],
        data: { email: formData.email, countryId: formData.countryId },
      })

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          countryId: formData.countryId,
          marketingConsent: formData.marketing,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        logger.error("Sign up failed", {
          tags: ["auth", "signup"],
          data: { email: formData.email, status: response.status },
        })
        throw new Error(data.error || "Registration failed")
      }

      logger.info("Sign up successful", {
        tags: ["auth", "signup"],
        data: { email: formData.email, userId: data.user.id },
      })

      // Store user session in localStorage for client-side access
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(data.user))
      }

      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      logger.error("Sign up error", {
        tags: ["auth", "signup"],
        error: err instanceof Error ? err : undefined,
        data: { email: formData.email },
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setError("")
    setIsLoading(true)

    try {
      // Simulate Google OAuth flow
      logger.info("Attempting Google sign up", { tags: ["auth", "google-signup"] })

      await new Promise((resolve) => setTimeout(resolve, 1500))

      const mockGoogleUser = {
        id: "google_" + Date.now(),
        email: "user@gmail.com",
        fullName: "Google User",
        countryId: "ke",
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(mockGoogleUser))
      }

      logger.info("Google sign up successful", { tags: ["auth", "google-signup"] })
      router.push("/dashboard")
    } catch (err) {
      setError("Google sign up failed. Please try again.")
      logger.error("Google sign up error", {
        tags: ["auth", "google-signup"],
        error: err instanceof Error ? err : undefined,
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
          <span className="text-2xl font-bold text-white">AI Tipster</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Join AI Tipster</h1>
        <p className="text-slate-300">Start winning with AI-powered predictions</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-md flex items-center text-red-200">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

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
                name="name"
                type="text"
                placeholder="Enter your full name"
                className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                value={formData.name}
                onChange={handleChange}
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
                name="email"
                type="email"
                placeholder="Enter your email"
                className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Country Selection */}
          <div className="space-y-2">
            <Label htmlFor="country" className="text-slate-300">
              Country
            </Label>
            <Select value={formData.countryId} onValueChange={handleCountryChange}>
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.id} value={country.id}>
                    {country.flagEmoji} {country.name}
                  </SelectItem>
                ))}
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
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                className="pl-10 pr-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                value={formData.password}
                onChange={handleChange}
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
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                className="pl-10 pr-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                value={formData.confirmPassword}
                onChange={handleChange}
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
            <Checkbox
              id="terms"
              name="terms"
              className="mt-1"
              checked={formData.terms}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, terms: checked === true }))}
            />
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
            <Checkbox
              id="marketing"
              name="marketing"
              className="mt-1"
              checked={formData.marketing}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, marketing: checked === true }))}
            />
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
            <Button
              type="button"
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={handleGoogleSignUp}
              disabled={isLoading}
            >
              <Globe className="w-4 h-4 mr-2" />
              Google
            </Button>
            <Button type="button" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
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
