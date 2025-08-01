import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { TipsFilters } from "../types"

const DEFAULT_FILTERS: TipsFilters = {
  page: 1,
  limit: 20,
  status: 'all',
  package: 'all',
  search: '',
  sortBy: 'claimedAt',
  sortOrder: 'desc'
}

export function useTipsFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Initialize filters from URL params or defaults
  const [filters, setFilters] = useState<TipsFilters>(() => {
    const params = new URLSearchParams(searchParams.toString())
    
    return {
      page: parseInt(params.get('page') || '1'),
      limit: parseInt(params.get('limit') || '20'),
      status: params.get('status') || 'all',
      package: params.get('package') || 'all',
      dateFrom: params.get('dateFrom') || undefined,
      dateTo: params.get('dateTo') || undefined,
      search: params.get('search') || '',
      sortBy: params.get('sortBy') || 'claimedAt',
      sortOrder: (params.get('sortOrder') as 'asc' | 'desc') || 'desc'
    }
  })

  // Update URL when filters change
  const updateURL = useCallback((newFilters: TipsFilters) => {
    const params = new URLSearchParams()
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value.toString())
      }
    })

    const newURL = `/tips-history?${params.toString()}`
    router.push(newURL, { scroll: false })
  }, [router])

  // Update filters and URL
  const updateFilters = useCallback((updates: Partial<TipsFilters>) => {
    const newFilters = { ...filters, ...updates }
    
    // Reset to page 1 when changing filters (except pagination)
    if (updates.status || updates.package || updates.search || updates.dateFrom || updates.dateTo) {
      newFilters.page = 1
    }
    
    setFilters(newFilters)
    updateURL(newFilters)
  }, [filters, updateURL])

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    updateURL(DEFAULT_FILTERS)
  }, [updateURL])

  // Update page
  const setPage = useCallback((page: number) => {
    updateFilters({ page })
  }, [updateFilters])

  // Update limit
  const setLimit = useCallback((limit: number) => {
    updateFilters({ limit, page: 1 }) // Reset to page 1 when changing limit
  }, [updateFilters])

  // Toggle sort order
  const toggleSort = useCallback((sortBy: string) => {
    const newSortOrder = filters.sortBy === sortBy && filters.sortOrder === 'asc' ? 'desc' : 'asc'
    updateFilters({ sortBy, sortOrder: newSortOrder })
  }, [filters.sortBy, filters.sortOrder, updateFilters])

  return {
    filters,
    updateFilters,
    resetFilters,
    setPage,
    setLimit,
    toggleSort
  }
} 