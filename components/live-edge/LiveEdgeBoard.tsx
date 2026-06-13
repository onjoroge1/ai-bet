"use client"

/**
 * Live Edge board — polls /api/live-edge/board every 25s and re-evaluates
 * client-side TTL every second so a BETTABLE card flips to EXPIRED the moment
 * its `expires_at` passes, without waiting for the next poll (§5). Expired
 * cards are auto-removed after a short grace so the board doesn't grow
 * unbounded. Degrades to a clean "no live games" state when the board is empty
 * (backend not shipped yet → API returns an empty board, never an error).
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Radio, RefreshCw, Tv } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { LiveEdgeBoard as Board } from '@/lib/live-edge/types'
import { sortBoard, effectiveStatus, secondsAgo } from '@/lib/live-edge/logic'
import { LiveEdgeCard } from './LiveEdgeCard'

const POLL_MS = 25_000

export function LiveEdgeBoard() {
  const [board, setBoard] = useState<Board | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(() => new Date())
  const [error, setError] = useState(false)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch('/api/live-edge/board', { cache: 'no-store' })
      const data = (await res.json()) as Board
      setBoard(data)
      setFetchedAt(new Date().toISOString())
      setError(false)
    } catch {
      setError(true)
    } finally {
      inFlight.current = false
    }
  }, [])

  // Poll the board.
  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  // 1s ticker drives client-side TTL expiry + "updated Ns ago".
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const cards = board ? sortBoard(board.matches, now) : []
  // Drop cards that have been EXPIRED for a while so the board stays bounded.
  const visible = cards.filter(c => effectiveStatus(c, now) !== 'EXPIRED' || withinGrace(c, now))
  const liveCount = visible.length
  const updated = fetchedAt ? secondsAgo(fetchedAt, now) : null

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Radio className="w-4 h-4 text-red-400 animate-pulse" />
          <span>{liveCount} live {liveCount === 1 ? 'match' : 'matches'}</span>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {updated != null ? `updated ${updated}s ago` : 'updating…'}
        </button>
      </div>

      {/* Empty / loading state */}
      {board && visible.length === 0 && (
        <Card className="bg-slate-800/40 border-slate-700">
          <CardContent className="p-10 text-center">
            <Tv className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-white font-semibold">No live matches right now</p>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              Live Edge surfaces in-game value as matches play. Check back during a fixture —
              the board updates every {POLL_MS / 1000}s.
            </p>
          </CardContent>
        </Card>
      )}

      {!board && !error && (
        <Card className="bg-slate-800/40 border-slate-700">
          <CardContent className="p-10 text-center text-slate-400 text-sm">Loading live board…</CardContent>
        </Card>
      )}

      {/* Cards */}
      {visible.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(c => (
            <LiveEdgeCard key={`${c.match_id}-${c.market}`} card={c} now={now} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Keep an expired card visible for a few seconds (animated grace) then drop. */
function withinGrace(card: { expires_at: string | null }, now: Date): boolean {
  if (!card.expires_at) return false
  const exp = Date.parse(card.expires_at)
  if (Number.isNaN(exp)) return false
  return now.getTime() - exp < 6000
}
