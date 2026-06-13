import type { Metadata } from 'next'
import Link from 'next/link'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Zap, Info, AlertCircle } from 'lucide-react'
import { LiveEdgeBoard } from '@/components/live-edge/LiveEdgeBoard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Live Edge — In-Game Value Detection | SnapBet AI',
  description:
    'Live match intelligence + odds value detection. Snapbet probability vs the live market, in real time, with a hard price guard. Most cards are "watch", not "bet".',
  alternates: { canonical: '/live-edge' },
  robots: { index: false }, // dynamic live board — not an SEO surface
}

export default function LiveEdgePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb customItems={[
          { name: 'Home', href: '/' },
          { name: 'Live Edge', href: '/live-edge', current: true },
        ]} />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <header>
          <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold uppercase tracking-wider">
            <Zap className="w-4 h-4" /> Live Edge
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mt-2">In-game value detection</h1>
          <p className="text-slate-300 mt-3 max-w-3xl leading-relaxed">
            Live match intelligence paired with odds-value detection. We show where our model&apos;s
            in-play probability disagrees with the live market — and we hold a hard price guard so a
            tip is never shown at a price that&apos;s already moved. Most cards are a watch, not a bet.
          </p>
        </header>

        {/* Honesty note — the brand is intelligence, not magic */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              The board updates every 25 seconds. A &quot;Bettable&quot; card carries a short time-to-live —
              once it passes, the edge is treated as gone immediately. The live-odds model is still being
              validated; cards are labelled <span className="text-amber-300">experimental</span> until it
              passes its closing-line holdout, so treat probabilities as information, not a guarantee.
            </p>
          </CardContent>
        </Card>

        <LiveEdgeBoard />

        {/* Disclaimer */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5">
            <p className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <span>
                Live betting is fast and high-variance. EV is a long-run average — individual bets lose
                often. Never bet a price below the stated minimum.
                {' '}<Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Methodology</Link>
                {' · '}
                <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">Bet responsibly</Link>
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
