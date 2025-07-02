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
import { TrendingUp, Mail, Lock, Eye, EyeOff, User, Globe, Smartphone, Gift } from "lucide-react"
import Link from "next/link"
import { checkPasswordStrength, PASSWORD_REQUIREMENTS } from "@/lib/auth/password"
import { Progress } from "@/components/ui/progress"

interface Country {
  id: string
  code: string
  name: string
  flagEmoji: string
  currencyCode: string
  currencySymbol: string
  isActive: boolean
  isSupported?: boolean
}

export function SignUpForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; feedback: string[] }>({ score: 0, feedback: [] })
  const [countries, setCountries] = useState<Country[]>([])
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    countryCode: "",
    terms: false,
    marketing: false
  })

  // Load countries on component mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await fetch('/api/countries')
        
        if (response.ok) {
          const countriesData = await response.json()
          
          // Add isSupported field to each country (default to true for active countries)
          const countriesWithSupport = countriesData.map((country: any) => ({
            ...country,
            isSupported: country.isActive !== false
          }))
          
          setCountries(countriesWithSupport)
          // Set default country to first available
          if (countriesWithSupport.length > 0) {
            setFormData(prev => ({ ...prev, countryCode: countriesWithSupport[0].code }))
          }
        } else {
          // Fallback to static countries if API fails
          const staticCountries: Country[] = [
            { id: "country_us", name: "United States", code: "us", flagEmoji: "🇺🇸", currencySymbol: "$", currencyCode: "USD", isActive: true, isSupported: true },
            { id: "country_ke", name: "Kenya", code: "ke", flagEmoji: "🇰🇪", currencySymbol: "KES", currencyCode: "KES", isActive: true, isSupported: true },
            { id: "country_ng", name: "Nigeria", code: "ng", flagEmoji: "🇳🇬", currencySymbol: "₦", currencyCode: "NGN", isActive: true, isSupported: true },
            { id: "country_za", name: "South Africa", code: "za", flagEmoji: "🇿🇦", currencySymbol: "R", currencyCode: "ZAR", isActive: true, isSupported: true },
            { id: "country_gh", name: "Ghana", code: "gh", flagEmoji: "🇬🇭", currencySymbol: "₵", currencyCode: "GHS", isActive: true, isSupported: true },
            { id: "country_ug", name: "Uganda", code: "ug", flagEmoji: "🇺🇬", currencySymbol: "USh", currencyCode: "UGX", isActive: true, isSupported: true },
            { id: "country_tz", name: "Tanzania", code: "tz", flagEmoji: "🇹🇿", currencySymbol: "TSh", currencyCode: "TZS", isActive: true, isSupported: true },
            { id: "country_in", name: "India", code: "in", flagEmoji: "🇮🇳", currencySymbol: "₹", currencyCode: "INR", isActive: true, isSupported: true },
            { id: "country_ph", name: "Philippines", code: "ph", flagEmoji: "🇵🇭", currencySymbol: "₱", currencyCode: "PHP", isActive: true, isSupported: true },
            { id: "country_gb", name: "United Kingdom", code: "gb", flagEmoji: "🇬🇧", currencySymbol: "£", currencyCode: "GBP", isActive: true, isSupported: true },
          ]
          setCountries(staticCountries)
          setFormData(prev => ({ ...prev, countryCode: staticCountries[0].code }))
        }
      } catch (error) {
        console.error("Failed to load countries:", error)
        // Set a default country if everything fails
        setFormData(prev => ({ ...prev, countryCode: "us" }))
      }
    }

    loadCountries()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))

    // Check password strength when password changes
    if (name === 'password') {
      const strength = checkPasswordStrength(value)
      setPasswordStrength(strength)
    }
  }

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }))
  }

  const handleCountryChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      countryCode: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Validate required fields
    if (!formData.name || !formData.email || !formData.password || !formData.countryCode) {
      setError("Please fill in all required fields")
      setIsLoading(false)
      return
    }

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

    // Validate terms accepted
    if (!formData.terms) {
      setError("You must accept the terms and conditions")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          countryCode: formData.countryCode,
          marketingConsent: formData.marketing,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
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
        <h1 className="text-3xl font-bold text-white mb-2">Join SnapBet</h1>
        <p className="text-slate-300">Start winning with AI-powered predictions</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
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
                required
                value={formData.name}
                onChange={handleChange}
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
                required
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Country Selection */}
          <div className="space-y-2">
            <Label htmlFor="country" className="text-slate-300">
              Country <span className="text-red-400">*</span>
            </Label>
            <Select
              value={formData.countryCode}
              onValueChange={handleCountryChange}
              required
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-600">
                {countries.map((country) => (
                  <SelectItem 
                    key={country.id} 
                    value={country.code}
                    className="text-white hover:bg-slate-800 focus:bg-slate-800"
                  >
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
                required
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                required
                value={formData.confirmPassword}
                onChange={handleChange}
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
              checked={formData.terms}
              onCheckedChange={(checked) => handleCheckboxChange('terms', checked as boolean)}
            />
            <Label htmlFor="terms" className="text-slate-300 text-sm">
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

          {/* Marketing Preferences */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="marketing"
              name="marketing"
              checked={formData.marketing}
              onCheckedChange={(checked) => handleCheckboxChange('marketing', checked as boolean)}
            />
            <Label htmlFor="marketing" className="text-slate-300 text-sm">
              I want to receive updates about new features and promotions
            </Label>
          </div>

          {/* Sign Up Button */}
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>

          {/* Sign In Link */}
          <div className="text-center">
            <p className="text-slate-400">
              Already have an account?{" "}
              <Link href="/signin" className="text-emerald-400 hover:text-emerald-300 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </Card>
    </div>
  )
}
