'use client'

import Script from 'next/script'
import { useEffect } from 'react'

interface GoogleAnalyticsProps {
  GA_MEASUREMENT_ID: string
}

export function GoogleAnalytics({ GA_MEASUREMENT_ID }: GoogleAnalyticsProps) {
  useEffect(() => {
    // Enhanced GA4 configuration
    if (typeof window !== 'undefined' && window.gtag) {
      // Configure enhanced measurement
      window.gtag('config', GA_MEASUREMENT_ID, {
        // Enhanced measurement settings
        enhanced_measurements: {
          scrolls: true,
          outbound_clicks: true,
          site_search: true,
          video_engagement: true,
          file_downloads: true,
          page_changes: true,
        },
        // Custom parameters
        custom_map: {
          'custom_parameter_1': 'user_type',
          'custom_parameter_2': 'subscription_level',
        },
        // Privacy settings
        anonymize_ip: true,
        allow_google_signals: true,
        allow_ad_personalization_signals: false,
      })
    }
  }, [GA_MEASUREMENT_ID])

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_title: document.title,
              page_location: window.location.href,
              send_page_view: true,
              enhanced_measurements: {
                scrolls: true,
                outbound_clicks: true,
                site_search: true,
                video_engagement: true,
                file_downloads: true,
                page_changes: true
              },
              custom_map: {
                'custom_parameter_1': 'user_type',
                'custom_parameter_2': 'subscription_level'
              },
              anonymize_ip: true,
              allow_google_signals: true,
              allow_ad_personalization_signals: false
            });
          `,
        }}
      />
    </>
  )
}

// Enhanced analytics hook with GA4 features
export function useGoogleAnalytics() {
  const trackEvent = (action: string, category: string, label?: string, value?: number, customParameters?: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value,
        ...customParameters,
      })
    }
  }

  const trackPageView = (url: string, title?: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!, {
        page_path: url,
        page_title: title || document.title,
      })
    }
  }

  const trackConversion = (conversionId: string, conversionLabel: string, value?: number, currency?: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'conversion', {
        send_to: `${conversionId}/${conversionLabel}`,
        value: value,
        currency: currency || 'USD',
      })
    }
  }

  // GA4 specific tracking methods
  const trackPurchase = (transactionId: string, value: number, currency: string, items: any[]) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'purchase', {
        transaction_id: transactionId,
        value: value,
        currency: currency,
        items: items,
      })
    }
  }

  const trackSignUp = (method: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'sign_up', {
        method: method,
      })
    }
  }

  const trackLogin = (method: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'login', {
        method: method,
      })
    }
  }

  const trackSearch = (searchTerm: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'search', {
        search_term: searchTerm,
      })
    }
  }

  const trackEngagement = (engagementType: string, contentId?: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'engagement', {
        engagement_type: engagementType,
        content_id: contentId,
      })
    }
  }

  const trackPredictionView = (predictionId: string, sport: string, confidence: number) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'view_prediction', {
        prediction_id: predictionId,
        sport: sport,
        confidence_score: confidence,
      })
    }
  }

  const trackTipPurchase = (tipId: string, price: number, currency: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'purchase_tip', {
        tip_id: tipId,
        price: price,
        currency: currency,
      })
    }
  }

  return {
    trackEvent,
    trackPageView,
    trackConversion,
    trackPurchase,
    trackSignUp,
    trackLogin,
    trackSearch,
    trackEngagement,
    trackPredictionView,
    trackTipPurchase,
  }
}

// Declare gtag on window object
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js',
      targetId: string,
      config?: Record<string, any>
    ) => void
  }
} 