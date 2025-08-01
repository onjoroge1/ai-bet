import { useQuery } from "@tanstack/react-query"
import { PredictionsFilters, PredictionsHistoryResponse, PredictionsHistoryStats } from "../types"

// Fetch predictions history data
async function fetchPredictionsHistory(filters: PredictionsFilters): Promise<PredictionsHistoryResponse> {
  const params = new URLSearchParams({
    page: filters.page.toString(),
    limit: filters.limit.toString(),
    search: filters.search,
    league: filters.league,
    status: filters.status === 'all' ? '' : filters.status,
    result: filters.result === 'all' ? '' : filters.result,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  })

  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.append('dateTo', filters.dateTo)

  const response = await fetch(`/api/predictions/history?${params}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch predictions history')
  }

  return response.json()
}

// Fetch predictions history statistics
async function fetchPredictionsHistoryStats(): Promise<PredictionsHistoryStats> {
  const response = await fetch('/api/predictions/history/stats')
  
  if (!response.ok) {
    throw new Error('Failed to fetch predictions history stats')
  }

  return response.json()
}

// Custom hook for predictions history data
export function usePredictionsHistory(filters: PredictionsFilters) {
  return useQuery({
    queryKey: ['predictions-history', filters],
    queryFn: () => fetchPredictionsHistory(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2
  })
}

// Custom hook for predictions history statistics
export function usePredictionsHistoryStats() {
  return useQuery({
    queryKey: ['predictions-history-stats'],
    queryFn: fetchPredictionsHistoryStats,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    retry: 2
  })
} 