'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Database, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface SyncResponse {
  success: boolean
  total: number
  processed: number
  created: number
  updated: number
  errors: number
  skipped: number
  durationMs?: number
  error?: string
}

export function AdditionalMarketsSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<SyncResponse | null>(null)

  const handleSync = async () => {
    setIsSyncing(true)

    try {
      const response = await fetch('/api/admin/additional-markets/sync-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data: SyncResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Sync failed')
      }

      setLastSync(data)

      toast.success('Additional Markets sync completed', {
        description: `Processed: ${data.processed}/${data.total}, Created: ${data.created}, Updated: ${data.updated}, Errors: ${data.errors}, Skipped: ${data.skipped}`,
        duration: 8000,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Sync failed', {
        description: errorMessage,
        duration: 5000,
      })
      setLastSync({ success: false, error: errorMessage } as SyncResponse)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-400" />
              Additional Markets Data Sync
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              Sync additional market data from QuickPurchase.predictionData.additional_markets_v2
              to the AdditionalMarketData table for upcoming matches
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Sync Additional Markets
              </>
            )}
          </Button>

          {lastSync && (
            <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                {lastSync.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                <h3 className="font-semibold text-white">
                  {lastSync.success ? 'Last Sync Results' : 'Sync Failed'}
                </h3>
              </div>

              {lastSync.error ? (
                <div className="text-red-400 text-sm">{lastSync.error}</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-slate-400">Total Matches</div>
                    <div className="text-white font-semibold">{lastSync.total}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Processed</div>
                    <div className="text-white font-semibold">{lastSync.processed}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Created</div>
                    <div className="text-emerald-400 font-semibold">{lastSync.created}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Updated</div>
                    <div className="text-blue-400 font-semibold">{lastSync.updated}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Skipped</div>
                    <div className="text-yellow-400 font-semibold">{lastSync.skipped}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Errors</div>
                    <div className="text-red-400 font-semibold">{lastSync.errors}</div>
                  </div>
                  {lastSync.durationMs && (
                    <div>
                      <div className="text-slate-400">Duration</div>
                      <div className="text-white font-semibold">
                        {(lastSync.durationMs / 1000).toFixed(2)}s
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-300">
                <div className="font-semibold mb-1">What this does:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Fetches all UPCOMING matches from MarketMatch table</li>
                  <li>Gets predictionData.additional_markets_v2 from QuickPurchase</li>
                  <li>Extracts V1/V2 model probabilities from MarketMatch</li>
                  <li>Calculates consensus probabilities and edges</li>
                  <li>Stores structured data in AdditionalMarketData table</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

