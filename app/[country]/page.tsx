import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCountryByCode, getPrimarySupportedCountries } from '@/lib/countries'
import { getDbCountryPricing } from '@/lib/server-pricing-service'
import { ResponsiveHero } from "@/components/responsive/responsive-hero"
import { ResponsivePredictions } from "@/components/responsive/responsive-predictions"
import { StatsSection } from "@/components/stats-section"
import { TrustBadges } from "@/components/trust-badges"
import { QuizSection } from "@/components/quiz-section"
import { logger } from '@/lib/logger'

interface CountryPageProps {
  params: {
    country: string
  }
}

export async function generateMetadata({ params }: CountryPageProps): Promise<Metadata> {
  const { country } = await params
  const countryCode = country.toUpperCase()
  const countryData = getCountryByCode(countryCode)
  
  if (!countryData || !countryData.isSupported) {
    return {
      title: 'Country Not Found | SnapBet AI',
      description: 'This country is not currently supported by SnapBet AI.'
    }
  }

  return {
    title: `SnapBet AI - AI-Powered Sports Predictions in ${countryData.name}`,
    description: `Get winning sports predictions powered by AI in ${countryData.name}. Join thousands of successful bettors with our data-driven football, basketball, and tennis tips. Start winning today with confidence scores and expert analysis!`,
    keywords: [
      'sports predictions', 'AI betting tips', 'football predictions', 
      'basketball tips', 'tennis predictions', 'sports betting', 
      'AI tipster', 'winning predictions', 'betting advice',
      'sports analysis', 'prediction accuracy', 'betting strategy',
      'daily football tips', 'sports betting predictions', 'AI sports analysis',
      'confident betting tips', 'professional sports predictions', 'winning betting strategy',
      countryData.name.toLowerCase(), `${countryData.name} sports betting`, `${countryData.name} predictions`
    ],
    openGraph: {
      title: `SnapBet AI - AI-Powered Sports Predictions in ${countryData.name}`,
      description: `Get winning sports predictions powered by AI in ${countryData.name}. Local pricing in ${countryData.currencyCode}.`,
      locale: countryData.locale || 'en_US',
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: `SnapBet AI - Sports Predictions in ${countryData.name}`
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: `SnapBet AI - AI-Powered Sports Predictions in ${countryData.name}`,
      description: `Get winning sports predictions powered by AI in ${countryData.name}. Local pricing in ${countryData.currencyCode}.`,
      images: ['/og-image.jpg']
    },
    alternates: {
      canonical: `https://snapbet.bet/${countryCode.toLowerCase()}`
    }
  }
}

export async function generateStaticParams() {
  const supportedCountries = getPrimarySupportedCountries()
  
  return supportedCountries.map((country) => ({
    country: country.code.toLowerCase(),
  }))
}

export default async function CountryPage({ params }: CountryPageProps) {
  const { country } = await params
  const countryCode = country.toUpperCase()
  const countryData = getCountryByCode(countryCode)
  
  if (!countryData || !countryData.isSupported) {
    logger.warn('Invalid country access attempt', {
      tags: ['country-page', 'invalid-country'],
      data: { countryCode, requestedCountry: country }
    })
    notFound()
  }

  try {
    // Get country-specific pricing
    const pricing = await getDbCountryPricing(countryCode, 'prediction')
    
    logger.info('Country page accessed', {
      tags: ['country-page', 'access'],
      data: { 
        countryCode, 
        countryName: countryData.name,
        currency: countryData.currencyCode,
        price: pricing.price
      }
    })

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <ResponsiveHero />
        <StatsSection />
        <ResponsivePredictions />
        <TrustBadges />
        <QuizSection />
      </div>
    )
  } catch (error) {
    logger.error('Error loading country page', {
      tags: ['country-page', 'error'],
      error: error instanceof Error ? error : undefined,
      data: { countryCode }
    })
    
    // Fallback to default homepage
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <ResponsiveHero />
        <StatsSection />
        <ResponsivePredictions />
        <TrustBadges />
        <QuizSection />
      </div>
    )
  }
} 