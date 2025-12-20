"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface SyncResult {
  synced: number
  errors: number
  skipped: number
}

interface SyncResponse {
  success: boolean
  results?: {
    live?: SyncResult
    upcoming?: SyncResult
    completed?: SyncResult
  }
  summary?: {
    totalSynced: number
    totalErrors: number
    totalSkipped: number
    duration: string
  }
  error?: string
}

export function MarketSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<SyncResponse | null>(null)
  const [syncType, setSyncType] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all')

  const handleSync = async (type: 'all' | 'live' | 'upcoming' | 'completed', force: boolean = false) => {
    setIsSyncing(true)
    setSyncType(type)

    try {
      const response = await fetch('/api/admin/market/sync-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, force }),
      })

      const data: SyncResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Sync failed')
      }

      setLastSync(data)

      // Show success toast
      const summary = data.summary
      if (summary) {
        toast.success('Market sync completed', {
          description: `Synced: ${summary.totalSynced}, Errors: ${summary.totalErrors}, Skipped: ${summary.totalSkipped}`,
          duration: 5000,
        })
      } else {
        toast.success('Market sync completed')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Sync failed', {
        description: errorMessage,
        duration: 5000,
      })
      setLastSync({ success: false, error: errorMessage })
    } finally {
      setIsSyncing(false)
    }
  }

  const getSyncButtonLabel = (type: string) => {
    switch (type) {
      case 'live':
        return 'Sync Live'
      case 'upcoming':
        return 'Sync Upcoming'
      case 'completed':
        return 'Sync Completed'
      default:
        return 'Sync All'
    }
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 text-emerald-400" />
            <span>Market Data Sync</span>
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Manually sync market data from external API
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <Button
          onClick={() => handleSync('all')}
          disabled={isSyncing}
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          {isSyncing && syncType === 'all' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sync All
        </Button>

        <Button
          onClick={() => handleSync('live')}
          disabled={isSyncing}
          variant="outline"
          size="sm"
          className="border-red-600 text-red-300 hover:bg-red-700/20 hover:text-red-200"
        >
          {isSyncing && syncType === 'live' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sync Live
        </Button>

        <Button
          onClick={() => handleSync('upcoming')}
          disabled={isSyncing}
          variant="outline"
          size="sm"
          className="border-blue-600 text-blue-300 hover:bg-blue-700/20 hover:text-blue-200"
        >
          {isSyncing && syncType === 'upcoming' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sync Upcoming
        </Button>

        <Button
          onClick={() => handleSync('completed')}
          disabled={isSyncing}
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          {isSyncing && syncType === 'completed' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sync Completed
        </Button>
      </div>

      {/* Force Sync Option */}
      <div className="mb-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={isSyncing}
              variant="destructive"
              size="sm"
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Force Sync All (Ignore Recent Syncs)
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Force Sync All Matches?</AlertDialogTitle>
              <AlertDialogDescription>
                This will sync all matches regardless of when they were last synced.
                This may take longer and use more API calls. Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleSync('all', true)}>
                Force Sync
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Last Sync Results */}
      {lastSync && (
        <div className="mt-4 p-3 bg-slate-900/50 rounded border border-slate-700">
          <div className="flex items-center space-x-2 mb-2">
            {lastSync.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm font-semibold text-white">
              {lastSync.success ? 'Last Sync Results' : 'Sync Failed'}
            </span>
          </div>

          {lastSync.success && lastSync.summary && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Synced:</span>
                <span className="text-emerald-400 font-semibold">{lastSync.summary.totalSynced}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Errors:</span>
                <span className={lastSync.summary.totalErrors > 0 ? "text-red-400 font-semibold" : "text-slate-300"}>
                  {lastSync.summary.totalErrors}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Skipped:</span>
                <span className="text-slate-300">{lastSync.summary.totalSkipped}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="text-slate-300">{lastSync.summary.duration}</span>
              </div>
            </div>
          )}

          {lastSync.results && (
            <div className="mt-3 pt-3 border-t border-slate-700 space-y-2 text-xs">
              {lastSync.results.live && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Live:</span>
                  <span className="text-slate-300">
                    {lastSync.results.live.synced} synced, {lastSync.results.live.errors} errors
                  </span>
                </div>
              )}
              {lastSync.results.upcoming && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Upcoming:</span>
                  <span className="text-slate-300">
                    {lastSync.results.upcoming.synced} synced, {lastSync.results.upcoming.errors} errors
                  </span>
                </div>
              )}
              {lastSync.results.completed && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Completed:</span>
                  <span className="text-slate-300">
                    {lastSync.results.completed.synced} synced, {lastSync.results.completed.errors} errors
                  </span>
                </div>
              )}
            </div>
          )}

          {lastSync.error && (
            <div className="mt-2 text-sm text-red-400">
              Error: {lastSync.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

