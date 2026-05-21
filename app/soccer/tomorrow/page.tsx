import type { Metadata } from 'next'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { NewsArticleSchema, FAQSchema } from '@/components/schema-markup'
import { HubBody } from '@/components/soccer-hub/HubBody'
import { getHubData } from '@/lib/soccer-hubs/data'
import { dailyHubFAQ } from '@/lib/soccer-hubs/faq'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const tomorrow = new Date(Date.now() + 86400 * 1000)
  const label = tomorrow.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    title: `AI Soccer Predictions Tomorrow — ${label} | SnapBet AI`,
    description: `Tomorrow's AI-driven soccer predictions: high-confidence picks ranked by model confidence, full fixtures grouped by league, live performance tracker.`,
    alternates: { canonical: '/soccer/tomorrow' },
    openGraph: {
      title: `AI Soccer Predictions — ${label}`,
      description: `Tomorrow's high-confidence soccer picks from SnapBet's V1 + V3 models.`,
      url: '/soccer/tomorrow',
      type: 'website',
    },
  }
}

export default async function SoccerTomorrowPage() {
  const data = await getHubData({ dayName: 'tomorrow' })
  const faqs = dailyHubFAQ('tomorrow')

  const intro = data.totalFixtures > 0
    ? `${data.totalFixtures} soccer fixture${data.totalFixtures === 1 ? '' : 's'} on the board for tomorrow across ${data.byLeague.length} league${data.byLeague.length === 1 ? '' : 's'}. Models flagged ${data.topPicks.length} high-confidence pick${data.topPicks.length === 1 ? '' : 's'} so far — predictions can update closer to kickoff as additional signals land. Audit performance at /performance.`
    : `Tomorrow's slate hasn't fully landed yet — check back later, or see today's picks.`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <NewsArticleSchema
        headline={`AI Soccer Predictions — ${data.dayLabel}`}
        description="Tomorrow's AI-driven soccer predictions: high-confidence picks ranked by model confidence."
        datePublished={data.fetchedAt.toISOString()}
        dateModified={data.fetchedAt.toISOString()}
        author="SnapBet AI Team"
        publisher="SnapBet AI"
        articleSection="Predictions"
        articleBody={`${data.totalFixtures} fixtures. ${data.topPicks.length} high-confidence picks.`}
      />
      <FAQSchema faqs={faqs} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb context={{ title: 'Tomorrow' }} />
      </div>

      <HubBody data={data} intro={intro} faqs={faqs} />
    </div>
  )
}
