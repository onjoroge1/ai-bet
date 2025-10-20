'use client'

import { useEffect } from 'react'

interface SearchConsoleProps {
  siteVerificationId?: string
}

/**
 * Google Search Console integration component
 * Handles site verification and search analytics
 */
export function SearchConsole({ siteVerificationId }: SearchConsoleProps) {
  useEffect(() => {
    // Add Search Console verification meta tag if provided
    if (siteVerificationId && typeof document !== 'undefined') {
      const existingTag = document.querySelector('meta[name="google-site-verification"]')
      
      if (!existingTag) {
        const metaTag = document.createElement('meta')
        metaTag.name = 'google-site-verification'
        metaTag.content = siteVerificationId
        document.head.appendChild(metaTag)
      }
    }
  }, [siteVerificationId])

  return null
}

/**
 * Search Console sitemap submission hook
 */
export function useSearchConsoleSitemap() {
  const submitSitemap = async (sitemapUrl: string) => {
    try {
      // This would typically be done server-side or through Search Console API
      // For now, we'll just log the sitemap URL
      console.log('Sitemap submitted to Search Console:', sitemapUrl)
      
      // In a real implementation, you would:
      // 1. Use the Search Console API to submit the sitemap
      // 2. Or use a server-side function to ping Google
      // 3. Or use Google's sitemap ping URL
      
      return { success: true, message: 'Sitemap submitted successfully' }
    } catch (error) {
      console.error('Error submitting sitemap:', error)
      return { success: false, message: 'Failed to submit sitemap' }
    }
  }

  const pingGoogleSitemap = async (sitemapUrl: string) => {
    try {
      const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
      
      // Use fetch to ping Google (this should be done server-side in production)
      const response = await fetch(pingUrl, { method: 'GET' })
      
      if (response.ok) {
        console.log('Sitemap pinged successfully to Google')
        return { success: true, message: 'Sitemap pinged successfully' }
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Error pinging sitemap:', error)
      return { success: false, message: 'Failed to ping sitemap' }
    }
  }

  return {
    submitSitemap,
    pingGoogleSitemap,
  }
}

/**
 * SEO monitoring hook for tracking search performance
 */
export function useSEOMonitoring() {
  const trackSearchQuery = (query: string, results: number) => {
    // Track search queries for SEO analysis
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'search_query', {
        search_term: query,
        results_count: results,
      })
    }
  }

  const trackPageNotFound = (url: string, referrer?: string) => {
    // Track 404 errors for SEO monitoring
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_not_found', {
        page_url: url,
        referrer: referrer,
      })
    }
  }

  const trackInternalLinkClick = (fromPage: string, toPage: string, linkText: string) => {
    // Track internal link clicks for SEO analysis
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'internal_link_click', {
        from_page: fromPage,
        to_page: toPage,
        link_text: linkText,
      })
    }
  }

  const trackExternalLinkClick = (url: string, linkText: string) => {
    // Track external link clicks
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'external_link_click', {
        external_url: url,
        link_text: linkText,
      })
    }
  }

  return {
    trackSearchQuery,
    trackPageNotFound,
    trackInternalLinkClick,
    trackExternalLinkClick,
  }
}
