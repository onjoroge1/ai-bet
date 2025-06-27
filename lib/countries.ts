/**
 * Comprehensive Country Management System
 * Based on ISO 3166-1 standards with industry best practices
 */

export interface Country {
  id: string
  code: string // ISO 3166-1 alpha-2 code
  name: string
  flagEmoji: string
  currencyCode: string // ISO 4217 currency code
  currencySymbol: string
  isActive: boolean
  isSupported: boolean
  timezone?: string
  phoneCode?: string
  locale?: string
}

// ISO 3166-1 alpha-2 country codes with comprehensive data
export const COUNTRIES: Record<string, Omit<Country, 'id' | 'isActive' | 'isSupported'>> = {
  // Major Markets (Primary Support)
  US: {
    code: 'US',
    name: 'United States',
    flagEmoji: '🇺🇸',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'America/New_York',
    phoneCode: '+1',
    locale: 'en-US'
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    flagEmoji: '🇬🇧',
    currencyCode: 'GBP',
    currencySymbol: '£',
    timezone: 'Europe/London',
    phoneCode: '+44',
    locale: 'en-GB'
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    flagEmoji: '🇳🇬',
    currencyCode: 'NGN',
    currencySymbol: '₦',
    timezone: 'Africa/Lagos',
    phoneCode: '+234',
    locale: 'en-NG'
  },
  KE: {
    code: 'KE',
    name: 'Kenya',
    flagEmoji: '🇰🇪',
    currencyCode: 'KES',
    currencySymbol: 'KES',
    timezone: 'Africa/Nairobi',
    phoneCode: '+254',
    locale: 'en-KE'
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    flagEmoji: '🇿🇦',
    currencyCode: 'ZAR',
    currencySymbol: 'R',
    timezone: 'Africa/Johannesburg',
    phoneCode: '+27',
    locale: 'en-ZA'
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    flagEmoji: '🇬🇭',
    currencyCode: 'GHS',
    currencySymbol: '₵',
    timezone: 'Africa/Accra',
    phoneCode: '+233',
    locale: 'en-GH'
  },
  UG: {
    code: 'UG',
    name: 'Uganda',
    flagEmoji: '🇺🇬',
    currencyCode: 'UGX',
    currencySymbol: 'USh',
    timezone: 'Africa/Kampala',
    phoneCode: '+256',
    locale: 'en-UG'
  },
  TZ: {
    code: 'TZ',
    name: 'Tanzania',
    flagEmoji: '🇹🇿',
    currencyCode: 'TZS',
    currencySymbol: 'TSh',
    timezone: 'Africa/Dar_es_Salaam',
    phoneCode: '+255',
    locale: 'en-TZ'
  },
  IN: {
    code: 'IN',
    name: 'India',
    flagEmoji: '🇮🇳',
    currencyCode: 'INR',
    currencySymbol: '₹',
    timezone: 'Asia/Kolkata',
    phoneCode: '+91',
    locale: 'en-IN'
  },
  PH: {
    code: 'PH',
    name: 'Philippines',
    flagEmoji: '🇵🇭',
    currencyCode: 'PHP',
    currencySymbol: '₱',
    timezone: 'Asia/Manila',
    phoneCode: '+63',
    locale: 'en-PH'
  },
  
  // Additional Major Markets
  CA: {
    code: 'CA',
    name: 'Canada',
    flagEmoji: '🇨🇦',
    currencyCode: 'CAD',
    currencySymbol: 'C$',
    timezone: 'America/Toronto',
    phoneCode: '+1',
    locale: 'en-CA'
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    flagEmoji: '🇦🇺',
    currencyCode: 'AUD',
    currencySymbol: 'A$',
    timezone: 'Australia/Sydney',
    phoneCode: '+61',
    locale: 'en-AU'
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    flagEmoji: '🇩🇪',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Berlin',
    phoneCode: '+49',
    locale: 'de-DE'
  },
  FR: {
    code: 'FR',
    name: 'France',
    flagEmoji: '🇫🇷',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Paris',
    phoneCode: '+33',
    locale: 'fr-FR'
  },
  IT: {
    code: 'IT',
    name: 'Italy',
    flagEmoji: '🇮🇹',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Rome',
    phoneCode: '+39',
    locale: 'it-IT'
  },
  ES: {
    code: 'ES',
    name: 'Spain',
    flagEmoji: '🇪🇸',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Madrid',
    phoneCode: '+34',
    locale: 'es-ES'
  },
  BR: {
    code: 'BR',
    name: 'Brazil',
    flagEmoji: '🇧🇷',
    currencyCode: 'BRL',
    currencySymbol: 'R$',
    timezone: 'America/Sao_Paulo',
    phoneCode: '+55',
    locale: 'pt-BR'
  },
  MX: {
    code: 'MX',
    name: 'Mexico',
    flagEmoji: '🇲🇽',
    currencyCode: 'MXN',
    currencySymbol: '$',
    timezone: 'America/Mexico_City',
    phoneCode: '+52',
    locale: 'es-MX'
  },
  AR: {
    code: 'AR',
    name: 'Argentina',
    flagEmoji: '🇦🇷',
    currencyCode: 'ARS',
    currencySymbol: '$',
    timezone: 'America/Argentina/Buenos_Aires',
    phoneCode: '+54',
    locale: 'es-AR'
  },
  CL: {
    code: 'CL',
    name: 'Chile',
    flagEmoji: '🇨🇱',
    currencyCode: 'CLP',
    currencySymbol: '$',
    timezone: 'America/Santiago',
    phoneCode: '+56',
    locale: 'es-CL'
  },
  CO: {
    code: 'CO',
    name: 'Colombia',
    flagEmoji: '🇨🇴',
    currencyCode: 'COP',
    currencySymbol: '$',
    timezone: 'America/Bogota',
    phoneCode: '+57',
    locale: 'es-CO'
  },
  PE: {
    code: 'PE',
    name: 'Peru',
    flagEmoji: '🇵🇪',
    currencyCode: 'PEN',
    currencySymbol: 'S/',
    timezone: 'America/Lima',
    phoneCode: '+51',
    locale: 'es-PE'
  },
  VE: {
    code: 'VE',
    name: 'Venezuela',
    flagEmoji: '🇻🇪',
    currencyCode: 'VES',
    currencySymbol: 'Bs',
    timezone: 'America/Caracas',
    phoneCode: '+58',
    locale: 'es-VE'
  },
  UY: {
    code: 'UY',
    name: 'Uruguay',
    flagEmoji: '🇺🇾',
    currencyCode: 'UYU',
    currencySymbol: '$',
    timezone: 'America/Montevideo',
    phoneCode: '+598',
    locale: 'es-UY'
  },
  PY: {
    code: 'PY',
    name: 'Paraguay',
    flagEmoji: '🇵🇾',
    currencyCode: 'PYG',
    currencySymbol: '₲',
    timezone: 'America/Asuncion',
    phoneCode: '+595',
    locale: 'es-PY'
  },
  BO: {
    code: 'BO',
    name: 'Bolivia',
    flagEmoji: '🇧🇴',
    currencyCode: 'BOB',
    currencySymbol: 'Bs',
    timezone: 'America/La_Paz',
    phoneCode: '+591',
    locale: 'es-BO'
  },
  EC: {
    code: 'EC',
    name: 'Ecuador',
    flagEmoji: '🇪🇨',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'America/Guayaquil',
    phoneCode: '+593',
    locale: 'es-EC'
  },
  GY: {
    code: 'GY',
    name: 'Guyana',
    flagEmoji: '🇬🇾',
    currencyCode: 'GYD',
    currencySymbol: '$',
    timezone: 'America/Guyana',
    phoneCode: '+592',
    locale: 'en-GY'
  },
  SR: {
    code: 'SR',
    name: 'Suriname',
    flagEmoji: '🇸🇷',
    currencyCode: 'SRD',
    currencySymbol: '$',
    timezone: 'America/Paramaribo',
    phoneCode: '+597',
    locale: 'nl-SR'
  },
  GF: {
    code: 'GF',
    name: 'French Guiana',
    flagEmoji: '🇬🇫',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'America/Cayenne',
    phoneCode: '+594',
    locale: 'fr-GF'
  },
  FK: {
    code: 'FK',
    name: 'Falkland Islands',
    flagEmoji: '🇫🇰',
    currencyCode: 'FKP',
    currencySymbol: '£',
    timezone: 'Atlantic/Stanley',
    phoneCode: '+500',
    locale: 'en-FK'
  },
  GS: {
    code: 'GS',
    name: 'South Georgia',
    flagEmoji: '🇬🇸',
    currencyCode: 'GBP',
    currencySymbol: '£',
    timezone: 'Atlantic/South_Georgia',
    phoneCode: '+500',
    locale: 'en-GS'
  },
  BV: {
    code: 'BV',
    name: 'Bouvet Island',
    flagEmoji: '🇧🇻',
    currencyCode: 'NOK',
    currencySymbol: 'kr',
    timezone: 'Europe/Oslo',
    phoneCode: '+47',
    locale: 'no-BV'
  },
  AQ: {
    code: 'AQ',
    name: 'Antarctica',
    flagEmoji: '🇦🇶',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'Antarctica/McMurdo',
    phoneCode: '+672',
    locale: 'en-AQ'
  },
  TF: {
    code: 'TF',
    name: 'French Southern Territories',
    flagEmoji: '🇹🇫',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Indian/Kerguelen',
    phoneCode: '+262',
    locale: 'fr-TF'
  },
  HM: {
    code: 'HM',
    name: 'Heard and McDonald Islands',
    flagEmoji: '🇭🇲',
    currencyCode: 'AUD',
    currencySymbol: 'A$',
    timezone: 'Indian/Kerguelen',
    phoneCode: '+672',
    locale: 'en-HM'
  },
  IO: {
    code: 'IO',
    name: 'British Indian Ocean Territory',
    flagEmoji: '🇮🇴',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'Indian/Chagos',
    phoneCode: '+246',
    locale: 'en-IO'
  },
  CX: {
    code: 'CX',
    name: 'Christmas Island',
    flagEmoji: '🇨🇽',
    currencyCode: 'AUD',
    currencySymbol: 'A$',
    timezone: 'Indian/Christmas',
    phoneCode: '+61',
    locale: 'en-CX'
  },
  CC: {
    code: 'CC',
    name: 'Cocos (Keeling) Islands',
    flagEmoji: '🇨🇨',
    currencyCode: 'AUD',
    currencySymbol: 'A$',
    timezone: 'Indian/Cocos',
    phoneCode: '+61',
    locale: 'en-CC'
  },
  NF: {
    code: 'NF',
    name: 'Norfolk Island',
    flagEmoji: '🇳🇫',
    currencyCode: 'AUD',
    currencySymbol: 'A$',
    timezone: 'Pacific/Norfolk',
    phoneCode: '+672',
    locale: 'en-NF'
  },
  TK: {
    code: 'TK',
    name: 'Tokelau',
    flagEmoji: '🇹🇰',
    currencyCode: 'NZD',
    currencySymbol: 'NZ$',
    timezone: 'Pacific/Fakaofo',
    phoneCode: '+690',
    locale: 'en-TK'
  },
  NU: {
    code: 'NU',
    name: 'Niue',
    flagEmoji: '🇳🇺',
    currencyCode: 'NZD',
    currencySymbol: 'NZ$',
    timezone: 'Pacific/Niue',
    phoneCode: '+683',
    locale: 'en-NU'
  },
  CK: {
    code: 'CK',
    name: 'Cook Islands',
    flagEmoji: '🇨🇰',
    currencyCode: 'NZD',
    currencySymbol: 'NZ$',
    timezone: 'Pacific/Rarotonga',
    phoneCode: '+682',
    locale: 'en-CK'
  },
  WS: {
    code: 'WS',
    name: 'Samoa',
    flagEmoji: '🇼🇸',
    currencyCode: 'WST',
    currencySymbol: 'T',
    timezone: 'Pacific/Apia',
    phoneCode: '+685',
    locale: 'en-WS'
  },
  TO: {
    code: 'TO',
    name: 'Tonga',
    flagEmoji: '🇹🇴',
    currencyCode: 'TOP',
    currencySymbol: 'T$',
    timezone: 'Pacific/Tongatapu',
    phoneCode: '+676',
    locale: 'en-TO'
  },
  FJ: {
    code: 'FJ',
    name: 'Fiji',
    flagEmoji: '🇫🇯',
    currencyCode: 'FJD',
    currencySymbol: 'FJ$',
    timezone: 'Pacific/Fiji',
    phoneCode: '+679',
    locale: 'en-FJ'
  },
  NC: {
    code: 'NC',
    name: 'New Caledonia',
    flagEmoji: '🇳🇨',
    currencyCode: 'XPF',
    currencySymbol: '₣',
    timezone: 'Pacific/Noumea',
    phoneCode: '+687',
    locale: 'fr-NC'
  },
  VU: {
    code: 'VU',
    name: 'Vanuatu',
    flagEmoji: '🇻🇺',
    currencyCode: 'VUV',
    currencySymbol: 'Vt',
    timezone: 'Pacific/Efate',
    phoneCode: '+678',
    locale: 'en-VU'
  },
  SB: {
    code: 'SB',
    name: 'Solomon Islands',
    flagEmoji: '🇸🇧',
    currencyCode: 'SBD',
    currencySymbol: 'SI$',
    timezone: 'Pacific/Guadalcanal',
    phoneCode: '+677',
    locale: 'en-SB'
  },
  PG: {
    code: 'PG',
    name: 'Papua New Guinea',
    flagEmoji: '🇵🇬',
    currencyCode: 'PGK',
    currencySymbol: 'K',
    timezone: 'Pacific/Port_Moresby',
    phoneCode: '+675',
    locale: 'en-PG'
  },
  PW: {
    code: 'PW',
    name: 'Palau',
    flagEmoji: '🇵🇼',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'Pacific/Palau',
    phoneCode: '+680',
    locale: 'en-PW'
  },
  FM: {
    code: 'FM',
    name: 'Micronesia',
    flagEmoji: '🇫🇲',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'Pacific/Pohnpei',
    phoneCode: '+691',
    locale: 'en-FM'
  },
  MH: {
    code: 'MH',
    name: 'Marshall Islands',
    flagEmoji: '🇲🇭',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'Pacific/Majuro',
    phoneCode: '+692',
    locale: 'en-MH'
  },
  KI: {
    code: 'KI',
    name: 'Kiribati',
    flagEmoji: '🇰🇮',
    currencyCode: 'AUD',
    currencySymbol: 'A$',
    timezone: 'Pacific/Tarawa',
    phoneCode: '+686',
    locale: 'en-KI'
  },
  TV: {
    code: 'TV',
    name: 'Tuvalu',
    flagEmoji: '🇹🇻',
    currencyCode: 'AUD',
    currencySymbol: 'A$',
    timezone: 'Pacific/Funafuti',
    phoneCode: '+688',
    locale: 'en-TV'
  },
  NR: {
    code: 'NR',
    name: 'Nauru',
    flagEmoji: '🇳🇷',
    currencyCode: 'AUD',
    currencySymbol: 'A$',
    timezone: 'Pacific/Nauru',
    phoneCode: '+674',
    locale: 'en-NR'
  },
  // Add more countries as needed...
}

// Primary supported countries (for signup and core features)
export const PRIMARY_SUPPORTED_COUNTRIES = [
  'US', 'GB', 'NG', 'KE', 'ZA', 'GH', 'UG', 'TZ', 'IN', 'PH', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'BR', 'MX'
]

// Secondary supported countries (basic features)
export const SECONDARY_SUPPORTED_COUNTRIES = [
  'AR', 'CL', 'CO', 'PE', 'VE', 'UY', 'PY', 'BO', 'EC'
]

// All supported countries
export const SUPPORTED_COUNTRIES = [...PRIMARY_SUPPORTED_COUNTRIES, ...SECONDARY_SUPPORTED_COUNTRIES]

/**
 * Get country by ISO code
 */
export function getCountryByCode(code: string): Country | null {
  const countryData = COUNTRIES[code.toUpperCase()]
  if (!countryData) return null

  return {
    ...countryData,
    id: `country_${countryData.code.toLowerCase()}`,
    isActive: true,
    isSupported: SUPPORTED_COUNTRIES.includes(countryData.code)
  }
}

/**
 * Get all countries
 */
export function getAllCountries(): Country[] {
  return Object.values(COUNTRIES).map(country => ({
    ...country,
    id: `country_${country.code.toLowerCase()}`,
    isActive: true,
    isSupported: SUPPORTED_COUNTRIES.includes(country.code)
  }))
}

/**
 * Get supported countries only
 */
export function getSupportedCountries(): Country[] {
  return SUPPORTED_COUNTRIES.map(code => getCountryByCode(code)!).filter(Boolean)
}

/**
 * Get primary supported countries only
 */
export function getPrimarySupportedCountries(): Country[] {
  return PRIMARY_SUPPORTED_COUNTRIES.map(code => getCountryByCode(code)!).filter(Boolean)
}

/**
 * Detect user's country from various sources
 */
export async function detectUserCountry(
  ipAddress?: string,
  acceptLanguage?: string,
  timezone?: string
): Promise<Country> {
  // Priority order: IP geolocation > Accept-Language > Timezone > Default
  
  // 1. Try IP geolocation (if available)
  if (ipAddress && ipAddress !== 'unknown') {
    try {
      const response = await fetch(`https://ipapi.co/${ipAddress}/json/`)
      const data = await response.json()
      
      // Type guard to ensure data has the expected structure
      if (data && typeof data === 'object' && 'country_code' in data && typeof data.country_code === 'string') {
        const country = getCountryByCode(data.country_code)
        if (country && country.isSupported) {
          return country
        }
      }
    } catch (error) {
      console.warn('IP geolocation failed:', error)
    }
  }

  // 2. Try Accept-Language header
  if (acceptLanguage) {
    const lang = acceptLanguage.split(',')[0].split('-')[1]
    if (lang) {
      const country = getCountryByCode(lang)
      if (country && country.isSupported) {
        return country
      }
    }
  }

  // 3. Try timezone detection
  if (timezone) {
    const timezoneCountry = getCountryByTimezone(timezone)
    if (timezoneCountry && timezoneCountry.isSupported) {
      return timezoneCountry
    }
  }

  // 4. Default to US
  return getCountryByCode('US')!
}

/**
 * Get country by timezone
 */
function getCountryByTimezone(timezone: string): Country | null {
  const timezoneMap: Record<string, string> = {
    'America/New_York': 'US',
    'America/Los_Angeles': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'Europe/London': 'GB',
    'Europe/Berlin': 'DE',
    'Europe/Paris': 'FR',
    'Europe/Rome': 'IT',
    'Europe/Madrid': 'ES',
    'Africa/Lagos': 'NG',
    'Africa/Nairobi': 'KE',
    'Africa/Johannesburg': 'ZA',
    'Africa/Accra': 'GH',
    'Africa/Kampala': 'UG',
    'Africa/Dar_es_Salaam': 'TZ',
    'Asia/Kolkata': 'IN',
    'Asia/Manila': 'PH',
    'America/Toronto': 'CA',
    'Australia/Sydney': 'AU',
    'America/Sao_Paulo': 'BR',
    'America/Mexico_City': 'MX',
    'America/Argentina/Buenos_Aires': 'AR',
    'America/Santiago': 'CL',
    'America/Bogota': 'CO',
    'America/Lima': 'PE',
    'America/Caracas': 'VE',
    'America/Montevideo': 'UY',
    'America/Asuncion': 'PY',
    'America/La_Paz': 'BO',
    'America/Guayaquil': 'EC'
  }

  const countryCode = timezoneMap[timezone]
  return countryCode ? getCountryByCode(countryCode) : null
}

/**
 * Validate country code
 */
export function isValidCountryCode(code: string): boolean {
  return code.toUpperCase() in COUNTRIES
}

/**
 * Get country display name with flag
 */
export function getCountryDisplayName(country: Country): string {
  return `${country.flagEmoji} ${country.name}`
}

/**
 * Get currency display
 */
export function getCurrencyDisplay(country: Country): string {
  return `${country.currencySymbol} ${country.currencyCode}`
} 