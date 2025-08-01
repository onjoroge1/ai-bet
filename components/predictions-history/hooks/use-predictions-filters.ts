import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PredictionsFilters } from '../types'

const defaultFilters: PredictionsFilters = {
  page: 1,
  limit: 20,
  search: '',
  league: '',
  status: 'all',
  result: 'all',
  sortBy: 'createdAt',
  sortOrder: 'desc'
}

export function usePredictionsFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<PredictionsFilters>(defaultFilters)

  // Initialize filters from URL on mount
  useEffect(() => {
    const newFilters = { ...defaultFilters }
    
    // Parse URL parameters
    newFilters.page = parseInt(searchParams.get('page') || '1')
    newFilters.limit = parseInt(searchParams.get('limit') || '20')
    newFilters.search = searchParams.get('search') || ''
    newFilters.league = searchParams.get('league') || ''
    newFilters.status = searchParams.get('status') || 'all'
    newFilters.result = searchParams.get('result') || 'all'
    newFilters.sortBy = searchParams.get('sortBy') || 'createdAt'
    newFilters.sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
    newFilters.dateFrom = searchParams.get('dateFrom') || undefined
    newFilters.dateTo = searchParams.get('dateTo') || undefined

    setFilters(newFilters)
  }, [searchParams])

  // Update URL when filters change
  const updateURL = (newFilters: PredictionsFilters) => {
    const params = new URLSearchParams()
    
    if (newFilters.page > 1) params.set('page', newFilters.page.toString())
    if (newFilters.limit !== 20) params.set('limit', newFilters.limit.toString())
    if (newFilters.search) params.set('search', newFilters.search)
    if (newFilters.league) params.set('league', newFilters.league)
    if (newFilters.status && newFilters.status !== 'all') params.set('status', newFilters.status)
    if (newFilters.result && newFilters.result !== 'all') params.set('result', newFilters.result)
    if (newFilters.sortBy !== 'createdAt') params.set('sortBy', newFilters.sortBy)
    if (newFilters.sortOrder !== 'desc') params.set('sortOrder', newFilters.sortOrder)
    if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom)
    if (newFilters.dateTo) params.set('dateTo', newFilters.dateTo)

    const queryString = params.toString()
    const newURL = queryString ? `/tips-history?${queryString}` : '/tips-history'
    
    router.push(newURL, { scroll: false })
  }

  // Update filters
  const updateFilters = (updates: Partial<PredictionsFilters>) => {
    const newFilters: PredictionsFilters = { ...filters, ...updates, page: 1 } // Reset to page 1 when filters change
    setFilters(newFilters)
    updateURL(newFilters)
  }

  // Reset filters
  const resetFilters = () => {
    setFilters(defaultFilters)
    router.push('/tips-history', { scroll: false })
  }

  // Set page
  const setPage = (page: number) => {
    const newFilters: PredictionsFilters = { ...filters, page }
    setFilters(newFilters)
    updateURL(newFilters)
  }

  // Toggle sort order
  const toggleSort = () => {
    const newSortOrder: 'asc' | 'desc' = filters.sortOrder === 'asc' ? 'desc' : 'asc'
    const newFilters: PredictionsFilters = { ...filters, sortOrder: newSortOrder, page: 1 }
    setFilters(newFilters)
    updateURL(newFilters)
  }

  return {
    filters,
    updateFilters,
    resetFilters,
    setPage,
    toggleSort
  }
} 