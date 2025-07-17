"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AdvancedBreadcrumb } from "@/components/advanced-breadcrumb"
import { 
  Globe, 
  MapPin, 
  DollarSign, 
  Users, 
  TrendingUp,
  Flag,
  Clock,
  Wifi
} from "lucide-react"

interface CountryData {
  code: string
  name: string
  flag: string
  currency: string
  currencySymbol: string
  isSupported: boolean
  detectedFrom: string
}

interface PricingData {
  price: number
  originalPrice: number
  currencyCode: string
  currencySymbol: string
  source: string
}

export default function GeoDemoPage() {
  const [countryData, setCountryData] = useState<CountryData | null>(null)
  const [pricingData, setPricingData] = useState<PricingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const detectCountry = async () => {
      try {
        setIsLoading(true)
        
        // Fetch country data from our API
        const response = await fetch('/api/user/country')
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setCountryData(result.country)
            
            // Get pricing for this country
            const pricingResponse = await fetch(`/api/homepage/pricing?country=${result.country.code}`)
            if (pricingResponse.ok) {
              const pricingResult = await pricingResponse.json()
              if (pricingResult.success && pricingResult.pricing.length > 0) {
                setPricingData(pricingResult.pricing[0])
              }
            }
          }
        }
      } catch (err) {
        setError('Failed to detect country')
        console.error('Country detection error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    detectCountry()
  }, [])

  const targetCountries = [
    // African Markets (Strong betting culture)
    { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES', currencySymbol: 'KES' },
    { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', currencySymbol: '₦' },
    { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', currencySymbol: 'R' },
    { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'GHS', currencySymbol: '₵' },
    { code: 'UG', name: 'Uganda', flag: '🇺🇬', currency: 'UGX', currencySymbol: 'USh' },
    { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', currency: 'TZS', currencySymbol: 'TSh' },
    
    // Major Football Nations (Strong betting culture)
    { code: 'BR', name: 'Brazil', flag: '🇧🇷', currency: 'BRL', currencySymbol: 'R$' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷', currency: 'ARS', currencySymbol: '$' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽', currency: 'MXN', currencySymbol: '$' },
    { code: 'CO', name: 'Colombia', flag: '🇨🇴', currency: 'COP', currencySymbol: '$' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱', currency: 'CLP', currencySymbol: '$' },
    { code: 'PE', name: 'Peru', flag: '🇵🇪', currency: 'PEN', currencySymbol: 'S/' },
    { code: 'VE', name: 'Venezuela', flag: '🇻🇪', currency: 'VES', currencySymbol: 'Bs' },
    { code: 'UY', name: 'Uruguay', flag: '🇺🇾', currency: 'UYU', currencySymbol: '$' },
    { code: 'PY', name: 'Paraguay', flag: '🇵🇾', currency: 'PYG', currencySymbol: '₲' },
    { code: 'BO', name: 'Bolivia', flag: '🇧🇴', currency: 'BOB', currencySymbol: 'Bs' },
    { code: 'EC', name: 'Ecuador', flag: '🇪🇨', currency: 'USD', currencySymbol: '$' },
    
    // European Markets (Major football nations)
    { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', currencySymbol: '$' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', currencySymbol: '£' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR', currencySymbol: '€' },
    { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR', currencySymbol: '€' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹', currency: 'EUR', currencySymbol: '€' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸', currency: 'EUR', currencySymbol: '€' },
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: 'EUR', currencySymbol: '€' },
    { code: 'PT', name: 'Portugal', flag: '🇵🇹', currency: 'EUR', currencySymbol: '€' },
    { code: 'BE', name: 'Belgium', flag: '🇧🇪', currency: 'EUR', currencySymbol: '€' },
    { code: 'AT', name: 'Austria', flag: '🇦🇹', currency: 'EUR', currencySymbol: '€' },
    { code: 'CH', name: 'Switzerland', flag: '🇨🇭', currency: 'CHF', currencySymbol: 'CHF' },
    { code: 'SE', name: 'Sweden', flag: '🇸🇪', currency: 'SEK', currencySymbol: 'kr' },
    { code: 'NO', name: 'Norway', flag: '🇳🇴', currency: 'NOK', currencySymbol: 'kr' },
    { code: 'DK', name: 'Denmark', flag: '🇩🇰', currency: 'DKK', currencySymbol: 'kr' },
    { code: 'FI', name: 'Finland', flag: '🇫🇮', currency: 'EUR', currencySymbol: '€' },
    { code: 'PL', name: 'Poland', flag: '🇵🇱', currency: 'PLN', currencySymbol: 'zł' },
    { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', currency: 'CZK', currencySymbol: 'Kč' },
    { code: 'HU', name: 'Hungary', flag: '🇭🇺', currency: 'HUF', currencySymbol: 'Ft' },
    { code: 'RO', name: 'Romania', flag: '🇷🇴', currency: 'RON', currencySymbol: 'lei' },
    { code: 'BG', name: 'Bulgaria', flag: '🇧🇬', currency: 'BGN', currencySymbol: 'лв' },
    { code: 'HR', name: 'Croatia', flag: '🇭🇷', currency: 'EUR', currencySymbol: '€' },
    { code: 'RS', name: 'Serbia', flag: '🇷🇸', currency: 'RSD', currencySymbol: 'дин' },
    { code: 'SI', name: 'Slovenia', flag: '🇸🇮', currency: 'EUR', currencySymbol: '€' },
    { code: 'SK', name: 'Slovakia', flag: '🇸🇰', currency: 'EUR', currencySymbol: '€' },
    { code: 'IE', name: 'Ireland', flag: '🇮🇪', currency: 'EUR', currencySymbol: '€' },
    
    // Asian Markets (Strong betting culture)
    { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', currencySymbol: '₹' },
    { code: 'PH', name: 'Philippines', flag: '🇵🇭', currency: 'PHP', currencySymbol: '₱' },
    { code: 'TH', name: 'Thailand', flag: '🇹🇭', currency: 'THB', currencySymbol: '฿' },
    { code: 'MY', name: 'Malaysia', flag: '🇲🇾', currency: 'MYR', currencySymbol: 'RM' },
    { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: 'SGD', currencySymbol: 'S$' },
    { code: 'ID', name: 'Indonesia', flag: '🇮🇩', currency: 'IDR', currencySymbol: 'Rp' },
    { code: 'VN', name: 'Vietnam', flag: '🇻🇳', currency: 'VND', currencySymbol: '₫' },
    { code: 'KR', name: 'South Korea', flag: '🇰🇷', currency: 'KRW', currencySymbol: '₩' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY', currencySymbol: '¥' },
    { code: 'CN', name: 'China', flag: '🇨🇳', currency: 'CNY', currencySymbol: '¥' },
    { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', currency: 'HKD', currencySymbol: 'HK$' },
    { code: 'TW', name: 'Taiwan', flag: '🇹🇼', currency: 'TWD', currencySymbol: 'NT$' },
    { code: 'AE', name: 'UAE', flag: '🇦🇪', currency: 'AED', currencySymbol: 'د.إ' },
    { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', currency: 'SAR', currencySymbol: 'ر.س' },
    { code: 'QA', name: 'Qatar', flag: '🇶🇦', currency: 'QAR', currencySymbol: 'ر.ق' },
    { code: 'KW', name: 'Kuwait', flag: '🇰🇼', currency: 'KWD', currencySymbol: 'د.ك' },
    { code: 'BH', name: 'Bahrain', flag: '🇧🇭', currency: 'BHD', currencySymbol: '.د.ب' },
    { code: 'OM', name: 'Oman', flag: '🇴🇲', currency: 'OMR', currencySymbol: 'ر.ع.' },
    { code: 'JO', name: 'Jordan', flag: '🇯🇴', currency: 'JOD', currencySymbol: 'د.ا' },
    { code: 'LB', name: 'Lebanon', flag: '🇱🇧', currency: 'LBP', currencySymbol: 'ل.ل' },
    { code: 'IL', name: 'Israel', flag: '🇮🇱', currency: 'ILS', currencySymbol: '₪' },
    { code: 'TR', name: 'Turkey', flag: '🇹🇷', currency: 'TRY', currencySymbol: '₺' },
    
    // Americas & Oceania
    { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', currencySymbol: 'C$' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD', currencySymbol: 'A$' },
    { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', currency: 'NZD', currencySymbol: 'NZ$' },
    { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', currency: 'CRC', currencySymbol: '₡' },
    { code: 'PA', name: 'Panama', flag: '🇵🇦', currency: 'PAB', currencySymbol: 'B/.' },
    { code: 'GT', name: 'Guatemala', flag: '🇬🇹', currency: 'GTQ', currencySymbol: 'Q' },
    { code: 'SV', name: 'El Salvador', flag: '🇸🇻', currency: 'USD', currencySymbol: '$' },
    { code: 'HN', name: 'Honduras', flag: '🇭🇳', currency: 'HNL', currencySymbol: 'L' },
    { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', currency: 'NIO', currencySymbol: 'C$' },
    { code: 'BZ', name: 'Belize', flag: '🇧🇿', currency: 'BZD', currencySymbol: 'BZ$' },
    { code: 'JM', name: 'Jamaica', flag: '🇯🇲', currency: 'JMD', currencySymbol: 'J$' },
    { code: 'TT', name: 'Trinidad & Tobago', flag: '🇹🇹', currency: 'TTD', currencySymbol: 'TT$' },
    { code: 'BB', name: 'Barbados', flag: '🇧🇧', currency: 'BBD', currencySymbol: 'Bds$' },
    { code: 'GD', name: 'Grenada', flag: '🇬🇩', currency: 'XCD', currencySymbol: 'EC$' },
    { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨', currency: 'XCD', currencySymbol: 'EC$' },
    { code: 'VC', name: 'Saint Vincent', flag: '🇻🇨', currency: 'XCD', currencySymbol: 'EC$' },
    { code: 'AG', name: 'Antigua & Barbuda', flag: '🇦🇬', currency: 'XCD', currencySymbol: 'EC$' },
    { code: 'DM', name: 'Dominica', flag: '🇩🇲', currency: 'XCD', currencySymbol: 'EC$' },
    { code: 'KN', name: 'Saint Kitts & Nevis', flag: '🇰🇳', currency: 'XCD', currencySymbol: 'EC$' },
    { code: 'HT', name: 'Haiti', flag: '🇭🇹', currency: 'HTG', currencySymbol: 'G' },
    { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', currency: 'DOP', currencySymbol: 'RD$' },
    { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷', currency: 'USD', currencySymbol: '$' },
    { code: 'CU', name: 'Cuba', flag: '🇨🇺', currency: 'CUP', currencySymbol: '$' },
    { code: 'BS', name: 'Bahamas', flag: '🇧🇸', currency: 'BSD', currencySymbol: 'B$' },
    { code: 'TC', name: 'Turks & Caicos', flag: '🇹🇨', currency: 'USD', currencySymbol: '$' },
    { code: 'AI', name: 'Anguilla', flag: '🇦🇮', currency: 'XCD', currencySymbol: 'EC$' },
    { code: 'VG', name: 'British Virgin Islands', flag: '🇻🇬', currency: 'USD', currencySymbol: '$' },
    { code: 'VI', name: 'U.S. Virgin Islands', flag: '🇻🇮', currency: 'USD', currencySymbol: '$' },
    { code: 'AW', name: 'Aruba', flag: '🇦🇼', currency: 'AWG', currencySymbol: 'ƒ' },
    { code: 'CW', name: 'Curaçao', flag: '🇨🇼', currency: 'ANG', currencySymbol: 'ƒ' },
    { code: 'SX', name: 'Sint Maarten', flag: '🇸🇽', currency: 'ANG', currencySymbol: 'ƒ' },
    { code: 'BQ', name: 'Caribbean Netherlands', flag: '🇧🇶', currency: 'USD', currencySymbol: '$' },
    { code: 'BL', name: 'Saint Barthélemy', flag: '🇧🇱', currency: 'EUR', currencySymbol: '€' },
    { code: 'MF', name: 'Saint Martin', flag: '🇲🇫', currency: 'EUR', currencySymbol: '€' },
    { code: 'GP', name: 'Guadeloupe', flag: '🇬🇵', currency: 'EUR', currencySymbol: '€' },
    { code: 'MQ', name: 'Martinique', flag: '🇲🇶', currency: 'EUR', currencySymbol: '€' },
    { code: 'RE', name: 'Réunion', flag: '🇷🇪', currency: 'EUR', currencySymbol: '€' },
    { code: 'YT', name: 'Mayotte', flag: '🇾🇹', currency: 'EUR', currencySymbol: '€' },
    { code: 'NC', name: 'New Caledonia', flag: '🇳🇨', currency: 'XPF', currencySymbol: '₣' },
    { code: 'PF', name: 'French Polynesia', flag: '🇵🇫', currency: 'XPF', currencySymbol: '₣' },
    { code: 'WF', name: 'Wallis & Futuna', flag: '🇼🇫', currency: 'XPF', currencySymbol: '₣' },
    { code: 'TK', name: 'Tokelau', flag: '🇹🇰', currency: 'NZD', currencySymbol: 'NZ$' },
    { code: 'NU', name: 'Niue', flag: '🇳🇺', currency: 'NZD', currencySymbol: 'NZ$' },
    { code: 'CK', name: 'Cook Islands', flag: '🇨🇰', currency: 'NZD', currencySymbol: 'NZ$' },
    { code: 'WS', name: 'Samoa', flag: '🇼🇸', currency: 'WST', currencySymbol: 'T' },
    { code: 'TO', name: 'Tonga', flag: '🇹🇴', currency: 'TOP', currencySymbol: 'T$' },
    { code: 'FJ', name: 'Fiji', flag: '🇫🇯', currency: 'FJD', currencySymbol: 'FJ$' },
    { code: 'VU', name: 'Vanuatu', flag: '🇻🇺', currency: 'VUV', currencySymbol: 'VT' },
    { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧', currency: 'SBD', currencySymbol: 'SI$' },
    { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬', currency: 'PGK', currencySymbol: 'K' },
    { code: 'PW', name: 'Palau', flag: '🇵🇼', currency: 'USD', currencySymbol: '$' },
    { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭', currency: 'USD', currencySymbol: '$' },
    { code: 'FM', name: 'Micronesia', flag: '🇫🇲', currency: 'USD', currencySymbol: '$' },
    { code: 'MP', name: 'Northern Mariana Islands', flag: '🇲🇵', currency: 'USD', currencySymbol: '$' },
    { code: 'GU', name: 'Guam', flag: '🇬🇺', currency: 'USD', currencySymbol: '$' },
    { code: 'AS', name: 'American Samoa', flag: '🇦🇸', currency: 'USD', currencySymbol: '$' }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <AdvancedBreadcrumb />
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
            <p className="text-slate-300">Detecting your location...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Globe className="w-12 h-12 text-emerald-400 mr-3" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">Geo-Location System Demo</h1>
          </div>
          <p className="text-xl text-slate-300 mb-8">
            See how SnapBet AI automatically detects your location and provides localized content and pricing
          </p>
        </div>

        {/* Current Location Detection */}
        {countryData && (
          <Card className="bg-slate-800 border-slate-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-emerald-400" />
                Your Detected Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl mb-2">{countryData.flag}</div>
                  <h3 className="text-xl font-bold text-white">{countryData.name}</h3>
                  <p className="text-slate-400">Country</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400 mb-2">
                    {countryData.currencySymbol} {countryData.currency}
                  </div>
                  <p className="text-slate-400">Currency</p>
                </div>
                <div className="text-center">
                  <Badge className={countryData.isSupported ? 
                    "bg-green-500/20 text-green-400 border-green-500/30" : 
                    "bg-orange-500/20 text-orange-400 border-orange-500/30"
                  }>
                    {countryData.isSupported ? 'Supported' : 'Limited Support'}
                  </Badge>
                  <p className="text-slate-400 mt-2">Status</p>
                </div>
              </div>
              <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
                <p className="text-slate-300 text-sm">
                  <strong>Detection Method:</strong> {countryData.detectedFrom}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Example */}
        {pricingData && (
          <Card className="bg-slate-800 border-slate-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-emerald-400" />
                Localized Pricing Example
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Single Prediction</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-emerald-400">
                      {pricingData.currencySymbol}{pricingData.price}
                    </span>
                    {pricingData.originalPrice > pricingData.price && (
                      <span className="text-slate-400 line-through">
                        {pricingData.currencySymbol}{pricingData.originalPrice}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mt-1">Local currency pricing</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Data Source</h4>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {pricingData.source}
                  </Badge>
                  <p className="text-slate-400 text-sm mt-1">Pricing configuration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card className="bg-slate-800 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Wifi className="w-5 h-5 mr-2 text-emerald-400" />
              How Geo-Location Detection Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <MapPin className="w-6 h-6 text-blue-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">1. IP Detection</h4>
                <p className="text-slate-400 text-sm">
                  Automatically detect your country from your IP address using geolocation services
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-green-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">2. User Preference</h4>
                <p className="text-slate-400 text-sm">
                  Use your account settings or manual country selection as the primary source
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">3. Localized Content</h4>
                <p className="text-slate-400 text-sm">
                  Serve country-specific pricing, content, and features based on your location
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Target Countries */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Flag className="w-5 h-5 mr-2 text-emerald-400" />
              Supported Countries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {targetCountries.map((country) => (
                <div key={country.code} className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <div className="text-2xl mb-2">{country.flag}</div>
                  <h4 className="font-semibold text-white">{country.name}</h4>
                  <p className="text-slate-400 text-sm">{country.currencySymbol} {country.currency}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/20 mt-8">
            <CardContent className="p-6">
              <p className="text-red-400 text-center">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 