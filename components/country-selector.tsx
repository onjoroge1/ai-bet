"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Globe, MapPin } from "lucide-react"
import { countryPricing } from "@/lib/country-pricing"

interface CountrySelectorProps {
  selectedCountry: string
  onCountryChange: (country: string) => void
  showCard?: boolean
}

export function CountrySelector({ selectedCountry, onCountryChange, showCard = true }: CountrySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const currentCountry = countryPricing[selectedCountry]

  const countries = Object.entries(countryPricing).map(([key, country]) => ({
    key,
    ...country,
  }))

  if (!showCard) {
    return (
      <Select value={selectedCountry} onValueChange={onCountryChange}>
        <SelectTrigger className="w-48 bg-slate-800/50 border-slate-600 text-white">
          <SelectValue>
            <div className="flex items-center space-x-2">
              <span className="text-lg">{currentCountry?.flag}</span>
              <span>{currentCountry?.name}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {countries.map((country) => (
            <SelectItem key={country.key} value={country.key}>
              <div className="flex items-center space-x-2">
                <span className="text-lg">{country.flag}</span>
                <span>{country.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-4 mb-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
        <div className="flex items-center space-x-3 mb-4 md:mb-0">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Choose Your Country</h3>
            <p className="text-slate-400 text-sm">Get localized pricing and payment methods</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300 text-sm">Currently viewing:</span>
          </div>

          <Select value={selectedCountry} onValueChange={onCountryChange}>
            <SelectTrigger className="w-48 bg-slate-900/50 border-slate-600 text-white">
              <SelectValue>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{currentCountry?.flag}</span>
                  <span>{currentCountry?.name}</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">{currentCountry?.currencySymbol}</Badge>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.key} value={country.key}>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{country.flag}</span>
                    <span>{country.name}</span>
                    <Badge className="bg-slate-600 text-slate-300 text-xs">{country.currencySymbol}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Market Context */}
      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{currentCountry?.flag}</span>
          <span className="text-emerald-400 font-medium">{currentCountry?.brandName}</span>
        </div>
        <p className="text-slate-400 text-sm mt-1">{currentCountry?.marketContext}</p>
      </div>
    </Card>
  )
}
