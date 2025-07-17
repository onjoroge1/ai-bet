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
  // Additional Major Football Nations
  NL: {
    code: 'NL',
    name: 'Netherlands',
    flagEmoji: '🇳🇱',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Amsterdam',
    phoneCode: '+31',
    locale: 'nl-NL'
  },
  PT: {
    code: 'PT',
    name: 'Portugal',
    flagEmoji: '🇵🇹',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Lisbon',
    phoneCode: '+351',
    locale: 'pt-PT'
  },
  BE: {
    code: 'BE',
    name: 'Belgium',
    flagEmoji: '🇧🇪',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Brussels',
    phoneCode: '+32',
    locale: 'nl-BE'
  },
  AT: {
    code: 'AT',
    name: 'Austria',
    flagEmoji: '🇦🇹',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Vienna',
    phoneCode: '+43',
    locale: 'de-AT'
  },
  CH: {
    code: 'CH',
    name: 'Switzerland',
    flagEmoji: '🇨🇭',
    currencyCode: 'CHF',
    currencySymbol: 'CHF',
    timezone: 'Europe/Zurich',
    phoneCode: '+41',
    locale: 'de-CH'
  },
  SE: {
    code: 'SE',
    name: 'Sweden',
    flagEmoji: '🇸🇪',
    currencyCode: 'SEK',
    currencySymbol: 'kr',
    timezone: 'Europe/Stockholm',
    phoneCode: '+46',
    locale: 'sv-SE'
  },
  NO: {
    code: 'NO',
    name: 'Norway',
    flagEmoji: '🇳🇴',
    currencyCode: 'NOK',
    currencySymbol: 'kr',
    timezone: 'Europe/Oslo',
    phoneCode: '+47',
    locale: 'no-NO'
  },
  DK: {
    code: 'DK',
    name: 'Denmark',
    flagEmoji: '🇩🇰',
    currencyCode: 'DKK',
    currencySymbol: 'kr',
    timezone: 'Europe/Copenhagen',
    phoneCode: '+45',
    locale: 'da-DK'
  },
  FI: {
    code: 'FI',
    name: 'Finland',
    flagEmoji: '🇫🇮',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Helsinki',
    phoneCode: '+358',
    locale: 'fi-FI'
  },
  PL: {
    code: 'PL',
    name: 'Poland',
    flagEmoji: '🇵🇱',
    currencyCode: 'PLN',
    currencySymbol: 'zł',
    timezone: 'Europe/Warsaw',
    phoneCode: '+48',
    locale: 'pl-PL'
  },
  CZ: {
    code: 'CZ',
    name: 'Czech Republic',
    flagEmoji: '🇨🇿',
    currencyCode: 'CZK',
    currencySymbol: 'Kč',
    timezone: 'Europe/Prague',
    phoneCode: '+420',
    locale: 'cs-CZ'
  },
  HU: {
    code: 'HU',
    name: 'Hungary',
    flagEmoji: '🇭🇺',
    currencyCode: 'HUF',
    currencySymbol: 'Ft',
    timezone: 'Europe/Budapest',
    phoneCode: '+36',
    locale: 'hu-HU'
  },
  RO: {
    code: 'RO',
    name: 'Romania',
    flagEmoji: '🇷🇴',
    currencyCode: 'RON',
    currencySymbol: 'lei',
    timezone: 'Europe/Bucharest',
    phoneCode: '+40',
    locale: 'ro-RO'
  },
  BG: {
    code: 'BG',
    name: 'Bulgaria',
    flagEmoji: '🇧🇬',
    currencyCode: 'BGN',
    currencySymbol: 'лв',
    timezone: 'Europe/Sofia',
    phoneCode: '+359',
    locale: 'bg-BG'
  },
  HR: {
    code: 'HR',
    name: 'Croatia',
    flagEmoji: '🇭🇷',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Zagreb',
    phoneCode: '+385',
    locale: 'hr-HR'
  },
  RS: {
    code: 'RS',
    name: 'Serbia',
    flagEmoji: '🇷🇸',
    currencyCode: 'RSD',
    currencySymbol: 'дин',
    timezone: 'Europe/Belgrade',
    phoneCode: '+381',
    locale: 'sr-RS'
  },
  SI: {
    code: 'SI',
    name: 'Slovenia',
    flagEmoji: '🇸🇮',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Ljubljana',
    phoneCode: '+386',
    locale: 'sl-SI'
  },
  SK: {
    code: 'SK',
    name: 'Slovakia',
    flagEmoji: '🇸🇰',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Bratislava',
    phoneCode: '+421',
    locale: 'sk-SK'
  },
  IE: {
    code: 'IE',
    name: 'Ireland',
    flagEmoji: '🇮🇪',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Dublin',
    phoneCode: '+353',
    locale: 'en-IE'
  },
  TH: {
    code: 'TH',
    name: 'Thailand',
    flagEmoji: '🇹🇭',
    currencyCode: 'THB',
    currencySymbol: '฿',
    timezone: 'Asia/Bangkok',
    phoneCode: '+66',
    locale: 'th-TH'
  },
  MY: {
    code: 'MY',
    name: 'Malaysia',
    flagEmoji: '🇲🇾',
    currencyCode: 'MYR',
    currencySymbol: 'RM',
    timezone: 'Asia/Kuala_Lumpur',
    phoneCode: '+60',
    locale: 'ms-MY'
  },
  SG: {
    code: 'SG',
    name: 'Singapore',
    flagEmoji: '🇸🇬',
    currencyCode: 'SGD',
    currencySymbol: 'S$',
    timezone: 'Asia/Singapore',
    phoneCode: '+65',
    locale: 'en-SG'
  },
  ID: {
    code: 'ID',
    name: 'Indonesia',
    flagEmoji: '🇮🇩',
    currencyCode: 'IDR',
    currencySymbol: 'Rp',
    timezone: 'Asia/Jakarta',
    phoneCode: '+62',
    locale: 'id-ID'
  },
  VN: {
    code: 'VN',
    name: 'Vietnam',
    flagEmoji: '🇻🇳',
    currencyCode: 'VND',
    currencySymbol: '₫',
    timezone: 'Asia/Ho_Chi_Minh',
    phoneCode: '+84',
    locale: 'vi-VN'
  },
  KR: {
    code: 'KR',
    name: 'South Korea',
    flagEmoji: '🇰🇷',
    currencyCode: 'KRW',
    currencySymbol: '₩',
    timezone: 'Asia/Seoul',
    phoneCode: '+82',
    locale: 'ko-KR'
  },
  JP: {
    code: 'JP',
    name: 'Japan',
    flagEmoji: '🇯🇵',
    currencyCode: 'JPY',
    currencySymbol: '¥',
    timezone: 'Asia/Tokyo',
    phoneCode: '+81',
    locale: 'ja-JP'
  },
  CN: {
    code: 'CN',
    name: 'China',
    flagEmoji: '🇨🇳',
    currencyCode: 'CNY',
    currencySymbol: '¥',
    timezone: 'Asia/Shanghai',
    phoneCode: '+86',
    locale: 'zh-CN'
  },
  HK: {
    code: 'HK',
    name: 'Hong Kong',
    flagEmoji: '🇭🇰',
    currencyCode: 'HKD',
    currencySymbol: 'HK$',
    timezone: 'Asia/Hong_Kong',
    phoneCode: '+852',
    locale: 'zh-HK'
  },
  TW: {
    code: 'TW',
    name: 'Taiwan',
    flagEmoji: '🇹🇼',
    currencyCode: 'TWD',
    currencySymbol: 'NT$',
    timezone: 'Asia/Taipei',
    phoneCode: '+886',
    locale: 'zh-TW'
  },
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    flagEmoji: '🇦🇪',
    currencyCode: 'AED',
    currencySymbol: 'د.إ',
    timezone: 'Asia/Dubai',
    phoneCode: '+971',
    locale: 'ar-AE'
  },
  SA: {
    code: 'SA',
    name: 'Saudi Arabia',
    flagEmoji: '🇸🇦',
    currencyCode: 'SAR',
    currencySymbol: 'ر.س',
    timezone: 'Asia/Riyadh',
    phoneCode: '+966',
    locale: 'ar-SA'
  },
  QA: {
    code: 'QA',
    name: 'Qatar',
    flagEmoji: '🇶🇦',
    currencyCode: 'QAR',
    currencySymbol: 'ر.ق',
    timezone: 'Asia/Qatar',
    phoneCode: '+974',
    locale: 'ar-QA'
  },
  KW: {
    code: 'KW',
    name: 'Kuwait',
    flagEmoji: '🇰🇼',
    currencyCode: 'KWD',
    currencySymbol: 'د.ك',
    timezone: 'Asia/Kuwait',
    phoneCode: '+965',
    locale: 'ar-KW'
  },
  BH: {
    code: 'BH',
    name: 'Bahrain',
    flagEmoji: '🇧🇭',
    currencyCode: 'BHD',
    currencySymbol: '.د.ب',
    timezone: 'Asia/Bahrain',
    phoneCode: '+973',
    locale: 'ar-BH'
  },
  OM: {
    code: 'OM',
    name: 'Oman',
    flagEmoji: '🇴🇲',
    currencyCode: 'OMR',
    currencySymbol: 'ر.ع.',
    timezone: 'Asia/Muscat',
    phoneCode: '+968',
    locale: 'ar-OM'
  },
  JO: {
    code: 'JO',
    name: 'Jordan',
    flagEmoji: '🇯🇴',
    currencyCode: 'JOD',
    currencySymbol: 'د.ا',
    timezone: 'Asia/Amman',
    phoneCode: '+962',
    locale: 'ar-JO'
  },
  LB: {
    code: 'LB',
    name: 'Lebanon',
    flagEmoji: '🇱🇧',
    currencyCode: 'LBP',
    currencySymbol: 'ل.ل',
    timezone: 'Asia/Beirut',
    phoneCode: '+961',
    locale: 'ar-LB'
  },
  IL: {
    code: 'IL',
    name: 'Israel',
    flagEmoji: '🇮🇱',
    currencyCode: 'ILS',
    currencySymbol: '₪',
    timezone: 'Asia/Jerusalem',
    phoneCode: '+972',
    locale: 'he-IL'
  },
  TR: {
    code: 'TR',
    name: 'Turkey',
    flagEmoji: '🇹🇷',
    currencyCode: 'TRY',
    currencySymbol: '₺',
    timezone: 'Europe/Istanbul',
    phoneCode: '+90',
    locale: 'tr-TR'
  },
  NZ: {
    code: 'NZ',
    name: 'New Zealand',
    flagEmoji: '🇳🇿',
    currencyCode: 'NZD',
    currencySymbol: 'NZ$',
    timezone: 'Pacific/Auckland',
    phoneCode: '+64',
    locale: 'en-NZ'
  },
  CR: {
    code: 'CR',
    name: 'Costa Rica',
    flagEmoji: '🇨🇷',
    currencyCode: 'CRC',
    currencySymbol: '₡',
    timezone: 'America/Costa_Rica',
    phoneCode: '+506',
    locale: 'es-CR'
  },
  PA: {
    code: 'PA',
    name: 'Panama',
    flagEmoji: '🇵🇦',
    currencyCode: 'PAB',
    currencySymbol: 'B/.',
    timezone: 'America/Panama',
    phoneCode: '+507',
    locale: 'es-PA'
  },
  GT: {
    code: 'GT',
    name: 'Guatemala',
    flagEmoji: '🇬🇹',
    currencyCode: 'GTQ',
    currencySymbol: 'Q',
    timezone: 'America/Guatemala',
    phoneCode: '+502',
    locale: 'es-GT'
  },
  SV: {
    code: 'SV',
    name: 'El Salvador',
    flagEmoji: '🇸🇻',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'America/El_Salvador',
    phoneCode: '+503',
    locale: 'es-SV'
  },
  HN: {
    code: 'HN',
    name: 'Honduras',
    flagEmoji: '🇭🇳',
    currencyCode: 'HNL',
    currencySymbol: 'L',
    timezone: 'America/Tegucigalpa',
    phoneCode: '+504',
    locale: 'es-HN'
  },
  NI: {
    code: 'NI',
    name: 'Nicaragua',
    flagEmoji: '🇳🇮',
    currencyCode: 'NIO',
    currencySymbol: 'C$',
    timezone: 'America/Managua',
    phoneCode: '+505',
    locale: 'es-NI'
  },
  BZ: {
    code: 'BZ',
    name: 'Belize',
    flagEmoji: '🇧🇿',
    currencyCode: 'BZD',
    currencySymbol: 'BZ$',
    timezone: 'America/Belize',
    phoneCode: '+501',
    locale: 'en-BZ'
  },
  JM: {
    code: 'JM',
    name: 'Jamaica',
    flagEmoji: '🇯🇲',
    currencyCode: 'JMD',
    currencySymbol: 'J$',
    timezone: 'America/Jamaica',
    phoneCode: '+1876',
    locale: 'en-JM'
  },
  TT: {
    code: 'TT',
    name: 'Trinidad and Tobago',
    flagEmoji: '🇹🇹',
    currencyCode: 'TTD',
    currencySymbol: 'TT$',
    timezone: 'America/Port_of_Spain',
    phoneCode: '+1868',
    locale: 'en-TT'
  },
  BB: {
    code: 'BB',
    name: 'Barbados',
    flagEmoji: '🇧🇧',
    currencyCode: 'BBD',
    currencySymbol: 'Bds$',
    timezone: 'America/Barbados',
    phoneCode: '+1246',
    locale: 'en-BB'
  },
  GD: {
    code: 'GD',
    name: 'Grenada',
    flagEmoji: '🇬🇩',
    currencyCode: 'XCD',
    currencySymbol: 'EC$',
    timezone: 'America/Grenada',
    phoneCode: '+1473',
    locale: 'en-GD'
  },
  LC: {
    code: 'LC',
    name: 'Saint Lucia',
    flagEmoji: '🇱🇨',
    currencyCode: 'XCD',
    currencySymbol: 'EC$',
    timezone: 'America/St_Lucia',
    phoneCode: '+1758',
    locale: 'en-LC'
  },
  VC: {
    code: 'VC',
    name: 'Saint Vincent and the Grenadines',
    flagEmoji: '🇻🇨',
    currencyCode: 'XCD',
    currencySymbol: 'EC$',
    timezone: 'America/St_Vincent',
    phoneCode: '+1784',
    locale: 'en-VC'
  },
  AG: {
    code: 'AG',
    name: 'Antigua and Barbuda',
    flagEmoji: '🇦🇬',
    currencyCode: 'XCD',
    currencySymbol: 'EC$',
    timezone: 'America/Antigua',
    phoneCode: '+1268',
    locale: 'en-AG'
  },
  DM: {
    code: 'DM',
    name: 'Dominica',
    flagEmoji: '🇩🇲',
    currencyCode: 'XCD',
    currencySymbol: 'EC$',
    timezone: 'America/Dominica',
    phoneCode: '+1767',
    locale: 'en-DM'
  },
  KN: {
    code: 'KN',
    name: 'Saint Kitts and Nevis',
    flagEmoji: '🇰🇳',
    currencyCode: 'XCD',
    currencySymbol: 'EC$',
    timezone: 'America/St_Kitts',
    phoneCode: '+1869',
    locale: 'en-KN'
  },
  HT: {
    code: 'HT',
    name: 'Haiti',
    flagEmoji: '🇭🇹',
    currencyCode: 'HTG',
    currencySymbol: 'G',
    timezone: 'America/Port-au-Prince',
    phoneCode: '+509',
    locale: 'ht-HT'
  },
  DO: {
    code: 'DO',
    name: 'Dominican Republic',
    flagEmoji: '🇩🇴',
    currencyCode: 'DOP',
    currencySymbol: 'RD$',
    timezone: 'America/Santo_Domingo',
    phoneCode: '+1809',
    locale: 'es-DO'
  },
  PR: {
    code: 'PR',
    name: 'Puerto Rico',
    flagEmoji: '🇵🇷',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'America/Puerto_Rico',
    phoneCode: '+1787',
    locale: 'es-PR'
  },
  CU: {
    code: 'CU',
    name: 'Cuba',
    flagEmoji: '🇨🇺',
    currencyCode: 'CUP',
    currencySymbol: '$',
    timezone: 'America/Havana',
    phoneCode: '+53',
    locale: 'es-CU'
  },
  BS: {
    code: 'BS',
    name: 'Bahamas',
    flagEmoji: '🇧🇸',
    currencyCode: 'BSD',
    currencySymbol: 'B$',
    timezone: 'America/Nassau',
    phoneCode: '+1242',
    locale: 'en-BS'
  },
  TC: {
    code: 'TC',
    name: 'Turks and Caicos Islands',
    flagEmoji: '🇹🇨',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'America/Grand_Turk',
    phoneCode: '+1649',
    locale: 'en-TC'
  },
  AI: {
    code: 'AI',
    name: 'Anguilla',
    flagEmoji: '🇦🇮',
    currencyCode: 'XCD',
    currencySymbol: 'EC$',
    timezone: 'America/Anguilla',
    phoneCode: '+1264',
    locale: 'en-AI'
  },
  VG: {
    code: 'VG',
    name: 'British Virgin Islands',
    flagEmoji: '🇻🇬',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'America/Tortola',
    phoneCode: '+1284',
    locale: 'en-VG'
  },
  VI: {
    code: 'VI',
    name: 'U.S. Virgin Islands',
    flagEmoji: '🇻🇮',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'America/St_Thomas',
    phoneCode: '+1340',
    locale: 'en-VI'
  },
  AW: {
    code: 'AW',
    name: 'Aruba',
    flagEmoji: '🇦🇼',
    currencyCode: 'AWG',
    currencySymbol: 'ƒ',
    timezone: 'America/Aruba',
    phoneCode: '+297',
    locale: 'nl-AW'
  },
  CW: {
    code: 'CW',
    name: 'Curaçao',
    flagEmoji: '🇨🇼',
    currencyCode: 'ANG',
    currencySymbol: 'ƒ',
    timezone: 'America/Curacao',
    phoneCode: '+599',
    locale: 'nl-CW'
  },
  SX: {
    code: 'SX',
    name: 'Sint Maarten',
    flagEmoji: '🇸🇽',
    currencyCode: 'ANG',
    currencySymbol: 'ƒ',
    timezone: 'America/Lower_Princes',
    phoneCode: '+1721',
    locale: 'nl-SX'
  },
  BQ: {
    code: 'BQ',
    name: 'Caribbean Netherlands',
    flagEmoji: '🇧🇶',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'America/Kralendijk',
    phoneCode: '+599',
    locale: 'nl-BQ'
  },
  BL: {
    code: 'BL',
    name: 'Saint Barthélemy',
    flagEmoji: '🇧🇱',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'America/St_Barthelemy',
    phoneCode: '+590',
    locale: 'fr-BL'
  },
  MF: {
    code: 'MF',
    name: 'Saint Martin',
    flagEmoji: '🇲🇫',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'America/Marigot',
    phoneCode: '+590',
    locale: 'fr-MF'
  },
  GP: {
    code: 'GP',
    name: 'Guadeloupe',
    flagEmoji: '🇬🇵',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'America/Guadeloupe',
    phoneCode: '+590',
    locale: 'fr-GP'
  },
  MQ: {
    code: 'MQ',
    name: 'Martinique',
    flagEmoji: '🇲🇶',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'America/Martinique',
    phoneCode: '+596',
    locale: 'fr-MQ'
  },
  RE: {
    code: 'RE',
    name: 'Réunion',
    flagEmoji: '🇷🇪',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Indian/Reunion',
    phoneCode: '+262',
    locale: 'fr-RE'
  },
  YT: {
    code: 'YT',
    name: 'Mayotte',
    flagEmoji: '🇾🇹',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Indian/Mayotte',
    phoneCode: '+262',
    locale: 'fr-YT'
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
  PF: {
    code: 'PF',
    name: 'French Polynesia',
    flagEmoji: '🇵🇫',
    currencyCode: 'XPF',
    currencySymbol: '₣',
    timezone: 'Pacific/Tahiti',
    phoneCode: '+689',
    locale: 'fr-PF'
  },
  WF: {
    code: 'WF',
    name: 'Wallis and Futuna',
    flagEmoji: '🇼🇫',
    currencyCode: 'XPF',
    currencySymbol: '₣',
    timezone: 'Pacific/Wallis',
    phoneCode: '+681',
    locale: 'fr-WF'
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
    locale: 'sm-WS'
  },
  TO: {
    code: 'TO',
    name: 'Tonga',
    flagEmoji: '🇹🇴',
    currencyCode: 'TOP',
    currencySymbol: 'T$',
    timezone: 'Pacific/Tongatapu',
    phoneCode: '+676',
    locale: 'to-TO'
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
  VU: {
    code: 'VU',
    name: 'Vanuatu',
    flagEmoji: '🇻🇺',
    currencyCode: 'VUV',
    currencySymbol: 'VT',
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
  MP: {
    code: 'MP',
    name: 'Northern Mariana Islands',
    flagEmoji: '🇲🇵',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'Pacific/Saipan',
    phoneCode: '+1670',
    locale: 'en-MP'
  },
  GU: {
    code: 'GU',
    name: 'Guam',
    flagEmoji: '🇬🇺',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'Pacific/Guam',
    phoneCode: '+1671',
    locale: 'en-GU'
  },
  AS: {
    code: 'AS',
    name: 'American Samoa',
    flagEmoji: '🇦🇸',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'Pacific/Pago_Pago',
    phoneCode: '+1684',
    locale: 'en-AS'
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
  PN: {
    code: 'PN',
    name: 'Pitcairn Islands',
    flagEmoji: '🇵🇳',
    currencyCode: 'NZD',
    currencySymbol: 'NZ$',
    timezone: 'Pacific/Pitcairn',
    phoneCode: '+64',
    locale: 'en-PN'
  },
  SH: {
    code: 'SH',
    name: 'Saint Helena',
    flagEmoji: '🇸🇭',
    currencyCode: 'GBP',
    currencySymbol: '£',
    timezone: 'Atlantic/St_Helena',
    phoneCode: '+290',
    locale: 'en-SH'
  },
  AC: {
    code: 'AC',
    name: 'Ascension Island',
    flagEmoji: '🇦🇨',
    currencyCode: 'GBP',
    currencySymbol: '£',
    timezone: 'Atlantic/St_Helena',
    phoneCode: '+290',
    locale: 'en-AC'
  },
  TA: {
    code: 'TA',
    name: 'Tristan da Cunha',
    flagEmoji: '🇹🇦',
    currencyCode: 'GBP',
    currencySymbol: '£',
    timezone: 'Atlantic/St_Helena',
    phoneCode: '+290',
    locale: 'en-TA'
  },
  // Add more countries as needed...
}

// Primary supported countries (for signup and core features)
export const PRIMARY_SUPPORTED_COUNTRIES = [
  // African Markets (Strong betting culture)
  'US', 'GB', 'NG', 'KE', 'ZA', 'GH', 'UG', 'TZ',
  
  // Major Football Nations (Strong betting culture)
  'BR', 'AR', 'MX', 'CO', 'CL', 'PE', 'VE', 'UY', 'PY', 'BO', 'EC',
  
  // European Markets (Major football nations)
  'DE', 'FR', 'IT', 'ES', 'NL', 'PT', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'RS', 'SI', 'SK', 'IE',
  
  // Asian Markets (Strong betting culture)
  'IN', 'PH', 'TH', 'MY', 'SG', 'ID', 'VN', 'KR', 'JP', 'CN', 'HK', 'TW', 'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'IL', 'TR',
  
  // Americas & Oceania
  'CA', 'AU', 'NZ', 'CR', 'PA', 'GT', 'SV', 'HN', 'NI', 'BZ', 'JM', 'TT', 'BB', 'GD', 'LC', 'VC', 'AG', 'DM', 'KN', 'HT', 'DO', 'PR', 'CU', 'BS', 'TC', 'AI', 'VG', 'VI', 'AW', 'CW', 'SX', 'BQ', 'BL', 'MF', 'GP', 'MQ', 'RE', 'YT', 'NC', 'PF', 'WF', 'TK', 'NU', 'CK', 'WS', 'TO', 'FJ', 'VU', 'SB', 'PG', 'PW', 'MH', 'FM', 'MP', 'GU', 'AS'
]

// Secondary supported countries (basic features)
export const SECONDARY_SUPPORTED_COUNTRIES = [
  // Additional African countries
  'ET', 'SD', 'SS', 'DJ', 'SO', 'ER', 'CM', 'CF', 'TD', 'CG', 'CD', 'GA', 'GQ', 'ST', 'AO', 'ZM', 'ZW', 'BW', 'NA', 'SZ', 'LS', 'MG', 'MU', 'SC', 'KM', 'MW', 'MZ', 'BI', 'RW',
  
  // Additional Latin American countries
  'GY', 'SR', 'GF', 'FK', 'GS', 'BV', 'AQ', 'TF', 'HM', 'IO', 'CX', 'CC', 'NF', 'PN', 'SH', 'AC', 'TA',
  
  // Additional European countries
  'IS', 'FO', 'GL', 'SJ', 'AX', 'AD', 'MC', 'LI', 'SM', 'VA', 'AL', 'MK', 'ME', 'BA', 'XK', 'MD', 'UA', 'BY', 'RU', 'KZ', 'KG', 'TJ', 'TM', 'UZ', 'AZ', 'GE', 'AM', 'SY', 'IQ', 'IR', 'AF', 'PK', 'BD', 'LK', 'MV', 'NP', 'BT', 'MM', 'LA', 'KH', 'BN', 'TL', 'MN', 'KP'
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
    // Americas
    'America/New_York': 'US',
    'America/Los_Angeles': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
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
    'America/Guayaquil': 'EC',
    'America/Costa_Rica': 'CR',
    'America/Panama': 'PA',
    'America/Guatemala': 'GT',
    'America/El_Salvador': 'SV',
    'America/Tegucigalpa': 'HN',
    'America/Managua': 'NI',
    'America/Belize': 'BZ',
    'America/Jamaica': 'JM',
    'America/Port_of_Spain': 'TT',
    'America/Barbados': 'BB',
    'America/Grenada': 'GD',
    'America/St_Lucia': 'LC',
    'America/St_Vincent': 'VC',
    'America/Antigua': 'AG',
    'America/Dominica': 'DM',
    'America/St_Kitts': 'KN',
    'America/Port-au-Prince': 'HT',
    'America/Santo_Domingo': 'DO',
    'America/Puerto_Rico': 'PR',
    'America/Havana': 'CU',
    'America/Nassau': 'BS',
    'America/Grand_Turk': 'TC',
    'America/Anguilla': 'AI',
    'America/Tortola': 'VG',
    'America/St_Thomas': 'VI',
    'America/Aruba': 'AW',
    'America/Curacao': 'CW',
    'America/Lower_Princes': 'SX',
    'America/Kralendijk': 'BQ',
    'America/St_Barthelemy': 'BL',
    'America/Marigot': 'MF',
    'America/Guadeloupe': 'GP',
    'America/Martinique': 'MQ',
    
    // Europe
    'Europe/London': 'GB',
    'Europe/Berlin': 'DE',
    'Europe/Paris': 'FR',
    'Europe/Rome': 'IT',
    'Europe/Madrid': 'ES',
    'Europe/Amsterdam': 'NL',
    'Europe/Lisbon': 'PT',
    'Europe/Brussels': 'BE',
    'Europe/Vienna': 'AT',
    'Europe/Zurich': 'CH',
    'Europe/Stockholm': 'SE',
    'Europe/Oslo': 'NO',
    'Europe/Copenhagen': 'DK',
    'Europe/Helsinki': 'FI',
    'Europe/Warsaw': 'PL',
    'Europe/Prague': 'CZ',
    'Europe/Budapest': 'HU',
    'Europe/Bucharest': 'RO',
    'Europe/Sofia': 'BG',
    'Europe/Zagreb': 'HR',
    'Europe/Belgrade': 'RS',
    'Europe/Ljubljana': 'SI',
    'Europe/Bratislava': 'SK',
    'Europe/Dublin': 'IE',
    'Europe/Istanbul': 'TR',
    
    // Africa
    'Africa/Lagos': 'NG',
    'Africa/Nairobi': 'KE',
    'Africa/Johannesburg': 'ZA',
    'Africa/Accra': 'GH',
    'Africa/Kampala': 'UG',
    'Africa/Dar_es_Salaam': 'TZ',
    
    // Asia
    'Asia/Kolkata': 'IN',
    'Asia/Manila': 'PH',
    'Asia/Bangkok': 'TH',
    'Asia/Kuala_Lumpur': 'MY',
    'Asia/Singapore': 'SG',
    'Asia/Jakarta': 'ID',
    'Asia/Ho_Chi_Minh': 'VN',
    'Asia/Seoul': 'KR',
    'Asia/Tokyo': 'JP',
    'Asia/Shanghai': 'CN',
    'Asia/Hong_Kong': 'HK',
    'Asia/Taipei': 'TW',
    'Asia/Dubai': 'AE',
    'Asia/Riyadh': 'SA',
    'Asia/Qatar': 'QA',
    'Asia/Kuwait': 'KW',
    'Asia/Bahrain': 'BH',
    'Asia/Muscat': 'OM',
    'Asia/Amman': 'JO',
    'Asia/Beirut': 'LB',
    'Asia/Jerusalem': 'IL',
    
    // Oceania
    'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU',
    'Australia/Perth': 'AU',
    'Pacific/Auckland': 'NZ',
    'Indian/Reunion': 'RE',
    'Indian/Mayotte': 'YT',
    'Pacific/Noumea': 'NC',
    'Pacific/Tahiti': 'PF',
    'Pacific/Wallis': 'WF',
    'Pacific/Fakaofo': 'TK',
    'Pacific/Niue': 'NU',
    'Pacific/Rarotonga': 'CK',
    'Pacific/Apia': 'WS',
    'Pacific/Tongatapu': 'TO',
    'Pacific/Fiji': 'FJ',
    'Pacific/Efate': 'VU',
    'Pacific/Guadalcanal': 'SB',
    'Pacific/Port_Moresby': 'PG',
    'Pacific/Palau': 'PW',
    'Pacific/Majuro': 'MH',
    'Pacific/Pohnpei': 'FM',
    'Pacific/Saipan': 'MP',
    'Pacific/Guam': 'GU',
    'Pacific/Pago_Pago': 'AS'
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