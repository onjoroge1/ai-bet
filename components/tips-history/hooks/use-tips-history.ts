import { useQuery } from "@tanstack/react-query"
import { TipsFilters, TipsHistoryResponse } from "../types"

// Fetch tips history data
async function fetchTipsHistory(filters: TipsFilters): Promise<TipsHistoryResponse> {
  const params = new URLSearchParams({
    page: filters.page.toString(),
    limit: filters.limit.toString(),
    status: filters.status,
    package: filters.package,
    search: filters.search,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  })

  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.append('dateTo', filters.dateTo)

  const response = await fetch(`/api/tips-history?${params}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch tips history')
  }

  return response.json()
}

// Fetch tips history statistics
async function fetchTipsHistoryStats(): Promise<any> {
  const response = await fetch('/api/tips-history/stats')
  
  if (!response.ok) {
    throw new Error('Failed to fetch tips history stats')
  }

  return response.json()
}

// Custom hook for tips history data
export function useTipsHistory(filters: TipsFilters) {
  return useQuery({
    queryKey: ['tips-history', filters],
    queryFn: () => fetchTipsHistory(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    retry: 2
  })
}

// Custom hook for tips history statistics
export function useTipsHistoryStats() {
  return useQuery({
    queryKey: ['tips-history-stats'],
    queryFn: fetchTipsHistoryStats,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    retry: 2
  })
} 