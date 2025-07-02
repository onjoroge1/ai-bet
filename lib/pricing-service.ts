/**
 * Centralized Pricing Service
 * 
 * This service provides consistent pricing across the entire application
 * by reading from environment variables and providing a single source of truth.
 */

import prisma from '@/lib/db'

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
    [`${countryCode.toUpperCase()}_PREDICTION_PRICE`]: config.price,
    [`${countryCode.toUpperCase()}_PREDICTION_ORIGINAL_PRICE`]: config.originalPrice,
    [`${countryCode.toUpperCase()}_TIP_PRICE`]: config.price * 0.5, // 50% of prediction price
    [`${countryCode.toUpperCase()}_PACKAGE_PRICE`]: config.price * 2 // 2x prediction price
  }
}

/**
 * Get country-specific pricing from the database (PackageCountryPrice table)
 * This is the primary and only source of pricing - no environment variable fallbacks
 * @param countryCode - ISO country code (e.g., 'KE', 'NG', 'US')
 * @param packageType - e.g., 'prediction'
 * @returns PricingConfig
 * @throws Error if country or pricing not found in database
 */
export async function getDbCountryPricing(countryCode: string, packageType = 'prediction'): Promise<PricingConfig> {
  // Look up the country by code - database stores lowercase codes
  const country = await prisma.country.findUnique({ where: { code: countryCode.toLowerCase() } })
  if (!country) {
    // Fallback for unknown countries: USD $1 base price
    const base = 1
    const tipCounts: Record<string, number> = {
      prediction: 1,
      tip: 1,
      weekend_pass: 5,
      weekly_pass: 8,
      monthly_sub: 30
    }
    const discounts: Record<string, number> = {
      prediction: 0,
      tip: 0,
      weekend_pass: 0.10,
      weekly_pass: 0.15,
      monthly_sub: 0.30
    }
    const tips = tipCounts[packageType] ?? 1
    const discount = discounts[packageType] ?? 0
    const originalPrice = base * tips
    const price = originalPrice * (1 - discount)
    return {
      price,
      originalPrice,
      currencyCode: 'USD',
      currencySymbol: '$',
      source: 'default-fallback'
    }
  }
  
  // Look up the price by countryId and packageType
  const priceRow = await prisma.packageCountryPrice.findUnique({
    where: { countryId_packageType: { countryId: country.id, packageType } },
    include: { country: true }
  })
  
  if (!priceRow) {
    throw new Error(`Pricing not found in database for country: ${countryCode}, packageType: ${packageType}`)
  }
  
  return {
    price: Number(priceRow.price),
    originalPrice: Number(priceRow.originalPrice || priceRow.price), // Use originalPrice if available, otherwise same as price
    currencyCode: country.currencyCode || '',
    currencySymbol: country.currencySymbol || '',
    source: 'db'
  }
} 