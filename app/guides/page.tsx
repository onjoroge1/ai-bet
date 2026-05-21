import type { Metadata } from 'next'
import Link from 'next/link'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, ChevronRight } from 'lucide-react'
import { GUIDES } from '@/lib/guides/registry'

export const dynamic = 'force-static'
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Sports Betting Guides | SnapBet AI',
  description:
    "Evergreen guides covering how SnapBet's AI predictions work, how to read confidence scores, and other betting fundamentals.",
  alternates: { canonical: '/guides' },
}

export default function GuidesIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-blue-300" />
            Sports Betting Guides
          </h1>
          <p className="text-slate-300 mt-3 max-w-2xl leading-relaxed">
            Evergreen explainers for how the SnapBet AI engine works, how to read its confidence scores,
            and how the performance tracker is audited. New guides land here over time.
          </p>
        </header>

        <div className="space-y-3">
          {GUIDES.map(guide => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="block group"
            >
              <Card className="bg-slate-800 border-slate-700 hover:border-blue-500/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-white group-hover:text-blue-300">{guide.title}</h2>
                      <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">{guide.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5 text-xs text-slate-400 leading-relaxed">
            Looking for daily predictions? See{' '}
            <Link href="/soccer/today" className="text-blue-300 hover:text-blue-200 underline">/soccer/today</Link>.
            For audited model performance, see{' '}
            <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">/performance</Link>.
          </CardContent>
        </Card>
      </article>
    </div>
  )
}
