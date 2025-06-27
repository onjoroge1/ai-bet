import { loadStripe } from '@stripe/stripe-js'

// Client-side Stripe instance (only for client-side)
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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

// Convert currency code to Stripe currency format
export function getStripeCurrency(currencyCode: string): string {
  return currencyCode.toLowerCase()
}

// Format amount for Stripe (convert to smallest currency unit)
export function formatAmountForStripe(amount: number, currency: string): number {
  const currenciesWithDecimals = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RUB', 'TRY', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'VND', 'THB', 'MYR', 'SGD', 'HKD', 'TWD', 'KRW', 'INR', 'IDR', 'PHP', 'ZAR', 'EGP', 'NGN', 'KES', 'GHS', 'UGX', 'TZS']
  
  if (currenciesWithDecimals.includes(currency.toUpperCase())) {
    return Math.round(amount * 100)
  }
  
  return Math.round(amount)
} 