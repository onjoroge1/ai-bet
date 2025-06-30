"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronDown, Phone } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CountryCode {
  code: string
  dialCode: string
  flag: string
  name: string
}

const commonCountries: CountryCode[] = [
  { code: "US", dialCode: "+1", flag: "🇺🇸", name: "United States" },
  { code: "GB", dialCode: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "CA", dialCode: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "AU", dialCode: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "DE", dialCode: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "FR", dialCode: "+33", flag: "🇫🇷", name: "France" },
  { code: "IT", dialCode: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "ES", dialCode: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "BR", dialCode: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "MX", dialCode: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "IN", dialCode: "+91", flag: "🇮🇳", name: "India" },
  { code: "CN", dialCode: "+86", flag: "🇨🇳", name: "China" },
  { code: "JP", dialCode: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "KR", dialCode: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "NG", dialCode: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "ZA", dialCode: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "EG", dialCode: "+20", flag: "🇪🇬", name: "Egypt" },
  { code: "KE", dialCode: "+254", flag: "🇰🇪", name: "Kenya" },
]

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function PhoneInput({ 
  value, 
  onChange, 
  placeholder = "Enter phone number", 
  className = "",
  disabled = false 
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(commonCountries[0])
  const [phoneNumber, setPhoneNumber] = useState("")

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPhoneNumber = e.target.value.replace(/\D/g, "")
    setPhoneNumber(newPhoneNumber)
    onChange(`${selectedCountry.dialCode}${newPhoneNumber}`)
  }

  const handleCountrySelect = (country: CountryCode) => {
    setSelectedCountry(country)
    onChange(`${country.dialCode}${phoneNumber}`)
  }

  return (
    <div className={`flex ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="rounded-r-none border-r-0 px-3 h-10 bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
            disabled={disabled}
          >
            <span className="mr-2">{selectedCountry.flag}</span>
            <span className="text-sm">{selectedCountry.dialCode}</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 max-h-60 overflow-y-auto bg-slate-800 border-slate-600">
          {commonCountries.map((country) => (
            <DropdownMenuItem
              key={country.code}
              onClick={() => handleCountrySelect(country)}
              className="flex items-center space-x-3 text-white hover:bg-slate-700 cursor-pointer"
            >
              <span className="text-lg">{country.flag}</span>
              <span className="flex-1">{country.name}</span>
              <span className="text-slate-400">{country.dialCode}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Input
        type="tel"
        value={phoneNumber}
        onChange={handlePhoneChange}
        placeholder={placeholder}
        className="rounded-l-none border-l-0 h-10 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-slate-500"
        disabled={disabled}
      />
    </div>
  )
} 