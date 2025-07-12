/**
 * Server-Side Pricing Service
 * 
 * This service handles database operations for pricing and should only be used
 * on the server side (API routes, server components, etc.)
 */

import prisma from '@/lib/db'
import { PricingConfig } from './pricing-service'

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

/**
 * Get all country pricing from database
 * @returns Array of all country pricing configs from database
 */
export async function getAllDbCountryPricing(): Promise<Array<{ countryCode: string; config: PricingConfig }>> {
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    include: {
      packageCountryPrices: true
    }
  })
  
  return countries.map(country => {
    const predictionPrice = country.packageCountryPrices.find(p => p.packageType === 'prediction')
    
    if (!predictionPrice) {
      // Fallback pricing for countries without database pricing
      return {
        countryCode: country.code,
        config: {
          price: 1.99,
          originalPrice: 2.99,
          currencyCode: country.currencyCode || 'USD',
          currencySymbol: country.currencySymbol || '$',
          source: 'fallback'
        }
      }
    }
    
    return {
      countryCode: country.code,
      config: {
        price: Number(predictionPrice.price),
        originalPrice: Number(predictionPrice.originalPrice || predictionPrice.price),
        currencyCode: country.currencyCode || '',
        currencySymbol: country.currencySymbol || '',
        source: 'db'
      }
    }
  })
}

/**
 * Update country pricing in database
 * @param countryCode - Country code
 * @param packageType - Package type
 * @param price - New price
 * @param originalPrice - New original price
 */
export async function updateCountryPricing(
  countryCode: string, 
  packageType: string, 
  price: number, 
  originalPrice?: number
): Promise<void> {
  const country = await prisma.country.findUnique({ where: { code: countryCode.toLowerCase() } })
  if (!country) {
    throw new Error(`Country not found: ${countryCode}`)
  }
  
  await prisma.packageCountryPrice.upsert({
    where: { countryId_packageType: { countryId: country.id, packageType } },
    update: {
      price: price,
      originalPrice: originalPrice || price
    },
    create: {
      countryId: country.id,
      packageType,
      price: price,
      originalPrice: originalPrice || price
    }
  })
}

/**
 * Get pricing for QuickPurchase items from database
 * @param countryCode - Country code
 * @returns Pricing object compatible with existing QuickPurchase API
 */
export async function getDbQuickPurchasePricing(countryCode: string): Promise<Record<string, number>> {
  const config = await getDbCountryPricing(countryCode)
  
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