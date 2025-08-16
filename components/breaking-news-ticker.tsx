'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

interface BreakingNews {
  id: string
  title: string
  message: string
  priority: number
  isActive: boolean
  expiresAt?: string
}

export function BreakingNewsTicker() {
  const [breakingNews, setBreakingNews] = useState<BreakingNews[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBreakingNews()
  }, [])

  const fetchBreakingNews = async () => {
    try {
      const response = await fetch('/api/admin/breaking-news')
      const data = await response.json()
      
      if (data.success) {
        // Filter active news and check expiration
        const activeNews = data.data.filter((news: BreakingNews) => {
          if (!news.isActive) return false
          if (news.expiresAt && new Date(news.expiresAt) < new Date()) return false
          return true
        })
        setBreakingNews(activeNews)
      }
    } catch (error) {
      console.error('Error fetching breaking news:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || breakingNews.length === 0) {
    return null // Don't show ticker if no breaking news
  }

  // Sort by priority (highest first)
  const sortedNews = breakingNews.sort((a, b) => b.priority - a.priority)

  return (
    <div className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 border-b border-red-400/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center gap-3 text-white">
          <div className="flex items-center gap-2 bg-red-700 px-3 py-1 rounded-full">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-semibold">BREAKING</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap">
              {sortedNews.map((news, index) => (
                <span key={news.id} className="inline-block mr-8">
                  {news.message}
                  {index < sortedNews.length - 1 && ' • '}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
