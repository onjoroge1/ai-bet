import React from 'react'
import { getPrimarySupportedCountries } from '@/lib/countries'

interface HreflangTagsProps {
  currentUrl: string
  countryCode?: string
  slug?: string
  isBlogPost?: boolean
}

export function HreflangTags({ 
  currentUrl, 
  countryCode, 
  slug,
  isBlogPost = false
}: HreflangTagsProps) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://snapbet.ai'
  const supportedCountries = getPrimarySupportedCountries()
  
  // Generate hreflang tags
  const generateHreflangTags = () => {
    const tags: React.ReactNode[] = []
    
    if (isBlogPost && slug) {
      // For blog posts, create hreflang for each country
      tags.push(
        <link key="en" rel="alternate" hrefLang="en" href={`${baseUrl}/blog/${slug}`} />
      )
      
      // Add country-specific versions
      supportedCountries.forEach(country => {
        tags.push(
          <link 
            key={`en-${country.code.toLowerCase()}`}
            rel="alternate" 
            hrefLang={`en-${country.code.toLowerCase()}`} 
            href={`${baseUrl}/${country.code.toLowerCase()}/blog/${slug}`} 
          />
        )
      })
      
      // Add x-default
      tags.push(
        <link key="x-default" rel="alternate" hrefLang="x-default" href={`${baseUrl}/blog/${slug}`} />
      )
    } else {
      // For regular pages
      tags.push(
        <link key="en" rel="alternate" hrefLang="en" href={currentUrl} />
      )
      
      // Add country-specific versions
      supportedCountries.forEach(country => {
        const countryUrl = currentUrl.replace(baseUrl, `${baseUrl}/${country.code.toLowerCase()}`)
        tags.push(
          <link 
            key={`en-${country.code.toLowerCase()}`}
            rel="alternate" 
            hrefLang={`en-${country.code.toLowerCase()}`} 
            href={countryUrl} 
          />
        )
      })
      
      // Add x-default
      tags.push(
        <link key="x-default" rel="alternate" hrefLang="x-default" href={currentUrl} />
      )
    }
    
    return tags
  }

  return <>{generateHreflangTags()}</>
}

// Simplified version for basic pages
export function BasicHreflangTags({ currentUrl }: { currentUrl: string }) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://snapbet.ai'
  const supportedCountries = getPrimarySupportedCountries()
  
  return (
    <>
      <link rel="alternate" hrefLang="en" href={currentUrl} />
      {supportedCountries.map(country => (
        <link 
          key={`en-${country.code.toLowerCase()}`}
          rel="alternate" 
          hrefLang={`en-${country.code.toLowerCase()}`} 
          href={`${baseUrl}/${country.code.toLowerCase()}${currentUrl.replace(baseUrl, '')}`} 
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={currentUrl} />
    </>
  )
} 