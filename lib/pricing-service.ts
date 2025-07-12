/**
 * Centralized Pricing Service (Client-Safe)
 * 
 * This service provides consistent pricing across the entire application
 * by reading from environment variables and providing a single source of truth.
 * This version is safe for client-side use.
 */

export interface PricingConfig {
  price: number
  originalPrice: number
  currencyCode: string
  currencySymbol: string
  source: string
}

/**
 * Get country-specific pricing from environment variables
 * @param countryCode - ISO country code (e.g., 'KE', 'NG', 'US')
 * @returns Pricing configuration for the country
 */
export function getCountryPricing(countryCode: string): PricingConfig {
  const countryCodeUpper = countryCode.toUpperCase()
  
  // Map country codes to full country names for environment variables
  const countryNameMap: Record<string, string> = {
    'KE': 'KENYA',
    'NG': 'NIGERIA', 
    'ZA': 'SOUTH_AFRICA',
    'GH': 'GHANA',
    'UG': 'UGANDA',
    'TZ': 'TANZANIA',
    'US': 'USD',
    'GB': 'GBP',
    'EU': 'EUR',
    'IT': 'ITALY'
  }
  
  const countryName = countryNameMap[countryCodeUpper]
  
  // Try to get country-specific pricing from environment variables
  // First try with country code (e.g., KE_PREDICTION_PRICE)
  let countryPrice = process.env[`${countryCodeUpper}_PREDICTION_PRICE`]
  let countryOriginalPrice = process.env[`${countryCodeUpper}_PREDICTION_ORIGINAL_PRICE`]
  
  // If not found, try with full country name (e.g., KENYA_PREDICTION_PRICE)
  if (!countryPrice && countryName) {
    countryPrice = process.env[`${countryName}_PREDICTION_PRICE`]
    countryOriginalPrice = process.env[`${countryName}_PREDICTION_ORIGINAL_PRICE`]
  }
  
  if (countryPrice && countryOriginalPrice) {
    return {
      price: parseFloat(countryPrice),
      originalPrice: parseFloat(countryOriginalPrice),
      currencyCode: getCurrencyCode(countryCode),
      currencySymbol: getCurrencySymbol(countryCode),
      source: `environment-${countryCodeUpper}`
    }
  }
  
  // Fallback to default pricing
  const defaultPrice = parseFloat(process.env.DEFAULT_PREDICTION_PRICE || '2.99')
  const defaultOriginalPrice = parseFloat(process.env.DEFAULT_PREDICTION_ORIGINAL_PRICE || '4.99')
  
  return {
    price: defaultPrice,
    originalPrice: defaultOriginalPrice,
    currencyCode: getCurrencyCode(countryCode),
    currencySymbol: getCurrencySymbol(countryCode),
    source: 'environment-default'
  }
}

/**
 * Get currency code for a country
 * @param countryCode - ISO country code
 * @returns Currency code
 */
function getCurrencyCode(countryCode: string): string {
  const currencyMap: Record<string, string> = {
    'KE': 'KES',
    'NG': 'NGN', 
    'ZA': 'ZAR',
    'GH': 'GHS',
    'UG': 'UGX',
    'TZ': 'TZS',
    'US': 'USD',
    'GB': 'GBP',
    'EU': 'EUR',
    'IT': 'EUR'
  }
  
  return currencyMap[countryCode.toUpperCase()] || 'USD'
}

/**
 * Get currency symbol for a country
 * @param countryCode - ISO country code
 * @returns Currency symbol
 */
function getCurrencySymbol(countryCode: string): string {
  const symbolMap: Record<string, string> = {
    'KE': 'KES',
    'NG': '₦',
    'ZA': 'R',
    'GH': 'GH₵',
    'UG': 'UGX',
    'TZ': 'TSh',
    'US': '$',
    'GB': '£',
    'EU': '€',
    'IT': '€'
  }
  
  return symbolMap[countryCode.toUpperCase()] || '$'
}

/**
 * Format price with currency symbol
 * @param price - Price amount
 * @param currencySymbol - Currency symbol
 * @param currencyCode - Currency code
 * @returns Formatted price string
 */
export function formatPrice(price: number, currencySymbol: string, currencyCode: string): string {
  // Special formatting for different currencies
  switch (currencyCode) {
    case 'KES':
    case 'UGX':
    case 'TZS':
      return `${currencySymbol} ${price.toLocaleString()}`
    case 'NGN':
      return `${currencySymbol}${price.toLocaleString()}`
    case 'ZAR':
    case 'GHS':
      return `${currencySymbol} ${price.toFixed(2)}`
    case 'USD':
    case 'EUR':
    case 'GBP':
      return `${currencySymbol}${price.toFixed(2)}`
    default:
      return `${currencySymbol}${price}`
  }
}

/**
 * Get all available country pricing configurations
 * @returns Array of all country pricing configs
 */
export function getAllCountryPricing(): Array<{ countryCode: string; config: PricingConfig }> {
  const countries = ['KE', 'NG', 'ZA', 'GH', 'UG', 'TZ', 'US', 'GB', 'EU', 'IT']
  
  return countries.map(countryCode => ({
    countryCode,
    config: getCountryPricing(countryCode)
  }))
}

/**
 * Validate pricing configuration
 * @param config - Pricing configuration to validate
 * @returns Validation result
 */
export function validatePricingConfig(config: PricingConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (config.price <= 0) {
    errors.push('Price must be greater than 0')
  }
  
  if (config.originalPrice <= 0) {
    errors.push('Original price must be greater than 0')
  }
  
  if (config.price >= config.originalPrice) {
    errors.push('Sale price should be less than original price')
  }
  
  if (!config.currencyCode) {
    errors.push('Currency code is required')
  }
  
  if (!config.currencySymbol) {
    errors.push('Currency symbol is required')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Get pricing for QuickPurchase items (legacy compatibility)
 * @param countryCode - Country code
 * @returns Pricing object compatible with existing QuickPurchase API
 */
export function getQuickPurchasePricing(countryCode: string): Record<string, number> {
  const config = getCountryPricing(countryCode)
  
  return {
    prediction: config.price,
    prediction_original: config.originalPrice,
    daily: config.price * 5, // 5 predictions
    daily_original: config.originalPrice * 5,
    weekly: config.price * 15, // 15 predictions
    weekly_original: config.originalPrice * 15,
    monthly: config.price * 50, // 50 predictions
    monthly_original: config.originalPrice * 50,
    unlimited: config.price * 100, // 100 predictions (unlimited)
    unlimited_original: config.originalPrice * 100
  }
}

/**
 * Get package pricing for a specific country and package type
 * @param countryCode - Country code
 * @param packageType - Type of package
 * @returns Package pricing configuration
 */
export function getPackagePricing(countryCode: string, packageType: string): PricingConfig {
  const baseConfig = getCountryPricing(countryCode)
  
  // Define multipliers for different package types
  const multipliers: Record<string, { count: number; discount: number }> = {
    daily: { count: 5, discount: 0.1 }, // 10% discount
    weekly: { count: 15, discount: 0.2 }, // 20% discount
    monthly: { count: 50, discount: 0.3 }, // 30% discount
    unlimited: { count: 100, discount: 0.4 } // 40% discount
  }
  
  const multiplier = multipliers[packageType] || { count: 1, discount: 0 }
  
  const originalPrice = baseConfig.originalPrice * multiplier.count
  const discountedPrice = originalPrice * (1 - multiplier.discount)
  
  return {
    price: discountedPrice,
    originalPrice: originalPrice,
    currencyCode: baseConfig.currencyCode,
    currencySymbol: baseConfig.currencySymbol,
    source: `package-${packageType}-${baseConfig.source}`
  }
} 