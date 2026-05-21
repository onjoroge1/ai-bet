/**
 * Static guide registry. Day-4 placeholder route shape — content
 * authoring happens later as we add proper evergreens.
 *
 * Each guide stays at /guides/{slug} with a stable URL. Existing
 * evergreen blogs at /blog/{slug} are NOT migrated (per the plan
 * — keep their organic traffic). New evergreens go here.
 *
 * To add a guide: append a record + bump `updatedAt` when content
 * changes. Sitemap pulls from this same registry.
 */

export interface Guide {
  slug: string
  title: string
  description: string
  /** HTML body (paragraphs only — no <h1>, no <html>, no <body>). */
  body: string
  /** ISO date — drives <published_date> in schema. */
  publishedAt: string
  updatedAt: string
  /** Optional list of related links the page renders below the body. */
  relatedLinks?: Array<{ label: string; href: string }>
}

export const GUIDES: Guide[] = [
  {
    slug: 'how-ai-predictions-work',
    title: 'How SnapBet AI Predictions Work',
    description:
      'A plain-English explainer of the two-model engine behind every prediction: V1 consensus and V3 Sharp Intelligence.',
    publishedAt: '2026-05-13',
    updatedAt: '2026-05-13',
    body: `
<p>Every fixture on SnapBet runs through two independent prediction models, and we surface both side by side. Neither is a "secret sauce" — both are statistical engines that take what we know about the match and output a probability for each outcome (home, draw, away).</p>

<p><strong>V1 (consensus)</strong> is the baseline. It blends recent form, head-to-head history, and market consensus into a single confidence score. It's stable and well-tested across many leagues.</p>

<p><strong>V3 (Sharp Intelligence)</strong> is a 90-day fresh-era model that adapts to current form more aggressively. In leagues where the meta shifts quickly (a manager change, an injury wave), V3 tends to catch the new pattern faster than V1.</p>

<p>For any given fixture, the page shows you both numbers and — when one model has been meaningfully more accurate on that team's recent matches — flags which one to weight more. Sample size matters: we only show a "Recommended" badge when one model leads by at least 5 percentage points over 10 or more settled matches.</p>

<p>Picks aren't predictions of certainty. A 65% confidence pick still loses 35% of the time. The flat-stake tracker at <a href="/performance">/performance</a> records every premium-qualified pick — wins and losses — so you can audit what the model has actually done.</p>

<p>For the full technical methodology, including how we score picks and what counts as "premium-qualified", see <a href="/methodology">/methodology</a>.</p>
    `.trim(),
    relatedLinks: [
      { label: 'Methodology', href: '/methodology' },
      { label: 'Live performance tracker', href: '/performance' },
      { label: 'Today\'s predictions', href: '/soccer/today' },
    ],
  },
  {
    slug: 'reading-confidence-scores',
    title: 'How to Read SnapBet\'s Confidence Scores',
    description:
      'What a 65% confidence score actually means, when to weight a pick more or less heavily, and the role of sample size.',
    publishedAt: '2026-05-13',
    updatedAt: '2026-05-13',
    body: `
<p>A confidence score is the model's probability that its picked side will win the match. A 65% confidence "Home Win" means the model believes the home side wins 65 out of every 100 times — and crucially, that the away side or a draw still wins 35 out of 100. Confidence is not certainty.</p>

<p><strong>What "high-confidence" means here.</strong> SnapBet flags a pick as high-confidence when at least one of our two models reports 50% or higher confidence. The premium tier requires more — typically 60%+ on V3 in leagues where V3 has historically been the stronger model. Premium-tier picks have been the strongest converter on the public audit at <a href="/performance">/performance</a> — but past performance doesn't guarantee future results.</p>

<p><strong>Sample size before headline.</strong> A 70% confidence score from a model that's only made 5 picks on this team is statistically weaker than a 58% score from a model with 30 picks. When you're looking at a team page, glance at the "n = X" number under each model's accuracy figure. Below 10 we don't even flag a Recommended model.</p>

<p><strong>Confidence and value are different.</strong> A 70% confidence pick at decimal odds 1.30 has the same value (zero edge) as a 50% pick at 2.00. Confidence tells you accuracy; value comes from comparing accuracy to the market's implied probability. The premium tracker on /performance simulates flat $100 stakes regardless of odds, which makes hit-rate the dominant variable. Real-world bet sizing should factor in both confidence AND odds.</p>

<p><strong>When the model says "no bet."</strong> Many matches don't get a picked side at all. That's a feature — we'd rather pass than push a coin-flip call. Fixtures without a meaningful pick still show up in the full fixture lists on <a href="/soccer/today">/soccer/today</a>, but they don't make the top-picks shortlist.</p>
    `.trim(),
    relatedLinks: [
      { label: 'Live performance tracker', href: '/performance' },
      { label: 'Methodology', href: '/methodology' },
      { label: 'Today\'s predictions', href: '/soccer/today' },
    ],
  },
]

const SLUG_MAP = new Map(GUIDES.map(g => [g.slug, g]))

export function getGuideBySlug(slug: string): Guide | null {
  return SLUG_MAP.get(slug) ?? null
}
