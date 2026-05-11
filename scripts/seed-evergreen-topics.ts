/**
 * Seed the EvergreenTopic queue with the curated 30-topic list from the
 * blog growth plan. Idempotent — re-running upserts by slug, so adding
 * topics later is just appending to the array below.
 *
 * Run with:
 *   npx tsx scripts/seed-evergreen-topics.ts
 *   npx tsx scripts/seed-evergreen-topics.ts --dry-run   # preview only
 */

import prisma from '../lib/db'

const DRY_RUN = process.argv.includes('--dry-run')

interface SeedTopic {
  title: string
  slug: string
  bucket: 'explainer' | 'strategy' | 'concept' | 'league' | 'beginner'
  productAnchor?: string
  targetQuery: string
  seoKeywords: string[]
  promptHint?: string
}

const TOPICS: SeedTopic[] = [
  // ── Product-feature explainers (anchor for internal links) ─────────────
  {
    title: 'How AI Predictions Work: A Complete Guide',
    slug: 'how-ai-predictions-work',
    bucket: 'explainer',
    productAnchor: 'snapbet-picks',
    targetQuery: 'how do ai predictions work',
    seoKeywords: ['ai predictions', 'sports prediction algorithm', 'machine learning betting', 'snapbet ai'],
    promptHint: 'Refresh of the existing top performer. Highlight V3 Sharp Intelligence and explain the agreement/disagreement signal between V1 and V3.',
  },
  {
    title: 'Understanding Confidence Scores in Sports Predictions',
    slug: 'understanding-confidence-scores',
    bucket: 'explainer',
    productAnchor: 'snapbet-picks',
    targetQuery: 'what is confidence score in sports betting',
    seoKeywords: ['confidence score', 'prediction confidence', 'betting model accuracy', 'sports prediction trust'],
    promptHint: 'Refresh of existing top performer. Tie to calibration curves — how a 70% confidence pick translates to ~78% real-world accuracy.',
  },
  {
    title: 'What is CLV (Closing Line Value) and Why It Matters',
    slug: 'what-is-clv-closing-line-value',
    bucket: 'explainer',
    productAnchor: 'clv',
    targetQuery: 'what is closing line value',
    seoKeywords: ['closing line value', 'clv betting', 'sharp betting', 'beating the closing line'],
    promptHint: 'Explain CLV as the single best long-term proxy for skill in sports betting. Reference how SnapBet tracks it per pick.',
  },
  {
    title: 'How V3 Sharp Intelligence Beats Market Consensus',
    slug: 'how-v3-sharp-intelligence-beats-market',
    bucket: 'explainer',
    productAnchor: 'v3',
    targetQuery: 'sharp intelligence vs market consensus',
    seoKeywords: ['v3 model', 'sharp intelligence', 'consensus betting', 'sharp money'],
    promptHint: 'Position V3 as the in-house ML model. Mention recent calibration: V3 picks at 70-80% confidence hit 86% historical.',
  },
  {
    title: 'Premium vs Value Picks: When to Use Each',
    slug: 'premium-vs-value-picks',
    bucket: 'explainer',
    productAnchor: 'premium',
    targetQuery: 'premium betting picks vs value picks',
    seoKeywords: ['premium picks', 'value picks', 'tier-based betting', 'snapbet tiers'],
    promptHint: 'Premium = 71% accuracy at short odds (break-even EV). Value = 38-40% at 3.4x odds (+31-39% EV). Different products for different risk profiles.',
  },
  {
    title: 'How SnapBet\'s Multisport Models Work (NBA, NHL, Soccer)',
    slug: 'how-snapbet-multisport-models-work',
    bucket: 'explainer',
    productAnchor: 'snapbet-picks',
    targetQuery: 'sports prediction models nba nhl soccer',
    seoKeywords: ['multisport prediction', 'nba ai picks', 'nhl ai picks', 'soccer prediction model'],
    promptHint: 'Each sport behaves differently. NBA: favorites win. NHL: model is under-confident; 65-75% bucket is the sweet spot. Soccer: V1+V3 consensus is the alpha.',
  },
  {
    title: 'What is a No-Vig Probability?',
    slug: 'what-is-no-vig-probability',
    bucket: 'concept',
    productAnchor: 'snapbet-picks',
    targetQuery: 'no vig probability betting',
    seoKeywords: ['no vig', 'true probability', 'sportsbook juice', 'fair odds'],
  },
  {
    title: 'How We Score Parlays: The Combined Edge Method',
    slug: 'how-we-score-parlays',
    bucket: 'explainer',
    productAnchor: 'parlays',
    targetQuery: 'how to score parlay bets',
    seoKeywords: ['parlay scoring', 'combined edge', 'parlay strategy', 'multi-bet ev'],
  },

  // ── Strategy / listicles ───────────────────────────────────────────────
  {
    title: 'Top 5 Betting Strategies for Football',
    slug: 'top-5-football-betting-strategies',
    bucket: 'strategy',
    productAnchor: 'snapbet-picks',
    targetQuery: 'best football betting strategies',
    seoKeywords: ['football betting strategy', 'soccer betting tips', 'profitable betting'],
    promptHint: 'Refresh of existing top performer.',
  },
  {
    title: 'Top 10 Common Sports Betting Mistakes (and How to Avoid Them)',
    slug: 'top-10-sports-betting-mistakes',
    bucket: 'strategy',
    targetQuery: 'common sports betting mistakes',
    seoKeywords: ['betting mistakes', 'why bettors lose', 'avoid losing bets'],
  },
  {
    title: '7 Signs You\'re Making a Sharp vs Square Bet',
    slug: 'sharp-vs-square-bet-signs',
    bucket: 'strategy',
    targetQuery: 'sharp vs square betting',
    seoKeywords: ['sharp bet', 'square bet', 'public betting', 'contrarian betting'],
  },
  {
    title: 'The Best Time to Place a Bet (Early vs Close)',
    slug: 'best-time-to-place-a-bet',
    bucket: 'strategy',
    productAnchor: 'clv',
    targetQuery: 'when is the best time to bet',
    seoKeywords: ['bet timing', 'line shopping', 'pre-match betting', 'closing line'],
  },
  {
    title: 'Top 5 Mid-Season NBA Trends That Burn the Public',
    slug: 'nba-trends-that-burn-the-public',
    bucket: 'strategy',
    productAnchor: 'snapbet-picks',
    targetQuery: 'nba betting trends public',
    seoKeywords: ['nba betting trends', 'public money nba', 'nba contrarian'],
  },
  {
    title: '6 Questions to Ask Before Placing Any Bet',
    slug: 'questions-before-placing-bet',
    bucket: 'strategy',
    targetQuery: 'questions to ask before betting',
    seoKeywords: ['bet checklist', 'pre-bet questions', 'betting discipline'],
  },

  // ── Concept primers ────────────────────────────────────────────────────
  {
    title: 'What is Draw No Bet?',
    slug: 'what-is-draw-no-bet',
    bucket: 'concept',
    targetQuery: 'what is draw no bet',
    seoKeywords: ['draw no bet', 'dnb betting', 'soccer betting types'],
  },
  {
    title: 'How Asian Handicap Lines Work',
    slug: 'how-asian-handicap-works',
    bucket: 'concept',
    targetQuery: 'asian handicap betting',
    seoKeywords: ['asian handicap', 'handicap betting', 'soccer handicap'],
  },
  {
    title: 'Over/Under Betting Explained',
    slug: 'over-under-betting-explained',
    bucket: 'concept',
    targetQuery: 'over under betting how does it work',
    seoKeywords: ['over under', 'totals betting', 'goals total', 'points total'],
  },
  {
    title: 'Decimal vs American vs Fractional Odds',
    slug: 'decimal-vs-american-vs-fractional-odds',
    bucket: 'concept',
    targetQuery: 'decimal american fractional odds difference',
    seoKeywords: ['odds formats', 'decimal odds', 'american odds', 'odds conversion'],
  },
  {
    title: 'What is a "Sharp" Bookmaker?',
    slug: 'what-is-a-sharp-bookmaker',
    bucket: 'concept',
    targetQuery: 'sharp bookmaker vs soft book',
    seoKeywords: ['sharp bookmaker', 'pinnacle', 'sharp lines', 'reduced juice'],
  },
  {
    title: 'How Closing Line Movement Predicts Bet Quality',
    slug: 'closing-line-movement-bet-quality',
    bucket: 'concept',
    productAnchor: 'clv',
    targetQuery: 'closing line movement betting',
    seoKeywords: ['line movement', 'closing line', 'line drift', 'sharp action'],
  },

  // ── League-specific guides ─────────────────────────────────────────────
  {
    title: 'Betting the Premier League: A Strategic Primer',
    slug: 'premier-league-betting-strategic-primer',
    bucket: 'league',
    targetQuery: 'premier league betting strategy',
    seoKeywords: ['premier league betting', 'epl picks', 'english football betting'],
  },
  {
    title: 'Bundesliga vs La Liga: How Their Markets Differ',
    slug: 'bundesliga-vs-la-liga-betting',
    bucket: 'league',
    targetQuery: 'bundesliga vs la liga betting',
    seoKeywords: ['bundesliga betting', 'la liga betting', 'european football comparison'],
  },
  {
    title: 'NBA Regular Season vs Playoffs Betting',
    slug: 'nba-regular-season-vs-playoffs',
    bucket: 'league',
    productAnchor: 'snapbet-picks',
    targetQuery: 'nba playoffs betting vs regular season',
    seoKeywords: ['nba playoffs betting', 'nba regular season', 'basketball betting'],
  },
  {
    title: 'NHL Underdog Betting: Why It Pays',
    slug: 'nhl-underdog-betting',
    bucket: 'league',
    productAnchor: 'snapbet-picks',
    targetQuery: 'nhl underdog betting strategy',
    seoKeywords: ['nhl betting', 'hockey underdogs', 'hockey betting strategy'],
    promptHint: 'Tie to data: NHL underdog picks hit 49% at avg 2.36x odds = +0.15 EV across n=164. Show why this asymmetry exists.',
  },
  {
    title: 'UEFA Champions League: Pre-Round vs Knockout Markets',
    slug: 'ucl-pre-round-vs-knockout',
    bucket: 'league',
    targetQuery: 'ucl knockout round betting',
    seoKeywords: ['ucl betting', 'champions league betting', 'knockout round'],
  },

  // ── Beginner / safety ──────────────────────────────────────────────────
  {
    title: 'How to Start Sports Betting (and Not Lose Your Shirt)',
    slug: 'how-to-start-sports-betting',
    bucket: 'beginner',
    targetQuery: 'how to start sports betting beginner',
    seoKeywords: ['sports betting beginner', 'how to bet on sports', 'first sports bet'],
  },
  {
    title: 'Bankroll Management: The Kelly Criterion Explained',
    slug: 'bankroll-management-kelly-criterion',
    bucket: 'beginner',
    targetQuery: 'kelly criterion sports betting',
    seoKeywords: ['kelly criterion', 'bankroll management', 'bet sizing', 'unit sizing'],
  },
  {
    title: 'Responsible Gambling: Signs to Watch For',
    slug: 'responsible-gambling-signs',
    bucket: 'beginner',
    targetQuery: 'responsible gambling warning signs',
    seoKeywords: ['responsible gambling', 'problem gambling', 'gambling addiction signs'],
  },
  {
    title: 'Why You Should Never Chase Losses',
    slug: 'never-chase-losses',
    bucket: 'beginner',
    targetQuery: 'chasing losses gambling',
    seoKeywords: ['chasing losses', 'tilt betting', 'gambling discipline'],
  },
  {
    title: 'Building a Bet-Tracking Spreadsheet',
    slug: 'bet-tracking-spreadsheet',
    bucket: 'beginner',
    targetQuery: 'how to track sports bets',
    seoKeywords: ['bet tracking', 'betting spreadsheet', 'roi tracking betting'],
  },
]

async function main() {
  console.log(`Seeding ${TOPICS.length} evergreen topics ${DRY_RUN ? '(DRY RUN)' : 'LIVE'}`)
  let created = 0, updated = 0, skipped = 0

  for (const t of TOPICS) {
    const existing = await prisma.evergreenTopic.findUnique({ where: { slug: t.slug } })
    if (existing) {
      // Don't touch published / drafted rows — only update queued metadata
      if (existing.status !== 'queued') {
        skipped++
        console.log(`  - ${t.slug} (status=${existing.status}, not touching)`)
        continue
      }
      if (!DRY_RUN) {
        await prisma.evergreenTopic.update({
          where: { slug: t.slug },
          data: {
            title: t.title, bucket: t.bucket, productAnchor: t.productAnchor ?? null,
            targetQuery: t.targetQuery, seoKeywords: t.seoKeywords, promptHint: t.promptHint ?? null,
          },
        })
      }
      updated++
      console.log(`  ↻ ${t.slug}  [${t.bucket}]`)
    } else {
      if (!DRY_RUN) {
        await prisma.evergreenTopic.create({
          data: {
            title: t.title, slug: t.slug, bucket: t.bucket,
            productAnchor: t.productAnchor ?? null, targetQuery: t.targetQuery,
            seoKeywords: t.seoKeywords, promptHint: t.promptHint ?? null,
          },
        })
      }
      created++
      console.log(`  + ${t.slug}  [${t.bucket}]`)
    }
  }

  console.log(`\nDone. Created: ${created}  Updated: ${updated}  Skipped: ${skipped}`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
