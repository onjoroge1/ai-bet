'use client'

import { useEffect, useState } from 'react'
import { useGoogleAnalytics } from './google-analytics'

interface PerformanceMetrics {
  loadTime: number
  domContentLoaded: number
  firstByte: number
  resourceCount: number
  slowResources: Array<{
    name: string
    loadTime: number
    size: number
  }>
}

/**
 * Performance monitoring component
 * Tracks various performance metrics and sends them to analytics
 */
export function PerformanceMonitoring() {
  const { trackEvent } = useGoogleAnalytics()
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)

  useEffect(() => {
    // Only run in production
    if (process.env.NODE_ENV !== 'production') return

    const collectPerformanceMetrics = () => {
      if (typeof window === 'undefined' || !window.performance) return

      const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[]

      if (!navigation) return

      const loadTime = navigation.loadEventEnd - navigation.loadEventStart
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
      const firstByte = navigation.responseStart - navigation.requestStart

      // Analyze resource performance
      const slowResources = resources
        .filter(resource => {
          const loadTime = resource.responseEnd - resource.requestStart
          return loadTime > 1000 // Resources taking more than 1 second
        })
        .map(resource => ({
          name: resource.name,
          loadTime: resource.responseEnd - resource.requestStart,
          size: resource.transferSize || 0
        }))
        .sort((a, b) => b.loadTime - a.loadTime)
        .slice(0, 5) // Top 5 slowest resources

      const performanceMetrics: PerformanceMetrics = {
        loadTime,
        domContentLoaded,
        firstByte,
        resourceCount: resources.length,
        slowResources
      }

      setMetrics(performanceMetrics)

      // Track performance metrics
      trackEvent('performance', 'page_load', 'load_time', Math.round(loadTime))
      trackEvent('performance', 'page_load', 'dom_content_loaded', Math.round(domContentLoaded))
      trackEvent('performance', 'page_load', 'first_byte', Math.round(firstByte))
      trackEvent('performance', 'page_load', 'resource_count', resources.length)

      // Track slow resources
      slowResources.forEach((resource, index) => {
        trackEvent('performance', 'slow_resource', resource.name, Math.round(resource.loadTime))
      })
    }

    // Collect metrics after page load
    if (document.readyState === 'complete') {
      collectPerformanceMetrics()
    } else {
      window.addEventListener('load', collectPerformanceMetrics)
    }

    return () => {
      window.removeEventListener('load', collectPerformanceMetrics)
    }
  }, [trackEvent])

  return null
}

/**
 * Error tracking component
 */
export function ErrorTracking() {
  const { trackEvent } = useGoogleAnalytics()

  useEffect(() => {
    // Only run in production
    if (process.env.NODE_ENV !== 'production') return

    const handleError = (event: ErrorEvent) => {
      trackEvent('error', 'javascript_error', event.filename, undefined, {
        error_message: event.message,
        error_line: event.lineno,
        error_column: event.colno,
        error_stack: event.error?.stack
      })
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      trackEvent('error', 'unhandled_promise_rejection', 'promise', undefined, {
        error_message: event.reason?.message || 'Unknown promise rejection',
        error_stack: event.reason?.stack
      })
    }

    const handleResourceError = (event: Event) => {
      const target = event.target as HTMLElement
      if (target) {
        trackEvent('error', 'resource_error', target.tagName, undefined, {
          resource_type: target.tagName,
          resource_src: (target as any).src || (target as any).href
        })
      }
    }

    // Add error listeners
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleResourceError, true)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleResourceError, true)
    }
  }, [trackEvent])

  return null
}

/**
 * User interaction tracking hook
 */
export function useUserInteractionTracking() {
  const { trackEvent } = useGoogleAnalytics()

  const trackClick = (element: string, location: string) => {
    trackEvent('user_interaction', 'click', element, undefined, {
      location: location,
      timestamp: Date.now()
    })
  }

  const trackFormSubmission = (formName: string, success: boolean) => {
    trackEvent('user_interaction', 'form_submission', formName, undefined, {
      success: success,
      timestamp: Date.now()
    })
  }

  const trackDownload = (fileName: string, fileType: string) => {
    trackEvent('user_interaction', 'download', fileName, undefined, {
      file_type: fileType,
      timestamp: Date.now()
    })
  }

  const trackVideoInteraction = (videoId: string, action: string, progress?: number) => {
    trackEvent('user_interaction', 'video_interaction', videoId, progress, {
      action: action,
      timestamp: Date.now()
    })
  }

  const trackSearch = (query: string, results: number) => {
    trackEvent('user_interaction', 'search', query, results, {
      timestamp: Date.now()
    })
  }

  const trackPredictionInteraction = (predictionId: string, action: string, confidence?: number) => {
    trackEvent('user_interaction', 'prediction_interaction', predictionId, confidence, {
      action: action,
      timestamp: Date.now()
    })
  }

  return {
    trackClick,
    trackFormSubmission,
    trackDownload,
    trackVideoInteraction,
    trackSearch,
    trackPredictionInteraction
  }
}

/**
 * Real User Monitoring (RUM) component
 */
export function RealUserMonitoring() {
  const { trackEvent } = useGoogleAnalytics()

  useEffect(() => {
    // Only run in production
    if (process.env.NODE_ENV !== 'production') return

    const trackUserAgent = () => {
      const userAgent = navigator.userAgent
      const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent)
      const isTablet = /iPad|Android(?!.*Mobile)/.test(userAgent)
      const deviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'

      trackEvent('user_info', 'device_type', deviceType, undefined, {
        user_agent: userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`
      })
    }

    const trackConnectionInfo = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        trackEvent('user_info', 'connection', connection.effectiveType, undefined, {
          connection_type: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        })
      }
    }

    const trackPageVisibility = () => {
      let visibilityStart = Date.now()
      
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          const timeVisible = Date.now() - visibilityStart
          trackEvent('user_engagement', 'page_visibility', 'hidden', Math.round(timeVisible / 1000))
        } else {
          visibilityStart = Date.now()
          trackEvent('user_engagement', 'page_visibility', 'visible')
        }
      })
    }

    const trackScrollBehavior = () => {
      let maxScroll = 0
      let scrollEvents = 0
      
      const handleScroll = () => {
        const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100)
        scrollEvents++
        
        if (scrollPercent > maxScroll) {
          maxScroll = scrollPercent
        }
      }

      window.addEventListener('scroll', handleScroll, { passive: true })

      // Track scroll behavior on page unload
      window.addEventListener('beforeunload', () => {
        trackEvent('user_engagement', 'scroll_behavior', 'max_scroll', maxScroll, {
          scroll_events: scrollEvents,
          max_scroll_percentage: maxScroll
        })
      })
    }

    // Initialize tracking
    trackUserAgent()
    trackConnectionInfo()
    trackPageVisibility()
    trackScrollBehavior()

  }, [trackEvent])

  return null
}

/**
 * Custom metrics tracking hook
 */
export function useCustomMetrics() {
  const { trackEvent } = useGoogleAnalytics()

  const trackCustomMetric = (metricName: string, value: number, category: string = 'custom') => {
    trackEvent(category, metricName, 'metric', value, {
      timestamp: Date.now()
    })
  }

  const trackBusinessMetric = (metricName: string, value: number, currency?: string) => {
    trackEvent('business_metrics', metricName, 'revenue', value, {
      currency: currency || 'USD',
      timestamp: Date.now()
    })
  }

  const trackConversionFunnel = (step: string, value?: number) => {
    trackEvent('conversion_funnel', step, 'step', value, {
      timestamp: Date.now()
    })
  }

  return {
    trackCustomMetric,
    trackBusinessMetric,
    trackConversionFunnel
  }
}
