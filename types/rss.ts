export interface RSSFeed {
  id: string
  name: string
  url: string
  category: 'sports' | 'betting' | 'football' | 'general'
  priority: 'high' | 'medium' | 'low'
  isActive: boolean
  lastChecked: Date
  checkInterval: number // minutes
}

export interface RSSItem {
  title: string
  description: string
  link: string
  pubDate: Date
  source: string
  category: string
  keywords: string[]
  guid?: string
  author?: string
  content?: string
  imageUrl?: string
}

export interface ContentGenerationRequest {
  newsItem: RSSItem
  targetCategory: string
  targetKeywords: string[]
  targetLength: number // words
  tone: 'professional' | 'casual' | 'analytical'
  includePredictions: boolean
}

export interface GeneratedContent {
  title: string
  excerpt: string
  content: string
  keywords: string[]
  readTime: number
  seoTitle: string
  seoDescription: string
  seoKeywords: string[]
}

export interface BlogPostData {
  title: string
  slug: string
  excerpt: string
  content: string
  author: string
  category: string
  tags: string[]
  geoTarget: string[]
  featured: boolean
  readTime: number
  seoTitle: string
  seoDescription: string
  seoKeywords: string[]
  isPublished: boolean
  sourceUrl?: string // Original news source
  aiGenerated: boolean
}

export interface ValidationResult {
  isValid: boolean
  score: number
  issues: string[]
  suggestions: string[]
}

export interface SEOValidation {
  isValid: boolean
  titleLength: number
  descriptionLength: number
  keywordDensity: number
  issues: string[]
}

export interface ReadabilityScore {
  score: number
  level: 'easy' | 'medium' | 'hard'
  issues: string[]
}

export interface OriginalityScore {
  score: number
  duplicateContent: boolean
  issues: string[]
}

export interface AutomationMetrics {
  // Content generation metrics
  totalArticlesGenerated: number
  articlesPublished: number
  articlesRejected: number
  averageGenerationTime: number
  
  // Quality metrics
  averageQualityScore: number
  factualAccuracyRate: number
  seoOptimizationRate: number
  
  // Engagement metrics
  averageViewCount: number
  averageShareCount: number
  averageTimeOnPage: number
  
  // RSS feed metrics
  totalFeedsMonitored: number
  activeFeeds: number
  averageItemsPerDay: number
  feedHealthScore: number
}

export interface FeedHealth {
  totalFeeds: number
  activeFeeds: number
  lastChecked: Date | null
  averageCheckInterval: number
  failedFeeds: number
  successRate: number
}

export interface RSSFeedStats {
  feedId: string
  feedName: string
  itemsProcessed: number
  itemsGenerated: number
  lastSuccess: Date | null
  lastFailure: Date | null
  successRate: number
  averageResponseTime: number
} 