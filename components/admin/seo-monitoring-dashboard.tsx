'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink,
  BarChart3,
  Globe,
  Smartphone
} from 'lucide-react'

interface SEOMetrics {
  pageSpeed: {
    score: number
    lcp: number
    fid: number
    cls: number
    fcp: number
    ttfb: number
  }
  searchConsole: {
    clicks: number
    impressions: number
    ctr: number
    position: number
  }
  technicalSEO: {
    sitemapStatus: 'healthy' | 'warning' | 'error'
    robotsTxtStatus: 'healthy' | 'warning' | 'error'
    metaTagsStatus: 'healthy' | 'warning' | 'error'
    structuredDataStatus: 'healthy' | 'warning' | 'error'
  }
  contentSEO: {
    keywordDensity: number
    readabilityScore: number
    internalLinks: number
    externalLinks: number
  }
}

/**
 * SEO Monitoring Dashboard
 * Provides comprehensive SEO metrics and monitoring
 */
export function SEOMonitoringDashboard() {
  const [metrics, setMetrics] = useState<SEOMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    fetchSEOMetrics()
    // Refresh metrics every 5 minutes
    const interval = setInterval(fetchSEOMetrics, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchSEOMetrics = async () => {
    try {
      setLoading(true)
      // In a real implementation, this would fetch from your analytics API
      const mockMetrics: SEOMetrics = {
        pageSpeed: {
          score: 85,
          lcp: 2.1,
          fid: 45,
          cls: 0.05,
          fcp: 1.2,
          ttfb: 180
        },
        searchConsole: {
          clicks: 1250,
          impressions: 15600,
          ctr: 8.01,
          position: 12.5
        },
        technicalSEO: {
          sitemapStatus: 'healthy',
          robotsTxtStatus: 'healthy',
          metaTagsStatus: 'healthy',
          structuredDataStatus: 'warning'
        },
        contentSEO: {
          keywordDensity: 2.3,
          readabilityScore: 72,
          internalLinks: 45,
          externalLinks: 12
        }
      }
      
      setMetrics(mockMetrics)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error fetching SEO metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />
      case 'warning': return <AlertTriangle className="w-4 h-4" />
      case 'error': return <AlertTriangle className="w-4 h-4" />
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Failed to load SEO metrics</p>
        <Button onClick={fetchSEOMetrics} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">SEO Monitoring Dashboard</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Last updated: {lastUpdated?.toLocaleString()}
          </p>
        </div>
        <Button onClick={fetchSEOMetrics} variant="outline">
          Refresh Metrics
        </Button>
      </div>

      {/* Page Speed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Core Web Vitals</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">{metrics.pageSpeed.score}</div>
              <div className="text-sm text-gray-500">Overall Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{metrics.pageSpeed.lcp}s</div>
              <div className="text-sm text-gray-500">LCP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{metrics.pageSpeed.fid}ms</div>
              <div className="text-sm text-gray-500">FID</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{metrics.pageSpeed.cls}</div>
              <div className="text-sm text-gray-500">CLS</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-600">{metrics.pageSpeed.fcp}s</div>
              <div className="text-sm text-gray-500">FCP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{metrics.pageSpeed.ttfb}ms</div>
              <div className="text-sm text-gray-500">TTFB</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Console Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="w-5 h-5" />
            <span>Search Console Performance</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{metrics.searchConsole.clicks.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Clicks</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{metrics.searchConsole.impressions.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Impressions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{metrics.searchConsole.ctr}%</div>
              <div className="text-sm text-gray-500">CTR</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{metrics.searchConsole.position}</div>
              <div className="text-sm text-gray-500">Avg Position</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical SEO Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5" />
            <span>Technical SEO Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-medium">Sitemap</span>
              <Badge className={getStatusColor(metrics.technicalSEO.sitemapStatus)}>
                {getStatusIcon(metrics.technicalSEO.sitemapStatus)}
                <span className="ml-1 capitalize">{metrics.technicalSEO.sitemapStatus}</span>
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-medium">Robots.txt</span>
              <Badge className={getStatusColor(metrics.technicalSEO.robotsTxtStatus)}>
                {getStatusIcon(metrics.technicalSEO.robotsTxtStatus)}
                <span className="ml-1 capitalize">{metrics.technicalSEO.robotsTxtStatus}</span>
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-medium">Meta Tags</span>
              <Badge className={getStatusColor(metrics.technicalSEO.metaTagsStatus)}>
                {getStatusIcon(metrics.technicalSEO.metaTagsStatus)}
                <span className="ml-1 capitalize">{metrics.technicalSEO.metaTagsStatus}</span>
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-medium">Structured Data</span>
              <Badge className={getStatusColor(metrics.technicalSEO.structuredDataStatus)}>
                {getStatusIcon(metrics.technicalSEO.structuredDataStatus)}
                <span className="ml-1 capitalize">{metrics.technicalSEO.structuredDataStatus}</span>
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content SEO Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5" />
            <span>Content SEO</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{metrics.contentSEO.keywordDensity}%</div>
              <div className="text-sm text-gray-500">Keyword Density</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{metrics.contentSEO.readabilityScore}</div>
              <div className="text-sm text-gray-500">Readability Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{metrics.contentSEO.internalLinks}</div>
              <div className="text-sm text-gray-500">Internal Links</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{metrics.contentSEO.externalLinks}</div>
              <div className="text-sm text-gray-500">External Links</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Search Console
            </Button>
            <Button variant="outline" size="sm">
              <BarChart3 className="w-4 h-4 mr-2" />
              PageSpeed Insights
            </Button>
            <Button variant="outline" size="sm">
              <TrendingUp className="w-4 h-4 mr-2" />
              SEO Audit
            </Button>
            <Button variant="outline" size="sm">
              <Search className="w-4 h-4 mr-2" />
              Keyword Research
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
