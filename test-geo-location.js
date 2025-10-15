// Simple test script to verify geo-location API is working
const testGeoLocation = async () => {
  try {
    console.log('Testing geo-location API...')
    
    // Test the geo-location endpoint
    const geoResponse = await fetch('http://localhost:3000/api/geo/location')
    const geoData = await geoResponse.json()
    
    console.log('Geo-location API response:', geoData)
    
    if (geoData.success) {
      console.log('✅ Geo-location API is working')
      console.log('Detected country:', geoData.data.country)
      console.log('Country name:', geoData.data.countryName)
      console.log('Currency:', geoData.data.currencyCode)
    } else {
      console.log('❌ Geo-location API failed:', geoData.error)
    }
    
    // Test the user country endpoint
    console.log('\nTesting user country API...')
    const countryResponse = await fetch('http://localhost:3000/api/user/country')
    const countryData = await countryResponse.json()
    
    console.log('User country API response:', countryData)
    
    if (countryData.success) {
      console.log('✅ User country API is working')
      console.log('Country code:', countryData.country.code)
      console.log('Country name:', countryData.country.name)
      console.log('Currency symbol:', countryData.country.currencySymbol)
      console.log('Detected from:', countryData.country.detectedFrom)
    } else {
      console.log('❌ User country API failed:', countryData.error)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testGeoLocation()

