'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  Flame, 
  Hash, 
  ArrowUp,
  Eye,
  Clock,
  Zap
} from 'lucide-react'
import Link from 'next/link'

interface BlogPost {
  id: string
  title: string
  slug: string
  category: string
  viewCount: number
  tags: string[]
}

interface TrendingTopic {
  id: string
  title: string
  category: string
  trend: 'up' | 'down' | 'stable'
  views: number
  change: number
  tags: string[]
  slug?: string // Add slug for navigation
}

interface TrendingTopicsProps {
  blogPosts?: BlogPost[]
}

const mockTrendingTopics: TrendingTopic[] = [
  {
    id: '1',
    title: 'Manchester United vs Liverpool Predictions',
    category: 'Premier League',
    trend: 'up',
    views: 15420,
    change: 23,
    tags: ['manchester-united', 'liverpool', 'premier-league', 'predictions']
  },
  {
    id: '2',
    title: 'AI Betting Strategy Guide 2025',
    category: 'Strategy',
    trend: 'up',
    views: 12850,
    change: 18,
    tags: ['ai-betting', 'strategy', 'guide', '2025']
  },
  {
    id: '3',
    title: 'Champions League Quarter-Final Analysis',
    category: 'Analysis',
    trend: 'up',
    views: 11230,
    change: 15,
    tags: ['champions-league', 'quarter-final', 'analysis']
  },
  {
    id: '4',
    title: 'Best Betting Apps for 2025',
    category: 'Technology',
    trend: 'stable',
    views: 9870,
    change: 5,
    tags: ['betting-apps', 'technology', '2025']
  },
  {
    id: '5',
    title: 'How to Read Betting Odds',
    category: 'Tips',
    trend: 'up',
    views: 8650,
    change: 12,
    tags: ['betting-odds', 'tips', 'beginners']
  },
  {
    id: '6',
    title: 'Weekend Football Predictions',
    category: 'Predictions',
    trend: 'up',
    views: 7430,
    change: 28,
    tags: ['weekend', 'football', 'predictions']
  },
  {
    id: '7',
    title: 'Live Betting Strategies',
    category: 'Strategy',
    trend: 'down',
    views: 6540,
    change: -8,
    tags: ['live-betting', 'strategy', 'in-play']
  },
  {
    id: '8',
    title: 'Top 10 Betting Mistakes to Avoid',
    category: 'Tips',
    trend: 'up',
    views: 5980,
    change: 9,
    tags: ['betting-mistakes', 'tips', 'avoid']
  }
]

export function TrendingTopics({ blogPosts }: TrendingTopicsProps) {
  const [topics, setTopics] = useState<TrendingTopic[]>(mockTrendingTopics)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Fetch real trending data from API or use provided blogPosts
  useEffect(() => {
    if (blogPosts && blogPosts.length > 0) {
      // Transform blog data to trending topics
      const realTopics = blogPosts.slice(0, 8).map((blog, index) => ({
        id: blog.id,
        title: blog.title,
        category: blog.category,
        trend: 'up' as const, // Default trend
        views: blog.viewCount || 0,
        change: 0, // No simulated change - only real data
        tags: blog.tags || [],
        slug: blog.slug // Include slug for navigation
      }))
      setTopics(realTopics)
    } else {
      // Fallback to mock data if no blog posts provided
      fetchTrendingData()
    }
    
    const interval = setInterval(() => {
      if (!blogPosts || blogPosts.length === 0) {
    fetchTrendingData()
      }
    }, 300000) // Update every 5 minutes only if not using blog posts
    
    return () => clearInterval(interval)
  }, [blogPosts])

  const fetchTrendingData = async () => {
    try {
      // Fetch real blog analytics data
      const response = await fetch('/api/blogs?limit=20')
      const data = await response.json()
      
      if (data.success && data.data.length > 0) {
        // Transform blog data to trending topics
        const realTopics = data.data.slice(0, 8).map((blog: any, index: number) => ({
          id: blog.id,
          title: blog.title,
          category: blog.category,
          trend: 'up' as const, // Default trend
          views: blog.viewCount || 0,
          change: 0, // No simulated change - only real data
          tags: blog.tags || [],
          slug: blog.slug // Include slug for navigation
        }))
        setTopics(realTopics)
      } else {
        // No data available
        setTopics([])
      }
    } catch (error) {
      console.error('Error fetching trending data:', error)
      // Don't show trending topics if API fails
      setTopics([])
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="w-3 h-3 text-green-400" />
      case 'down':
        return <ArrowUp className="w-3 h-3 text-red-400 rotate-180" />
      default:
        return <TrendingUp className="w-3 h-3 text-slate-400" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-400'
      case 'down':
        return 'text-red-400'
      default:
        return 'text-slate-400'
    }
  }

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`
    }
    return views.toString()
  }

  const filteredTopics = selectedCategory === 'all' 
    ? topics 
    : topics.filter(topic => topic.category.toLowerCase() === selectedCategory.toLowerCase())

  return (
    <div className="bg-slate-800/30 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
                         <div className="p-2 bg-orange-500/20 rounded-lg">
               <Flame className="w-5 h-5 text-orange-400" />
             </div>
            <h2 className="text-xl font-bold text-white">Trending Topics</h2>
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
              LIVE
            </Badge>
          </div>
                     <div className="flex items-center gap-2 text-sm text-slate-400">
             <Clock className="w-4 h-4" />
             Updated every 5 minutes
           </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className="whitespace-nowrap"
          >
            All Topics
          </Button>
          <Button
            variant={selectedCategory === 'predictions' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory('predictions')}
            className="whitespace-nowrap"
          >
            Predictions
          </Button>
          <Button
            variant={selectedCategory === 'strategy' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory('strategy')}
            className="whitespace-nowrap"
          >
            Strategy
          </Button>
          <Button
            variant={selectedCategory === 'analysis' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory('analysis')}
            className="whitespace-nowrap"
          >
            Analysis
          </Button>
          <Button
            variant={selectedCategory === 'tips' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory('tips')}
            className="whitespace-nowrap"
          >
            Tips
          </Button>
        </div>

        {/* Trending Topics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTopics.slice(0, 8).map((topic, index) => (
            <Card 
              key={topic.id} 
              className="bg-slate-700/50 border-slate-600 hover:border-orange-500/50 transition-all duration-300 cursor-pointer group"
            >
              {topic.slug ? (
                <Link href={`/blog/${topic.slug}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        #{index + 1}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(topic.trend)}
                        <span className={`text-xs font-semibold ${getTrendColor(topic.trend)}`}>
                          {topic.change > 0 ? '+' : ''}{topic.change}%
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-orange-400 transition-colors overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {topic.title}
                    </h3>

                    <div className="flex items-center justify-between mb-3">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                        {topic.category}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Eye className="w-3 h-3" />
                        {formatViews(topic.views)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {topic.tags.slice(0, 3).map((tag) => (
                        <span 
                          key={tag} 
                          className="text-xs text-slate-400 bg-slate-600/50 px-2 py-1 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                      {topic.tags.length > 3 && (
                        <span className="text-xs text-slate-500">
                          +{topic.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Link>
              ) : (
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    #{index + 1}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {getTrendIcon(topic.trend)}
                    <span className={`text-xs font-semibold ${getTrendColor(topic.trend)}`}>
                      {topic.change > 0 ? '+' : ''}{topic.change}%
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-orange-400 transition-colors overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {topic.title}
                </h3>

                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                    {topic.category}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Eye className="w-3 h-3" />
                    {formatViews(topic.views)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {topic.tags.slice(0, 3).map((tag) => (
                    <span 
                      key={tag} 
                      className="text-xs text-slate-400 bg-slate-600/50 px-2 py-1 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                  {topic.tags.length > 3 && (
                    <span className="text-xs text-slate-500">
                      +{topic.tags.length - 3} more
                    </span>
                  )}
                </div>
              </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Trending Hashtags */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Hash className="w-5 h-5 text-orange-400" />
            Trending Hashtags
          </h3>
          <div className="flex flex-wrap gap-2">
            {['#PremierLeague', '#ChampionsLeague', '#AIPredictions', '#BettingTips', '#LiveBetting', '#FootballPredictions', '#BettingStrategy', '#WeekendBets'].map((hashtag) => (
              <Button
                key={hashtag}
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-orange-500/20 hover:border-orange-500/50 hover:text-orange-400"
              >
                {hashtag}
              </Button>
            ))}
          </div>
        </div>

        {/* Real Analytics Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-orange-400">
              {topics.reduce((sum, topic) => sum + topic.views, 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">Total Views</div>
          </div>
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-emerald-400">{topics.length}</div>
            <div className="text-xs text-slate-400">Trending Articles</div>
          </div>
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">
              {topics.filter(t => t.views > 0).length}
            </div>
            <div className="text-xs text-slate-400">Articles with Views</div>
          </div>
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-purple-400">
              {Math.max(...topics.map(t => t.views), 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">Highest Views</div>
          </div>
        </div>
      </div>
    </div>
  )
}
