export interface CountryPricing {
  code: string
  name: string
  flag: string
  currency: string
  currencySymbol: string
  brandName: string
  tagline: string
  plans: {
    free: {
      name: string
      price: string
      features: string[]
    }
    vip: {
      name: string
      price: string
      originalPrice?: string
      popular: boolean
      features: string[]
    }
    pro: {
      name: string
      price: string
      features: string[]
    }
  }
  flexibleOptions: {
    name: string
    price: string
    description: string
  }[]
  paymentMethods: string[]
  globalPaymentMethods: string[]
  marketContext: string
}

export const countryPricing: Record<string, CountryPricing> = {
  nigeria: {
    code: "NG",
    name: "Nigeria",
    flag: "🇳🇬",
    currency: "NGN",
    currencySymbol: "₦",
    brandName: "Betting Giant Package",
    tagline: "Nigeria's #1 AI Betting Platform",
    plans: {
      free: {
        name: "Free",
        price: "₦0",
        features: ["3 free predictions daily", "Basic AI analysis", "Community access", "Mobile app access"],
      },
      vip: {
        name: "Naija VIP",
        price: "₦4,800",
        popular: true,
        features: [
          "Unlimited predictions",
          "Advanced AI analysis",
          "Confidence scores",
          "Telegram alerts",
          "Priority support",
          "Historical data",
          "EPL & Nigerian League coverage",
        ],
      },
      pro: {
        name: "Super Eagles Pro",
        price: "₦12,000",
        features: [
          "Everything in VIP",
          "Multi-league coverage",
          "Live predictions",
          "Custom strategies",
          "API access",
          "AFCON specials",
          "International tournaments",
        ],
      },
    },
    flexibleOptions: [
      { name: "Single Tip", price: "₦200", description: "One premium prediction" },
      { name: "Weekend Combo", price: "₦800", description: "Weekend matches bundle" },
      { name: "EPL Gameweek", price: "₦1,500", description: "Full Premier League gameweek" },
      { name: "AFCON Special", price: "₦8,000", description: "Complete tournament coverage" },
    ],
    paymentMethods: ["Opay", "PalmPay", "Kuda Bank", "Paystack", "Bank Transfer"],
    globalPaymentMethods: ["Visa/Mastercard", "PayPal", "Stripe"],
    marketContext: "168.7M bettors, highest volume globally",
  },

  "south-africa": {
    code: "ZA",
    name: "South Africa",
    flag: "🇿🇦",
    currency: "ZAR",
    currencySymbol: "R",
    brandName: "Boks & Goals Premium",
    tagline: "South Africa's Premium Betting Intelligence",
    plans: {
      free: {
        name: "Free",
        price: "R0",
        features: ["3 free predictions daily", "Basic AI analysis", "Community access", "Mobile app access"],
      },
      vip: {
        name: "Springbok VIP",
        price: "R180",
        popular: true,
        features: [
          "Unlimited predictions",
          "Advanced AI analysis",
          "Confidence scores",
          "WhatsApp alerts",
          "Priority support",
          "Historical data",
          "PSL & Rugby coverage",
        ],
      },
      pro: {
        name: "Rainbow Pro",
        price: "R360",
        features: [
          "Everything in VIP",
          "Multi-sport coverage",
          "Live predictions",
          "Custom strategies",
          "API access",
          "Rugby World Cup specials",
          "Cricket & Soccer combined",
        ],
      },
    },
    flexibleOptions: [
      { name: "Premium Tip", price: "R15", description: "Single premium prediction" },
      { name: "Weekend Warriors", price: "R60", description: "Weekend sports bundle" },
      { name: "Derby Day Special", price: "R45", description: "Local derby matches" },
      { name: "Rugby World Cup", price: "R500", description: "Complete tournament package" },
    ],
    paymentMethods: ["SnapScan", "Zapper", "Bank EFT", "Capitec Pay", "FNB Pay"],
    globalPaymentMethods: ["Visa/Mastercard", "PayPal", "Apple Pay", "Google Pay"],
    marketContext: "58.3M bettors, highest income, 90% participation",
  },

  kenya: {
    code: "KE",
    name: "Kenya",
    flag: "🇰🇪",
    currency: "KES",
    currencySymbol: "KES",
    brandName: "Harambee Predictions",
    tagline: "Kenya's Leading SnapBet",
    plans: {
      free: {
        name: "Free",
        price: "KES 0",
        features: ["3 free predictions daily", "Basic AI analysis", "Community access", "Mobile app access"],
      },
      vip: {
        name: "VIP",
        price: "KES 800",
        popular: true,
        features: [
          "Unlimited predictions",
          "Advanced AI analysis",
          "Confidence scores",
          "M-Pesa integration",
          "Priority support",
          "Historical data",
          "KPL & EPL coverage",
        ],
      },
      pro: {
        name: "Global Pro",
        price: "KES 2,000",
        features: [
          "Everything in VIP",
          "Multi-league coverage",
          "Live predictions",
          "Custom strategies",
          "API access",
          "AFCON specials",
          "Global tournaments",
        ],
      },
    },
    flexibleOptions: [
      { name: "Single Tip", price: "KES 100", description: "One premium prediction" },
      { name: "Weekend Package", price: "KES 400", description: "Weekend matches bundle" },
      { name: "Derby Special", price: "KES 300", description: "Local derby coverage" },
      { name: "AFCON Package", price: "KES 2,500", description: "Tournament coverage" },
    ],
    paymentMethods: ["M-Pesa", "Airtel Money", "Equity Bank", "KCB Bank", "Co-op Bank"],
    globalPaymentMethods: ["Visa/Mastercard", "PayPal", "Skrill", "Neteller"],
    marketContext: "25M+ active bettors, M-Pesa dominant",
  },

  uganda: {
    code: "UG",
    name: "Uganda",
    flag: "🇺🇬",
    currency: "UGX",
    currencySymbol: "UGX",
    brandName: "Cranes Betting Intelligence",
    tagline: "Uganda's Smart Betting Platform",
    plans: {
      free: {
        name: "Free",
        price: "UGX 0",
        features: ["3 free predictions daily", "Basic AI analysis", "Community access", "Mobile app access"],
      },
      vip: {
        name: "Cranes VIP",
        price: "UGX 18,000",
        popular: true,
        features: [
          "Unlimited predictions",
          "Advanced AI analysis",
          "Confidence scores",
          "Mobile Money alerts",
          "Priority support",
          "Historical data",
          "FUFA Big League coverage",
        ],
      },
      pro: {
        name: "Pearl Pro",
        price: "UGX 36,000",
        features: [
          "Everything in VIP",
          "Multi-league coverage",
          "Live predictions",
          "Custom strategies",
          "API access",
          "AFCON specials",
          "International coverage",
        ],
      },
    },
    flexibleOptions: [
      { name: "Single Tip", price: "UGX 1,500", description: "Premium single prediction" },
      { name: "FUFA Big League", price: "UGX 6,000", description: "Weekend league coverage" },
      { name: "Derby Package", price: "UGX 4,000", description: "Local derby matches" },
      { name: "AFCON Package", price: "UGX 25,000", description: "Tournament coverage" },
    ],
    paymentMethods: ["MTN Mobile Money", "Airtel Money", "Bank Transfer", "Centenary Bank"],
    globalPaymentMethods: ["Visa/Mastercard", "PayPal", "Western Union"],
    marketContext: "44.7M bettors, 87% participation rate",
  },

  tanzania: {
    code: "TZ",
    name: "Tanzania",
    flag: "🇹🇿",
    currency: "TZS",
    currencySymbol: "TSH",
    brandName: "Simba Predictions",
    tagline: "Tanzania's Premier Betting Intelligence",
    plans: {
      free: {
        name: "Free",
        price: "TSH 0",
        features: ["3 free predictions daily", "Basic AI analysis", "Community access", "Mobile app access"],
      },
      vip: {
        name: "Simba VIP",
        price: "TSH 10,000",
        popular: true,
        features: [
          "Unlimited predictions",
          "Advanced AI analysis",
          "Confidence scores",
          "M-Pesa Tanzania alerts",
          "Priority support",
          "Historical data",
          "NBC Premier League coverage",
        ],
      },
      pro: {
        name: "Kilimanjaro Pro",
        price: "TSH 25,000",
        features: [
          "Everything in VIP",
          "Multi-league coverage",
          "Live predictions",
          "Custom strategies",
          "API access",
          "AFCON specials",
          "International tournaments",
        ],
      },
    },
    flexibleOptions: [
      { name: "Single Tip", price: "TSH 1,000", description: "Premium single prediction" },
      { name: "Dar Derby Special", price: "TSH 4,000", description: "Dar es Salaam derby" },
      { name: "NBC Premier League", price: "TSH 15,000", description: "Full season coverage" },
      { name: "Weekend Bundle", price: "TSH 3,000", description: "Weekend matches" },
    ],
    paymentMethods: ["Vodacom M-Pesa", "Tigo Pesa", "Airtel Money", "CRDB Bank"],
    globalPaymentMethods: ["Visa/Mastercard", "PayPal", "MoneyGram"],
    marketContext: "19.6M bettors, growing urban market",
  },

  ghana: {
    code: "GH",
    name: "Ghana",
    flag: "🇬🇭",
    currency: "GHS",
    currencySymbol: "GHS",
    brandName: "Black Stars Intelligence",
    tagline: "Ghana's AI-Powered Betting Platform",
    plans: {
      free: {
        name: "Free",
        price: "GHS 0",
        features: ["3 free predictions daily", "Basic AI analysis", "Community access", "Mobile app access"],
      },
      vip: {
        name: "Black Stars VIP",
        price: "GHS 110",
        popular: true,
        features: [
          "Unlimited predictions",
          "Advanced AI analysis",
          "Confidence scores",
          "Mobile Money alerts",
          "Priority support",
          "Historical data",
          "Ghana Premier League coverage",
        ],
      },
      pro: {
        name: "Golden Pro",
        price: "GHS 220",
        features: [
          "Everything in VIP",
          "Multi-league coverage",
          "Live predictions",
          "Custom strategies",
          "API access",
          "AFCON Ghana specials",
          "International coverage",
        ],
      },
    },
    flexibleOptions: [
      { name: "Single Tip", price: "GHS 8", description: "Premium single prediction" },
      { name: "Kotoko vs Hearts", price: "GHS 25", description: "Biggest derby special" },
      { name: "Weekend Package", price: "GHS 30", description: "Weekend matches bundle" },
      { name: "AFCON Ghana Pack", price: "GHS 150", description: "Ghana national team coverage" },
    ],
    paymentMethods: ["MTN Mobile Money", "AirtelTigo Money", "Vodafone Cash", "GCB Bank"],
    globalPaymentMethods: ["Visa/Mastercard", "PayPal", "Remitly"],
    marketContext: "20M bettors, young demographic",
  },

  us: {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    currency: "USD",
    currencySymbol: "$",
    brandName: "SnapBet",
    tagline: "America's Premier AI Betting Platform",
    plans: {
      free: {
        name: "Free",
        price: "$0",
        features: ["3 free predictions daily", "Basic AI analysis", "Community access", "Mobile app access"],
      },
      vip: {
        name: "VIP",
        price: "$9.99",
        popular: true,
        features: [
          "Unlimited predictions",
          "Advanced AI analysis",
          "Confidence scores",
          "Email alerts",
          "Priority support",
          "Historical data",
          "MLS & Premier League coverage",
        ],
      },
      pro: {
        name: "Pro",
        price: "$19.99",
        features: [
          "Everything in VIP",
          "Multi-league coverage",
          "Live predictions",
          "Custom strategies",
          "API access",
          "World Cup specials",
          "International tournaments",
        ],
      },
    },
    flexibleOptions: [
      { name: "Single Tip", price: "$2.99", description: "One premium prediction" },
      { name: "Weekend Package", price: "$7.99", description: "Weekend matches bundle" },
      { name: "Derby Special", price: "$5.99", description: "Local derby coverage" },
      { name: "Tournament Package", price: "$29.99", description: "Tournament coverage" },
    ],
    paymentMethods: ["Credit Card", "PayPal", "Apple Pay", "Google Pay", "Bank Transfer"],
    globalPaymentMethods: ["Visa/Mastercard", "PayPal", "Apple Pay", "Google Pay"],
    marketContext: "330M+ potential users, growing market",
  },

  italy: {
    code: "IT",
    name: "Italy",
    flag: "🇮🇹",
    currency: "EUR",
    currencySymbol: "€",
    brandName: "SnapBet Italia",
    tagline: "La Piattaforma di Previsioni Sportive AI d'Italia",
    plans: {
      free: {
        name: "Gratuito",
        price: "€0",
        features: ["3 previsioni gratuite giornaliere", "Analisi AI di base", "Accesso alla community", "Accesso all'app mobile"],
      },
      vip: {
        name: "VIP",
        price: "€9.99",
        popular: true,
        features: [
          "Previsioni illimitate",
          "Analisi AI avanzata",
          "Punteggi di confidenza",
          "Avvisi email",
          "Supporto prioritario",
          "Dati storici",
          "Copertura Serie A & Champions League",
        ],
      },
      pro: {
        name: "Pro",
        price: "€19.99",
        features: [
          "Tutto quello che c'è in VIP",
          "Copertura multi-lega",
          "Previsioni live",
          "Strategie personalizzate",
          "Accesso API",
          "Speciali Coppa del Mondo",
          "Tornei internazionali",
        ],
      },
    },
    flexibleOptions: [
      { name: "Singola Previsione", price: "€2.99", description: "Una previsione premium" },
      { name: "Pacchetto Weekend", price: "€7.99", description: "Bundle partite del weekend" },
      { name: "Special Derby", price: "€5.99", description: "Copertura derby locali" },
      { name: "Pacchetto Torneo", price: "€29.99", description: "Copertura torneo" },
    ],
    paymentMethods: ["Carta di Credito", "PayPal", "Apple Pay", "Google Pay", "Bonifico Bancario"],
    globalPaymentMethods: ["Visa/Mastercard", "PayPal", "Apple Pay", "Google Pay"],
    marketContext: "Mercato italiano in crescita, Serie A leader",
  },
}

// Enhanced country detection for global usage
export const getCountryFromRequest = async (
  hostname: string,
  userCountryCode?: string,
  ipCountryCode?: string
): Promise<string> => {
  // Priority 1: User's explicit country preference (from profile)
  if (userCountryCode) {
    const countryName = countryCodeToNameMap[userCountryCode.toLowerCase()]
    if (countryName && countryPricing[countryName]) {
      return countryName
    }
  }

  // Priority 2: Domain-based detection
  const domainCountry = getCountryFromDomain(hostname)
  if (domainCountry !== "us") {
    return domainCountry
  }

  // Priority 3: IP-based geolocation (if available)
  if (ipCountryCode) {
    const countryName = countryCodeToNameMap[ipCountryCode.toLowerCase()]
    if (countryName && countryPricing[countryName]) {
      return countryName
    }
  }

  // Priority 4: Default to US for global users
  return "us"
}

// Legacy function for backward compatibility
export const getCountryFromDomain = (hostname: string): string => {
  if (hostname.includes(".ng")) return "nigeria"
  if (hostname.includes(".za")) return "south-africa"
  if (hostname.includes(".ke")) return "kenya"
  if (hostname.includes(".ug")) return "uganda"
  if (hostname.includes(".tz")) return "tanzania"
  if (hostname.includes(".gh")) return "ghana"
  if (hostname.includes(".us")) return "us"
  return "us" // Default fallback to US
}

// Enhanced country code mapping for global support
const countryCodeToNameMap: Record<string, string> = {
  // African countries
  ng: "nigeria",
  za: "south-africa",
  ke: "kenya",
  ug: "uganda",
  tz: "tanzania",
  gh: "ghana",
  
  // North America
  us: "us",
  ca: "us", // Canada - use US pricing for now
  
  // Europe
  gb: "us", // UK - use US pricing for now
  de: "us", // Germany - use US pricing for now
  fr: "us", // France - use US pricing for now
  it: "italy", // Italy - now has its own pricing
  es: "us", // Spain - use US pricing for now
  
  // Asia
  in: "us", // India - use US pricing for now
  cn: "us", // China - use US pricing for now
  jp: "us", // Japan - use US pricing for now
  
  // Add more countries as needed
}

export const getCountryPricing = (countryCode: string): CountryPricing => {
  const countryName = countryCodeToNameMap[countryCode.toLowerCase()]
  return countryPricing[countryName] || countryPricing.us
}

// Helper function to get supported countries
export const getSupportedCountries = (): Array<{ code: string; name: string; flag: string }> => {
  return Object.values(countryPricing).map(country => ({
    code: country.code,
    name: country.name,
    flag: country.flag
  }))
}

// Helper function to check if a country is supported
export const isCountrySupported = (countryCode: string): boolean => {
  const countryName = countryCodeToNameMap[countryCode.toLowerCase()]
  return !!(countryName && countryPricing[countryName])
}
