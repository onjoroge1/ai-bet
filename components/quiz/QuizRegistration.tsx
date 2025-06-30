"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { PhoneInput } from "@/components/landing/phone-input"
import { User, Mail, Phone, Gift } from "lucide-react"
import type { CountryPricing } from "@/lib/country-pricing"

interface QuizRegistrationProps {
  onComplete: (userData: {
    name: string
    email: string
    phone: string
    bettingExperience: string
  }) => void
  referralCode?: string
  countryData: CountryPricing | null
}

export function QuizRegistration({ onComplete, referralCode, countryData }: QuizRegistrationProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    consent: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email"
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required"
    }

    if (!formData.consent) {
      newErrors.consent = "You must agree to receive communications"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onComplete({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        bettingExperience: "",
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-slate-800/50 border-slate-700">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Badge className="bg-emerald-500/20 text-emerald-400">Step 1 of 4</Badge>
            {referralCode && (
              <Badge className="bg-yellow-500/20 text-yellow-400">
                <Gift className="w-3 h-3 mr-1" />
                Bonus Points!
              </Badge>
            )}
          </div>
          <CardTitle className="text-2xl text-white">Join the Quiz Challenge</CardTitle>
          <p className="text-slate-400">Register to start earning points and winning prizes</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white flex items-center">
                <User className="w-4 h-4 mr-2" />
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your full name"
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
              />
              {errors.name && <p className="text-red-400 text-sm">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter your email address"
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
              />
              {errors.email && <p className="text-red-400 text-sm">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-white flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                Phone Number
              </Label>
              <PhoneInput
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder="Enter your phone number"
              />
              {errors.phone && <p className="text-red-400 text-sm">{errors.phone}</p>}
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="consent"
                checked={formData.consent}
                onCheckedChange={(checked) => setFormData({ ...formData, consent: checked as boolean })}
                className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
              <Label htmlFor="consent" className="text-sm text-slate-300 leading-relaxed">
                I agree to receive SnapBet tips, quiz updates, and promotional offers via SMS, WhatsApp, and email. I
                can opt out anytime. I confirm I am 18+ years old.
              </Label>
            </div>
            {errors.consent && <p className="text-red-400 text-sm">{errors.consent}</p>}

            {referralCode && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Gift className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-emerald-400 font-semibold">Referral Bonus!</p>
                    <p className="text-emerald-300 text-sm">
                      You'll get 10 bonus points for being referred by a friend
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white py-3"
            >
              Continue to Quiz
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 