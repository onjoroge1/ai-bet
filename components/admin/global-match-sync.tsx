"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Globe, RefreshCw, CheckCircle, AlertTriangle, Clock, TrendingUp } from "lucide-react"
import { toast } from "sonner"

interface SyncStats {
  totalMatches: number
  activeMatches: number
  withPredictionData: number
  withoutPredictionData: number
  lastSync: string | null
}

interface SyncResult {
  success: boolean
  summary: {
    available: number
    created: number
    existing: number
    errors: number
    totalProcessed: number
    coverage: string
    processingTime: {
      milliseconds: number
      minutes: string
    }
  }
  message: string
  errorDetails?: string[]
  timestamp: string
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple'
  subtitle?: string
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    gray: 'bg-gray-500/10 border-gray-500/20 text-gray-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400'
  }

  return (
    <Card className={`${colorClasses[color]} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className="text-2xl opacity-60">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never"
  
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMinutes < 1) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

function calculateCoverage(withPrediction: number, total: number): number {
  if (total === 0) return 0
  return Math.round((withPrediction / total) * 100)
}

export function GlobalMatchSync() {
  const [stats, setStats] = useState<SyncStats>({
    totalMatches: 0,
    activeMatches: 0,
    withPredictionData: 0,
    withoutPredictionData: 0,
    lastSync: null
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingStats, setIsFetchingStats] = useState(true)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  // Fetch current statistics
  const fetchStats = async () => {
    try {
      setIsFetchingStats(true)
      const response = await fetch('/api/admin/predictions/sync-from-availability', {
        method: 'GET'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.statistics) {
        setStats(data.statistics)
      }
    } catch (error) {
      console.error('Failed to fetch sync statistics:', error)
      toast.error('Failed to load sync statistics')
    } finally {
      setIsFetchingStats(false)
    }
  }

  // Load stats on component mount
  useEffect(() => {
    fetchStats()
  }, [])

  const handleSyncAll = async () => {
    setIsLoading(true)
    const startTime = Date.now()
    
    try {
      toast.info('Starting global sync for recent matches...', { 
        description: 'Syncing matches from last 5 days (comprehensive coverage)' 
      })
      
      // Calculate date range for recent matches (last 5 days for comprehensive coverage)
      const fiveDaysAgo = new Date()
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
      const today = new Date()
      
      const fromDate = fiveDaysAgo.toISOString().split('T')[0]
      const toDate = today.toISOString().split('T')[0]
      
      const response = await fetch('/api/admin/predictions/sync-from-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fromDate,
          toDate,
          timeWindow: 'recent'
        })
      })
      
      const result: SyncResult = await response.json()
      
      if (result.success) {
        setLastSyncResult(result)
        
        // Update stats after successful sync
        await fetchStats()
        
        toast.success('Global sync completed!', {
          description: result.message
        })
        
        // Show detailed results
        setShowDetails(true)
      } else {
        toast.error('Global sync failed', {
          description: result.message || 'Unknown error occurred'
        })
        setLastSyncResult(result)
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Global sync error:', error)
      
      toast.error('Sync failed', {
        description: errorMessage
      })
      
      // Create error result for display
      setLastSyncResult({
        success: false,
        summary: {
          available: 0,
          created: 0,
          existing: 0,
          errors: 1,
          totalProcessed: 0,
          coverage: '0%',
          processingTime: {
            milliseconds: Date.now() - startTime,
            minutes: '0.0'
          }
        },
        message: errorMessage,
        timestamp: new Date().toISOString()
      })
      
    } finally {
      setIsLoading(false)
    }
  }

  const coverage = calculateCoverage(stats.withPredictionData, stats.totalMatches)
  const isGoodCoverage = coverage >= 80
  const isMediumCoverage = coverage >= 50

  return (
    <Card className="mb-8 bg-slate-800/60 border-slate-600/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3 text-xl">
              <Globe className="w-6 h-6 text-purple-400" />
              <span className="text-white">Global Match Sync</span>
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                Two-Tier System
              </Badge>
            </CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Sync recent matches using /consensus/sync with date filtering (current_date - 1). 
              Focuses on the most important matches for immediate revenue opportunities.
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchStats}
            disabled={isFetchingStats}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            {isFetchingStats ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Matches"
            value={stats.totalMatches}
            icon={<Globe className="w-6 h-6" />}
            color="blue"
            subtitle="In QuickPurchase"
          />
          <StatCard
            title="With Predictions"
            value={stats.withPredictionData}
            icon={<CheckCircle className="w-6 h-6" />}
            color="green"
            subtitle="Ready for purchase"
          />
          <StatCard
            title="Coverage"
            value={`${coverage}%`}
            icon={<TrendingUp className="w-6 h-6" />}
            color={isGoodCoverage ? "green" : isMediumCoverage ? "yellow" : "red"}
            subtitle="Prediction coverage"
          />
          <StatCard
            title="Last Sync"
            value={formatRelativeTime(stats.lastSync)}
            icon={<Clock className="w-6 h-6" />}
            color="gray"
            subtitle="Latest update"
          />
        </div>

        {/* Coverage Status Alert */}
        {coverage < 80 && (
          <Alert className="border-yellow-500/20 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-200">
              {coverage < 50 ? (
                <>
                  <strong>Low Coverage Detected:</strong> Only {coverage}% of matches have prediction data. 
                  Run global sync to improve coverage and unlock more revenue opportunities.
                </>
              ) : (
                <>
                  <strong>Medium Coverage:</strong> {coverage}% coverage is good, but running global sync 
                  could improve it further.
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={handleSyncAll}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing All Matches...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-2" />
                Sync Recent Matches (Last 5 Days)
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setShowDetails(!showDetails)}
            disabled={!lastSyncResult}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
          
          <Button 
            variant="outline"
            onClick={fetchStats}
            disabled={isFetchingStats}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Stats
          </Button>
        </div>

        {/* Sync Results Details */}
        {showDetails && lastSyncResult && (
          <Card className="bg-slate-700/30 border-slate-600/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {lastSyncResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
                Last Sync Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {lastSyncResult.summary.available}
                  </div>
                  <div className="text-sm text-slate-400">Available</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {lastSyncResult.summary.created}
                  </div>
                  <div className="text-sm text-slate-400">Created</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {lastSyncResult.summary.existing}
                  </div>
                  <div className="text-sm text-slate-400">Existing</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {lastSyncResult.summary.coverage}
                  </div>
                  <div className="text-sm text-slate-400">Coverage</div>
                </div>
              </div>
              
              <div className="text-center text-sm text-slate-400">
                Processing time: {lastSyncResult.summary.processingTime.minutes} minutes
              </div>
              
              {lastSyncResult.summary.errors > 0 && lastSyncResult.errorDetails && (
                <Alert className="border-red-500/20 bg-red-500/10">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-200">
                    <strong>{lastSyncResult.summary.errors} errors occurred:</strong>
                    <ul className="mt-2 space-y-1 text-xs">
                      {lastSyncResult.errorDetails.slice(0, 5).map((error, index) => (
                        <li key={index} className="font-mono">• {error}</li>
                      ))}
                      {lastSyncResult.errorDetails.length > 5 && (
                        <li className="text-slate-400">
                          ... and {lastSyncResult.errorDetails.length - 5} more
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Help Text */}
        <div className="text-xs text-slate-500 bg-slate-800/30 p-3 rounded-lg">
          <strong>How it works:</strong> This sync fetches recent consensus predictions (current_date - 1) from 
          the /consensus/sync endpoint with date filtering and ensures corresponding matches exist in the 
          QuickPurchase table. Focuses on the most important recent matches for immediate revenue opportunities. 
          Use this as your primary sync method for daily operations.
        </div>
      </CardContent>
    </Card>
  )
}
