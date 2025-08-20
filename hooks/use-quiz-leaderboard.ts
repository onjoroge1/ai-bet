import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export interface LeaderboardEntry {
  id: string
  rank: number
  name: string
  score: string
  totalScore: number
  correctAnswers: number
  questionsAnswered: number
  time: string
  credits: number
  isCurrentUser: boolean
  participatedAt: string
  userId: string | null
}

export interface LeaderboardStats {
  totalParticipants: number
  averageScore: number
  averageCorrect: number
}

export interface LeaderboardData {
  leaderboard: LeaderboardEntry[]
  stats: LeaderboardStats
  generatedAt: string
}

export function useQuizLeaderboard(limit: number = 10, autoRefresh: boolean = true) {
  const { data: session } = useSession()
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: limit.toString(),
        includeCurrentUser: 'true'
      })

      if (session?.user?.id) {
        params.append('userId', session.user.id)
      }

      const response = await fetch(`/api/quiz/leaderboard?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard')
      }

      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch leaderboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Error fetching leaderboard:', err)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard()
  }, [limit, session?.user?.id])

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchLeaderboard()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, limit, session?.user?.id])

  // Manual refresh function
  const refresh = () => {
    fetchLeaderboard()
  }

  // Get current user's position
  const currentUserEntry = data?.leaderboard.find(entry => entry.isCurrentUser)

  // Get top performers (excluding current user if they're not in top 3)
  const topPerformers = data?.leaderboard.slice(0, 3) || []

  // Get other entries (excluding top 3 and current user if they're in top 3)
  const otherEntries = data?.leaderboard.slice(3).filter(entry => !entry.isCurrentUser) || []

  return {
    data,
    loading,
    error,
    refresh,
    currentUserEntry,
    topPerformers,
    otherEntries,
    stats: data?.stats,
    totalParticipants: data?.stats?.totalParticipants || 0,
    averageScore: data?.stats?.averageScore || 0,
    averageCorrect: data?.stats?.averageCorrect || 0
  }
}
