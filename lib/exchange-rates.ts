// Exchange rate utility for converting currencies to USD
// In production, you should use a real-time exchange rate API like:
// - https://exchangeratesapi.io/
// - https://fixer.io/
// - https://currencylayer.com/

export interface ExchangeRate {
  currency: string
  rate: number
  lastUpdated: Date
}

// Static exchange rates (update these regularly or use an API)
const EXCHANGE_RATES: { [key: string]: number } = {
  'USD': 1.0,
  'KES': 0.0069, // 1 KES = 0.0069 USD
  'EUR': 1.09,   // 1 EUR = 1.09 USD
  'GBP': 1.27,   // 1 GBP = 1.27 USD
  'NGN': 0.00066, // 1 NGN = 0.00066 USD
  'GHS': 0.083,  // 1 GHS = 0.083 USD
  'ZAR': 0.055,  // 1 ZAR = 0.055 USD
  'UGX': 0.00027, // 1 UGX = 0.00027 USD
  'TZS': 0.00043, // 1 TZS = 0.00043 USD
  'ZMW': 0.040,  // 1 ZMW = 0.040 USD
  'MWK': 0.00059, // 1 MWK = 0.00059 USD
  'BWP': 0.074,  // 1 BWP = 0.074 USD
  'NAD': 0.055,  // 1 NAD = 0.055 USD
  'SZL': 0.055,  // 1 SZL = 0.055 USD
  'LSL': 0.055,  // 1 LSL = 0.055 USD
}

/**
 * Convert an amount from a given currency to USD
 * @param amount - The amount to convert
 * @param fromCurrency - The source currency code
 * @returns The amount in USD
 */
export function convertToUSD(amount: number, fromCurrency: string): number {
  const rate = EXCHANGE_RATES[fromCurrency.toUpperCase()] || 1
  return amount * rate
}

/**
 * Convert an amount from USD to a given currency
 * @param amountUSD - The amount in USD
 * @param toCurrency - The target currency code
 * @returns The amount in the target currency
 */
export function convertFromUSD(amountUSD: number, toCurrency: string): number {
  const rate = EXCHANGE_RATES[toCurrency.toUpperCase()] || 1
  return amountUSD / rate
}

/**
 * Format a USD amount for display
 * @param amount - The amount in USD
 * @returns Formatted string (e.g., "$1.2K", "$3.4M")
 */
export function formatUSD(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`
  }
  return `$${amount.toFixed(2)}`
}

/**
 * Get all supported currencies
 * @returns Array of supported currency codes
 */
export function getSupportedCurrencies(): string[] {
  return Object.keys(EXCHANGE_RATES)
}

/**
 * Check if a currency is supported
 * @param currency - The currency code to check
 * @returns True if supported, false otherwise
 */
export function isCurrencySupported(currency: string): boolean {
  return currency.toUpperCase() in EXCHANGE_RATES
}

/**
 * Get the exchange rate for a currency
 * @param currency - The currency code
 * @returns The exchange rate to USD, or 1 if not found
 */
export function getExchangeRate(currency: string): number {
  return EXCHANGE_RATES[currency.toUpperCase()] || 1
}

// For production, you might want to implement a real-time exchange rate fetcher:
/*
export async function fetchLatestExchangeRates(): Promise<void> {
  try {
    const response = await fetch('https://api.exchangeratesapi.io/v1/latest?base=USD&apikey=YOUR_API_KEY')
    const data = await response.json()
    
    // Update the rates
    Object.keys(data.rates).forEach(currency => {
      EXCHANGE_RATES[currency] = 1 / data.rates[currency]
    })
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error)
    // Fall back to static rates
  }
}
*/ 