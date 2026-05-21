import type { Metadata } from 'next'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { NewsArticleSchema, FAQSchema } from '@/components/schema-markup'
import { HubBody } from '@/components/soccer-hub/HubBody'
import { getHubData } from '@/lib/soccer-hubs/data'
import { dailyHubFAQ } from '@/lib/soccer-hubs/faq'

export const dynamic = 'force-dynamic'
export const revalidate = 300  // 5 min ISR — refreshes during the day as new picks land

export async function generateMetadata(): Promise<Metadata> {
  const today = new Date()
  const label = today.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    title: `AI Soccer Predictions Today — ${label} | SnapBet AI`,
    description: `Today's AI-driven soccer predictions: high-confidence picks ranked by model confidence, full fixtures grouped by league, live performance tracker. Updated every 5 minutes.`,
    alternates: { canonical: '/soccer/today' },
    openGraph: {
      title: `AI Soccer Predictions — ${label}`,
      description: `Today's high-confidence soccer picks from SnapBet's V1 + V3 models.`,
      url: '/soccer/today',
      type: 'website',
    },
  }
}

export default async function SoccerTodayPage() {
  const data = await getHubData({ dayName: 'today' })
  const faqs = dailyHubFAQ('today')

  const intro = data.totalFixtures > 0
    ? `${data.totalFixtures} soccer fixture${data.totalFixtures === 1 ? '' : 's'} scheduled today across ${data.byLeague.length} league${data.byLeague.length === 1 ? '' : 's'}. Our two-model engine (V1 consensus + V3 Sharp Intelligence) has flagged ${data.topPicks.length} high-confidence pick${data.topPicks.length === 1 ? '' : 's'} — ranked below by model confidence. Live performance is audited on /performance.`
    : `No soccer fixtures in our data window for today. Check tomorrow's slate or browse recent analysis on the blog.`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <NewsArticleSchema
        headline={`AI Soccer Predictions — ${data.dayLabel}`}
        description="Today's AI-driven soccer predictions: high-confidence picks ranked by model confidence, full fixtures grouped by league."
        datePublished={data.fetchedAt.toISOString()}
        dateModified={data.fetchedAt.toISOString()}
        author="SnapBet AI Team"
        publisher="SnapBet AI"
        articleSection="Predictions"
        articleBody={`${data.totalFixtures} fixtures across ${data.byLeague.length} leagues. ${data.topPicks.length} high-confidence picks surfaced.`}
      />
      <FAQSchema faqs={faqs} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb context={{ title: 'Today' }} />
      </div>

      <HubBody data={data} intro={intro} faqs={faqs} />
    </div>
  )
}
