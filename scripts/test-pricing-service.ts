import { config } from 'dotenv'
import { getCountryPricing, getAllCountryPricing, formatPrice } from '../lib/pricing-service'

// Load environment variables from .env file
config({ path: '.env' })

async function testPricingService() {
  console.log('🔍 Testing Centralized Pricing Service...\n')

  // Test individual country pricing
  console.log('📊 Individual Country Pricing:')
  const countries = ['KE', 'NG', 'ZA', 'GH', 'UG', 'TZ', 'US', 'IT']
  
  countries.forEach(countryCode => {
    const config = getCountryPricing(countryCode)
    const formattedPrice = formatPrice(config.price, config.currencySymbol, config.currencyCode)
    const formattedOriginal = formatPrice(config.originalPrice, config.currencySymbol, config.currencyCode)
    
    console.log(`${countryCode}: ${formattedPrice} (was ${formattedOriginal}) - Source: ${config.source}`)
  })

  console.log('\n📋 All Country Pricing:')
  const allPricing = getAllCountryPricing()
  allPricing.forEach(({ countryCode, config }) => {
    const formattedPrice = formatPrice(config.price, config.currencySymbol, config.currencyCode)
    console.log(`${countryCode}: ${formattedPrice} - ${config.source}`)
  })

  // Test specific Kenya pricing (should be KES 80)
  console.log('\n🇰🇪 Kenya Specific Test:')
  const kenyaConfig = getCountryPricing('KE')
  console.log(`Expected: KES 80`)
  console.log(`Actual: ${formatPrice(kenyaConfig.price, kenyaConfig.currencySymbol, kenyaConfig.currencyCode)}`)
  console.log(`Source: ${kenyaConfig.source}`)
  
  if (kenyaConfig.price === 80) {
    console.log('✅ Kenya pricing is correct!')
  } else {
    console.log('❌ Kenya pricing is incorrect!')
    console.log(`Expected: 80, Got: ${kenyaConfig.price}`)
  }

  // Test environment variable reading
  console.log('\n🔧 Environment Variables Check:')
  console.log(`DEFAULT_PREDICTION_PRICE: ${process.env.DEFAULT_PREDICTION_PRICE}`)
  console.log(`DEFAULT_PREDICTION_ORIGINAL_PRICE: ${process.env.DEFAULT_PREDICTION_ORIGINAL_PRICE}`)
  console.log(`KENYA_PREDICTION_PRICE: ${process.env.KENYA_PREDICTION_PRICE}`)
  console.log(`KENYA_PREDICTION_ORIGINAL_PRICE: ${process.env.KENYA_PREDICTION_ORIGINAL_PRICE}`)
}

testPricingService().catch(console.error) 