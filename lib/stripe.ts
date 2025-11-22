import { loadStripe, Stripe } from '@stripe/stripe-js'

// Get the Stripe publishable key
const getStripeKey = () => {
  console.log('[Stripe] getStripeKey() called')
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  console.log('[Stripe] Key exists?', !!key)
  if (!key) {
    console.error('[Stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing')
    return undefined
  }
  // Trim whitespace (in case there are newlines or spaces)
  const trimmedKey = key.trim()
  console.log('[Stripe] Trimmed key preview:', trimmedKey.substring(0, 30) + '...')
  if (!trimmedKey.startsWith('pk_test_') && !trimmedKey.startsWith('pk_live_')) {
    console.warn('[Stripe] Invalid publishable key format. Should start with pk_test_ or pk_live_')
    console.warn('[Stripe] Key preview:', trimmedKey.substring(0, 20))
    return undefined
  }
  return trimmedKey
}

// Client-side Stripe instance
// Following the standard Stripe React pattern: https://stripe.com/docs/stripe-js/react
// We ensure initialization only happens when needed on client-side

// Standard Stripe React pattern: create promise by calling loadStripe()
// Only initialize on client-side to avoid SSR issues
export const stripePromise = (() => {
  // Server-side: return a promise that stays pending (Elements won't be used on server anyway)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - window is available at runtime but TypeScript doesn't see it here
  if (typeof window === 'undefined') {
    return new Promise<Stripe | null>(() => {}) // Never resolves on server
  }

  // Client-side: get the key and initialize Stripe
  const stripeKey = getStripeKey()

  if (!stripeKey) {
    console.error('[Stripe] Publishable key is missing or invalid, trying to load anyway')
    // Always call loadStripe, even with an empty key - Elements expects a Promise from loadStripe
    return loadStripe('')
  }

  console.log('[Stripe] Loading Stripe.js with key:', stripeKey.substring(0, 20) + '...')
  
  return loadStripe(stripeKey, {
    betas: [],
    locale: 'en',
  })
})()

// Payment method types we support
export const SUPPORTED_PAYMENT_METHODS = [
  'card',
  'apple_pay',
  'google_pay',
  'paypal'
] as const

export type SupportedPaymentMethod = typeof SUPPORTED_PAYMENT_METHODS[number]

// Get available payment methods based on user's country
export function getAvailablePaymentMethods(countryCode: string): SupportedPaymentMethod[] {
  const baseMethods: SupportedPaymentMethod[] = ['card']
  
  // Add Apple Pay and Google Pay for supported countries
  const digitalWalletCountries = ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'IE', 'NZ', 'JP', 'SG', 'HK']
  if (digitalWalletCountries.includes(countryCode.toUpperCase())) {
    baseMethods.push('apple_pay', 'google_pay')
  }
  
  // Add PayPal for most countries
  const paypalExcludedCountries = ['IN', 'PK', 'BD', 'LK', 'NP', 'BT', 'MV']
  if (!paypalExcludedCountries.includes(countryCode.toUpperCase())) {
    baseMethods.push('paypal')
  }
  
  return baseMethods
}

// Get payment method configuration for Stripe
export function getPaymentMethodConfiguration(countryCode: string) {
  const availableMethods = getAvailablePaymentMethods(countryCode)
  
  return {
    payment_method_types: availableMethods.map(method => {
      switch (method) {
        case 'apple_pay':
        case 'google_pay':
          return 'card' // Both use card as base type
        case 'paypal':
          return 'paypal'
        case 'card':
          return 'card'
        default:
          return 'card'
      }
    }).filter((value, index, self) => self.indexOf(value) === index), // Remove duplicates
    
    payment_method_options: {
      card: {
        request_three_d_secure: 'automatic' as const,
      },
    },
  }
}

// Get payment method order for Stripe Elements based on country
export function getPaymentMethodOrder(countryCode: string): string[] {
  const availableMethods = getAvailablePaymentMethods(countryCode)
  
  // Define priority order for payment methods
  const priorityOrder = [
    'apple_pay',
    'google_pay', 
    'paypal',
    'card'
  ]
  
  // Filter available methods and sort by priority
  const orderedMethods = priorityOrder.filter(method => 
    availableMethods.includes(method as SupportedPaymentMethod)
  )
  
  // Always ensure card is at the end as fallback
  if (availableMethods.includes('card') && !orderedMethods.includes('card')) {
    orderedMethods.push('card')
  }
  
  return orderedMethods
}

// Currency mapping for Stripe
export const STRIPE_CURRENCY_MAP: Record<string, string> = {
  'USD': 'usd',
  'EUR': 'eur',
  'GBP': 'gbp',
  'CAD': 'cad',
  'AUD': 'aud',
  'JPY': 'jpy',
  'CHF': 'chf',
  'SEK': 'sek',
  'NOK': 'nok',
  'DKK': 'dkk',
  'PLN': 'pln',
  'CZK': 'czk',
  'HUF': 'huf',
  'BGN': 'bgn',
  'RON': 'ron',
  'HRK': 'hrk',
  'RUB': 'rub',
  'TRY': 'try',
  'BRL': 'brl',
  'MXN': 'mxn',
  'ARS': 'ars',
  'CLP': 'clp',
  'COP': 'cop',
  'PEN': 'pen',
  'UYU': 'uyu',
  'INR': 'inr',
  'SGD': 'sgd',
  'HKD': 'hkd',
  'TWD': 'twd',
  'KRW': 'krw',
  'THB': 'thb',
  'MYR': 'myr',
  'PHP': 'php',
  'IDR': 'idr',
  'VND': 'vnd',
  'ZAR': 'zar',
  'EGP': 'egp',
  'MAD': 'mad',
  'NGN': 'ngn',
  'KES': 'kes',
  'GHS': 'ghs',
  'UGX': 'ugx',
  'TZS': 'tzs',
  'ETB': 'etb',
  'NZD': 'nzd'
}

// Get Stripe currency code
export function getStripeCurrency(currencyCode: string): string {
  return STRIPE_CURRENCY_MAP[currencyCode.toUpperCase()] || 'usd'
}

// Format amount for Stripe (convert to cents)
export function formatAmountForStripe(amount: number, currency: string): number {
  // Some currencies don't use decimal places
  const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND', 'UGX', 'TZS', 'ETB']
  
  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return Math.round(amount)
  }
  
  return Math.round(amount * 100)
}

// Format amount from Stripe (convert from cents)
export function formatAmountFromStripe(amount: number, currency: string): number {
  // Some currencies don't use decimal places
  const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND', 'UGX', 'TZS', 'ETB']
  
  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return amount
  }
  
  return amount / 100
}