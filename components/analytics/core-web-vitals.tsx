'use client'

import { useEffect } from 'react'
import { useGoogleAnalytics } from './google-analytics'

interface WebVitalsMetric {
  name: string
  value: number
  delta: number
  id: string
  navigationType: string
}

/**
 * Core Web Vitals monitoring component
 * Tracks LCP, FID, CLS, FCP, TTFB metrics
 */
export function CoreWebVitals() {
  const { trackEvent } = useGoogleAnalytics()

  useEffect(() => {
    // Only run in production
    if (process.env.NODE_ENV !== 'production') return

    // Import web-vitals library dynamically
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      // Track Cumulative Layout Shift (CLS)
      getCLS((metric: WebVitalsMetric) => {
        trackEvent('web_vitals', 'CLS', metric.id, Math.round(metric.value * 1000))
      })

      // Track First Input Delay (FID)
      getFID((metric: WebVitalsMetric) => {
        trackEvent('web_vitals', 'FID', metric.id, Math.round(metric.value))
      })

      // Track First Contentful Paint (FCP)
      getFCP((metric: WebVitalsMetric) => {
        trackEvent('web_vitals', 'FCP', metric.id, Math.round(metric.value))
      })

      // Track Largest Contentful Paint (LCP)
      getLCP((metric: WebVitalsMetric) => {
        trackEvent('web_vitals', 'LCP', metric.id, Math.round(metric.value))
      })

      // Track Time to First Byte (TTFB)
      getTTFB((metric: WebVitalsMetric) => {
        trackEvent('web_vitals', 'TTFB', metric.id, Math.round(metric.value))
      })
    })

    // Track page load performance
    const trackPageLoadPerformance = () => {
      if (typeof window !== 'undefined' && window.performance) {
        const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        
        if (navigation) {
          const loadTime = navigation.loadEventEnd - navigation.loadEventStart
          const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
          const firstByte = navigation.responseStart - navigation.requestStart

          trackEvent('performance', 'page_load', 'load_time', Math.round(loadTime))
          trackEvent('performance', 'page_load', 'dom_content_loaded', Math.round(domContentLoaded))
          trackEvent('performance', 'page_load', 'first_byte', Math.round(firstByte))
        }
      }
    }

    // Track performance after page load
    if (document.readyState === 'complete') {
      trackPageLoadPerformance()
    } else {
      window.addEventListener('load', trackPageLoadPerformance)
    }

    // Track resource loading performance
    const trackResourcePerformance = () => {
      if (typeof window !== 'undefined' && window.performance) {
        const resources = window.performance.getEntriesByType('resource')
        
        resources.forEach((resource: PerformanceResourceTiming) => {
          const loadTime = resource.responseEnd - resource.requestStart
          
          // Only track slow resources (> 1 second)
          if (loadTime > 1000) {
            trackEvent('performance', 'slow_resource', resource.name, Math.round(loadTime))
          }
        })
      }
    }

    // Track resource performance after a delay
    setTimeout(trackResourcePerformance, 2000)

    return () => {
      window.removeEventListener('load', trackPageLoadPerformance)
    }
  }, [trackEvent])

  return null
}

/**
 * Performance monitoring hook
 */
export function usePerformanceMonitoring() {
  const { trackEvent } = useGoogleAnalytics()

  const trackUserInteraction = (interactionType: string, element: string, timeToInteraction?: number) => {
    trackEvent('user_interaction', interactionType, element, timeToInteraction)
  }

  const trackPageVisibility = () => {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const visibility = document.hidden ? 'hidden' : 'visible'
        trackEvent('page_visibility', visibility, window.location.pathname)
      })
    }
  }

  const trackScrollDepth = () => {
    if (typeof window !== 'undefined') {
      let maxScroll = 0
      
      const trackScroll = () => {
        const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100)
        
        if (scrollPercent > maxScroll) {
          maxScroll = scrollPercent
          
          // Track at 25%, 50%, 75%, 100%
          if ([25, 50, 75, 100].includes(scrollPercent)) {
            trackEvent('scroll_depth', 'percentage', window.location.pathname, scrollPercent)
          }
        }
      }

      window.addEventListener('scroll', trackScroll, { passive: true })
      
      return () => window.removeEventListener('scroll', trackScroll)
    }
  }

  const trackTimeOnPage = () => {
    if (typeof window !== 'undefined') {
      const startTime = Date.now()
      
      const trackTime = () => {
        const timeOnPage = Math.round((Date.now() - startTime) / 1000)
        trackEvent('engagement', 'time_on_page', window.location.pathname, timeOnPage)
      }

      // Track time on page every 30 seconds
      const interval = setInterval(trackTime, 30000)
      
      return () => clearInterval(interval)
    }
  }

  return {
    trackUserInteraction,
    trackPageVisibility,
    trackScrollDepth,
    trackTimeOnPage,
  }
}
