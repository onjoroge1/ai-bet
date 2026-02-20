import { Metadata } from 'next'
import prisma from '@/lib/db'
import { isNumericSlug, generateMatchSlug } from '@/lib/match-slug'
import { resolveSlugToMatchId } from '@/lib/match-slug-server'

interface MatchLayoutProps {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED DATA HELPERS — used by both generateMetadata & the layout component
   ═══════════════════════════════════════════════════════════════════════════ */

interface MatchCoreData {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  isFinished: boolean
  isLive: boolean
  kickoffDate: Date | null
  finalScore: Record<string, number> | null
  /** AI summary text from predictionData.analysis.ai_summary */
  aiSummary: string | null
  /** Explanation text */
  explanation: string | null
  /** Recommended bet */
  recommendedBet: string | null
  /** Predicted probabilities */
  probs: { home: number; draw: number; away: number } | null
  /** Team analysis */
  homeTeamAnalysis: TeamSSR | null
  awayTeamAnalysis: TeamSSR | null
  /** Confidence factors */
  confidenceFactors: string[]
  /** Risk assessment */
  riskAssessment: string | null
  /** Betting recommendations */
  bettingRecs: {
    primaryBet: string | null
    alternativeBets: string[]
    riskLevel: string | null
  } | null
  /** Prediction analysis risk factors */
  riskFactors: string[]
  /** Model assessment */
  modelAssessment: string | null
  /** Confidence score (0-100) */
  confidenceScore: number | null
  /** Prediction type (home_win / away_win / draw) */
  predictionType: string | null
  /** Value rating */
  valueRating: string | null
  /** Updated at timestamp */
  updatedAt: Date | null
}

interface TeamSSR {
  strengths: string[]
  weaknesses: string[]
  formAssessment: string | null
  injuryImpact: string | null
}

/**
 * Fetches all match data needed by both `generateMetadata` and the layout
 * component in a single pass (2 DB queries via Promise.all).
 */
async function fetchMatchData(slug: string): Promise<MatchCoreData | null> {
  const matchId = await resolveSlugToMatchId(slug)
  if (!matchId) return null

  const [marketMatch, quickPurchase] = await Promise.all([
    prisma.marketMatch.findUnique({
      where: { matchId: String(matchId) },
      select: {
        homeTeam: true,
        awayTeam: true,
        league: true,
        status: true,
        currentScore: true,
        finalResult: true,
        kickoffDate: true,
      },
    }),
    prisma.quickPurchase.findFirst({
      where: {
        matchId: String(matchId),
        type: { in: ['prediction', 'tip'] },
        isActive: true,
      },
      select: {
        predictionData: true,
        analysisSummary: true,
        updatedAt: true,
        name: true,
        confidenceScore: true,
        predictionType: true,
        valueRating: true,
      },
    }),
  ])

  // Determine data sources
  let homeTeam = 'Home Team'
  let awayTeam = 'Away Team'
  let league = ''
  let isFinished = false
  let isLive = false
  let kickoffDate: Date | null = null
  let finalScore: Record<string, number> | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let predictionData: any = null

  if (marketMatch) {
    homeTeam = marketMatch.homeTeam || 'Home Team'
    awayTeam = marketMatch.awayTeam || 'Away Team'
    league = marketMatch.league || ''
    isFinished = marketMatch.status === 'FINISHED'
    isLive = marketMatch.status === 'LIVE'
    kickoffDate = marketMatch.kickoffDate
    finalScore = (marketMatch.finalResult ?? marketMatch.currentScore) as Record<string, number> | null
    if (quickPurchase) {
      predictionData = quickPurchase.predictionData
    }
  } else if (quickPurchase) {
    predictionData = quickPurchase.predictionData
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const md = (quickPurchase as any).matchData
    homeTeam = md?.home?.name || (quickPurchase.name ? quickPurchase.name.split(' vs ')[0]?.trim() : null) || 'Home Team'
    awayTeam = md?.away?.name || (quickPurchase.name ? quickPurchase.name.split(' vs ')[1]?.trim() : null) || 'Away Team'
    league = md?.league?.name || ''
    isFinished = md?.status === 'FINISHED'
    finalScore = md?.final_result?.score || md?.score || null
  } else {
    return null
  }

  // Clean placeholder names
  if (['Home Team', 'Team A'].includes(homeTeam) || homeTeam.includes('TBD')) homeTeam = 'Home Team'
  if (['Away Team', 'Team B'].includes(awayTeam) || awayTeam.includes('TBD')) awayTeam = 'Away Team'

  // Extract prediction content
  const analysis = predictionData?.analysis ?? predictionData?.comprehensive_analysis?.ai_verdict
  const predictions = predictionData?.predictions

  const probs = predictions
    ? {
        home: predictions.home_win ?? 0,
        draw: predictions.draw ?? 0,
        away: predictions.away_win ?? 0,
      }
    : null

  const homeTeamAnalysis = analysis?.team_analysis?.home_team
    ? {
        strengths: analysis.team_analysis.home_team.strengths || [],
        weaknesses: analysis.team_analysis.home_team.weaknesses || [],
        formAssessment: analysis.team_analysis.home_team.form_assessment || null,
        injuryImpact: analysis.team_analysis.home_team.injury_impact || null,
      }
    : null

  const awayTeamAnalysis = analysis?.team_analysis?.away_team
    ? {
        strengths: analysis.team_analysis.away_team.strengths || [],
        weaknesses: analysis.team_analysis.away_team.weaknesses || [],
        formAssessment: analysis.team_analysis.away_team.form_assessment || null,
        injuryImpact: analysis.team_analysis.away_team.injury_impact || null,
      }
    : null

  return {
    matchId: String(matchId),
    homeTeam,
    awayTeam,
    league,
    isFinished,
    isLive,
    kickoffDate,
    finalScore,
    aiSummary: analysis?.ai_summary || null,
    explanation: analysis?.explanation || null,
    recommendedBet: predictions?.recommended_bet || null,
    probs,
    homeTeamAnalysis,
    awayTeamAnalysis,
    confidenceFactors: analysis?.confidence_factors || [],
    riskAssessment: analysis?.risk_assessment || null,
    bettingRecs: analysis?.betting_recommendations
      ? {
          primaryBet: analysis.betting_recommendations.primary_bet || null,
          alternativeBets: analysis.betting_recommendations.alternative_bets || [],
          riskLevel: analysis.betting_recommendations.risk_level || null,
        }
      : null,
    riskFactors: analysis?.prediction_analysis?.risk_factors || [],
    modelAssessment: analysis?.prediction_analysis?.model_assessment || null,
    confidenceScore: quickPurchase?.confidenceScore ?? null,
    predictionType: quickPurchase?.predictionType ?? null,
    valueRating: quickPurchase?.valueRating ?? null,
    updatedAt: quickPurchase?.updatedAt ?? null,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   generateMetadata — SEO <head> tags
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Generate SEO metadata for match pages.
 * For finished matches, this acts as blog-style content with full SEO optimization.
 */
export async function generateMetadata({ params }: MatchLayoutProps): Promise<Metadata> {
  const { slug } = await params
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'

  try {
    const data = await fetchMatchData(slug)
    if (!data || (data.homeTeam === 'Home Team' && data.awayTeam === 'Away Team')) {
      return {
        title: 'Match Not Found | SnapBet AI',
        description: 'View match predictions and analysis powered by AI.',
      }
    }

    const { homeTeam, awayTeam, league, isFinished, finalScore } = data

    // Title & description
    let title: string
    let description: string

    if (isFinished && finalScore) {
      title = `${homeTeam} ${finalScore.home}-${finalScore.away} ${awayTeam} | Match Result & Analysis`
      description = `Final score: ${homeTeam} ${finalScore.home}-${finalScore.away} ${awayTeam}. View complete match analysis, statistics, and AI prediction results. ${league ? `${league} match.` : ''}`
    } else {
      title = `${homeTeam} vs ${awayTeam} | AI Prediction & Analysis`
      const summarySnippet = data.aiSummary
        ? data.aiSummary.replace(/🎯.*?\n\n/s, '').substring(0, 140) + '...'
        : 'Expert analysis, betting recommendations, and confidence scores.'
      description = `Get AI-powered predictions for ${homeTeam} vs ${awayTeam}. ${summarySnippet}`
    }

    const keywords = [
      homeTeam,
      awayTeam,
      `${homeTeam} vs ${awayTeam} prediction`,
      league,
      'football prediction',
      'AI betting tips',
      'match analysis',
      'sports predictions',
      'sports betting',
      'football tips',
    ].filter(Boolean).filter((k) => !['Home Team', 'Away Team', 'Team A', 'Team B'].includes(k))

    // Canonical slug
    let canonicalSlug = slug
    if (isNumericSlug(slug) && homeTeam !== 'Home Team' && awayTeam !== 'Away Team') {
      canonicalSlug = generateMatchSlug(homeTeam, awayTeam)
    }
    const canonical = `${baseUrl}/match/${canonicalSlug}`

    return {
      title,
      description,
      keywords,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        type: isFinished ? 'article' : 'website',
        siteName: 'SnapBet AI',
        ...(isFinished && data.updatedAt && {
          publishedTime: data.updatedAt.toISOString(),
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        creator: '@snapbet',
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      other: {
        ...(isFinished && {
          'article:published_time': (data.updatedAt ?? data.kickoffDate)?.toISOString() || new Date().toISOString(),
          'article:modified_time': (data.updatedAt ?? data.kickoffDate)?.toISOString() || new Date().toISOString(),
          'article:author': 'SnapBet AI',
          'article:section': league || 'Sports',
        }),
      },
    }
  } catch (error) {
    console.error('Error generating match metadata:', error)
    return {
      title: 'Match | SnapBet AI',
      description: 'View match predictions and analysis.',
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FAQ BUILDER — generates FAQPage JSON-LD for long-tail search queries
   ═══════════════════════════════════════════════════════════════════════════ */

function buildFaqSchema(data: MatchCoreData) {
  const { homeTeam, awayTeam, league, probs, bettingRecs, riskAssessment, isFinished, finalScore, confidenceScore, aiSummary } = data
  if (homeTeam === 'Home Team' || awayTeam === 'Away Team') return null

  const matchTitle = `${homeTeam} vs ${awayTeam}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faqs: { question: string; answer: string }[] = []

  if (isFinished && finalScore) {
    faqs.push({
      question: `What was the final score of ${matchTitle}?`,
      answer: `The final score was ${homeTeam} ${finalScore.home} - ${finalScore.away} ${awayTeam}${league ? ` in the ${league}` : ''}.`,
    })
  }

  // Prediction question
  if (probs) {
    const bestOutcome =
      probs.home > probs.away && probs.home > probs.draw
        ? `${homeTeam} to win`
        : probs.away > probs.home && probs.away > probs.draw
        ? `${awayTeam} to win`
        : 'a draw'
    const bestPct = Math.round(Math.max(probs.home, probs.draw, probs.away) * 100)
    faqs.push({
      question: `Who will win ${matchTitle}?`,
      answer: `Our AI model predicts ${bestOutcome} with a ${bestPct}% probability. ${homeTeam} has a ${Math.round(probs.home * 100)}% chance, a draw is at ${Math.round(probs.draw * 100)}%, and ${awayTeam} has a ${Math.round(probs.away * 100)}% chance.`,
    })
  }

  // Confidence
  if (confidenceScore) {
    faqs.push({
      question: `How confident is the AI prediction for ${matchTitle}?`,
      answer: `The AI model has a confidence score of ${confidenceScore}% for this match. ${riskAssessment ? `The risk assessment is rated as "${riskAssessment}".` : ''}`,
    })
  }

  // Betting recommendation
  if (bettingRecs?.primaryBet) {
    faqs.push({
      question: `What is the best bet for ${matchTitle}?`,
      answer: `${bettingRecs.primaryBet}${bettingRecs.alternativeBets.length > 0 ? ` Alternative bets include: ${bettingRecs.alternativeBets.join(', ')}.` : ''}${bettingRecs.riskLevel ? ` Risk level: ${bettingRecs.riskLevel}.` : ''}`,
    })
  }

  // When is the match
  if (data.kickoffDate && !isFinished) {
    const dateStr = data.kickoffDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const timeStr = data.kickoffDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
    faqs.push({
      question: `When is ${matchTitle}?`,
      answer: `${matchTitle} is scheduled for ${dateStr} at ${timeStr}${league ? ` in the ${league}` : ''}.`,
    })
  }

  // AI analysis summary
  if (aiSummary && aiSummary.length > 50) {
    const cleanSummary = aiSummary.replace(/🎯.*?\n\n/s, '').trim()
    if (cleanSummary.length > 50) {
      faqs.push({
        question: `What does the AI analysis say about ${matchTitle}?`,
        answer: cleanSummary.substring(0, 500) + (cleanSummary.length > 500 ? '...' : ''),
      })
    }
  }

  if (faqs.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SERVER-RENDERED ARTICLE — visible in the initial HTML for crawlers
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Renders a semantic `<article>` with real match content that is present in
 * the very first HTML response.  This ensures search-engine crawlers (including
 * those that don't execute JS) can index rich, meaningful text.
 *
 * The article is visually hidden (`sr-only`) so it doesn't duplicate the
 * interactive client page for sighted users, but remains in the DOM for:
 *  • Search-engine crawlers that index the initial HTML before JS executes
 *  • Featured snippet extraction (Google pulls text from server HTML)
 *  • Screen readers and accessibility tools
 */
function ServerRenderedMatchArticle({ data, baseUrl }: { data: MatchCoreData; baseUrl: string }) {
  const { homeTeam, awayTeam, league, isFinished, finalScore, aiSummary,
    explanation, probs, homeTeamAnalysis, awayTeamAnalysis,
    confidenceFactors, bettingRecs, riskAssessment, kickoffDate,
    modelAssessment, confidenceScore, predictionType } = data

  if (homeTeam === 'Home Team' || awayTeam === 'Away Team') return null

  const matchTitle = `${homeTeam} vs ${awayTeam}`
  const canonicalSlug = generateMatchSlug(homeTeam, awayTeam)

  // Format outcome label
  const outcomeLabel =
    predictionType === 'home_win' ? `${homeTeam} Win` :
    predictionType === 'away_win' ? `${awayTeam} Win` :
    predictionType === 'draw' ? 'Draw' :
    predictionType || null

  return (
    <article
      className="sr-only"
      itemScope
      itemType="https://schema.org/Article"
    >
      {/* ── Breadcrumb (visible) ───────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li><a href={baseUrl} className="hover:text-slate-300">Home</a></li>
          <li aria-hidden="true">/</li>
          <li><a href={`${baseUrl}/dashboard/matches`} className="hover:text-slate-300">Matches</a></li>
          {league && (
            <>
              <li aria-hidden="true">/</li>
              <li className="text-slate-400">{league}</li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li className="text-slate-400" aria-current="page">{matchTitle}</li>
        </ol>
      </nav>

      {/* ── Headline ───────────────────────────────────────────────── */}
      <header>
        <h1
          className="text-2xl sm:text-3xl font-bold text-white"
          itemProp="headline"
        >
          {isFinished && finalScore
            ? `${homeTeam} ${finalScore.home}-${finalScore.away} ${awayTeam} — Match Result & AI Analysis`
            : `${matchTitle} Prediction — AI-Powered Analysis${league ? ` | ${league}` : ''}`}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          {league && <span>{league}</span>}
          {kickoffDate && (
            <time dateTime={kickoffDate.toISOString()} itemProp="datePublished">
              {kickoffDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          )}
          <span itemProp="author">SnapBet AI</span>
        </div>

        {/* Quick stats bar */}
        {(outcomeLabel || confidenceScore) && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {outcomeLabel && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
                Prediction: <strong>{outcomeLabel}</strong>
              </span>
            )}
            {confidenceScore && (
              <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
                Confidence: <strong>{confidenceScore}%</strong>
              </span>
            )}
            {riskAssessment && (
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20">
                Risk: <strong>{riskAssessment}</strong>
              </span>
            )}
          </div>
        )}
      </header>

      <hr className="border-slate-700/60" />

      {/* ── AI Summary ─────────────────────────────────────────────── */}
      {(aiSummary || explanation) && (
        <section aria-labelledby="ssr-ai-summary">
          <h2 id="ssr-ai-summary" className="text-xl font-semibold text-white mb-3">
            AI Match Analysis
          </h2>
          <div className="prose prose-invert prose-sm max-w-none" itemProp="articleBody">
            {/* Strip emoji header line from the summary */}
            {(aiSummary || explanation)?.split('\n').map((line, i) => {
              const trimmed = line.trim()
              if (!trimmed) return null
              // Turn lines that start with bullet chars into <li>
              if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                return <p key={i} className="ml-4 text-slate-300">{trimmed}</p>
              }
              // Bold-looking headers (e.g. "📊 PREDICTION:")
              if (/^[🎯📊🔍💡⚡]/.test(trimmed)) {
                return <p key={i} className="font-semibold text-slate-200 mt-3">{trimmed}</p>
              }
              return <p key={i}>{trimmed}</p>
            })}
          </div>
        </section>
      )}

      {/* ── Win Probability ────────────────────────────────────────── */}
      {probs && (
        <section aria-labelledby="ssr-win-prob">
          <h2 id="ssr-win-prob" className="text-xl font-semibold text-white mb-3">
            Win Probability
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
              <div className="text-2xl font-bold text-white">{Math.round(probs.home * 100)}%</div>
              <div className="text-sm text-slate-400 mt-1">{homeTeam}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
              <div className="text-2xl font-bold text-white">{Math.round(probs.draw * 100)}%</div>
              <div className="text-sm text-slate-400 mt-1">Draw</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
              <div className="text-2xl font-bold text-white">{Math.round(probs.away * 100)}%</div>
              <div className="text-sm text-slate-400 mt-1">{awayTeam}</div>
            </div>
          </div>
        </section>
      )}

      {/* ── Team Analysis ──────────────────────────────────────────── */}
      {(homeTeamAnalysis || awayTeamAnalysis) && (
        <section aria-labelledby="ssr-team-analysis">
          <h2 id="ssr-team-analysis" className="text-xl font-semibold text-white mb-3">
            Team Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {homeTeamAnalysis && (
              <div className="bg-slate-800/60 rounded-lg p-5 border border-slate-700 space-y-3">
                <h3 className="font-semibold text-white">{homeTeam}</h3>
                {homeTeamAnalysis.formAssessment && (
                  <p className="text-sm">{homeTeamAnalysis.formAssessment}</p>
                )}
                {homeTeamAnalysis.strengths.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-1">Strengths</h4>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {homeTeamAnalysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {homeTeamAnalysis.weaknesses.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-red-400 uppercase tracking-wide mb-1">Weaknesses</h4>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {homeTeamAnalysis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
                {homeTeamAnalysis.injuryImpact && (
                  <p className="text-xs text-slate-400">Injury impact: {homeTeamAnalysis.injuryImpact}</p>
                )}
              </div>
            )}
            {awayTeamAnalysis && (
              <div className="bg-slate-800/60 rounded-lg p-5 border border-slate-700 space-y-3">
                <h3 className="font-semibold text-white">{awayTeam}</h3>
                {awayTeamAnalysis.formAssessment && (
                  <p className="text-sm">{awayTeamAnalysis.formAssessment}</p>
                )}
                {awayTeamAnalysis.strengths.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-1">Strengths</h4>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {awayTeamAnalysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {awayTeamAnalysis.weaknesses.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-red-400 uppercase tracking-wide mb-1">Weaknesses</h4>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {awayTeamAnalysis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
                {awayTeamAnalysis.injuryImpact && (
                  <p className="text-xs text-slate-400">Injury impact: {awayTeamAnalysis.injuryImpact}</p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Confidence Factors ─────────────────────────────────────── */}
      {confidenceFactors.length > 0 && (
        <section aria-labelledby="ssr-confidence">
          <h2 id="ssr-confidence" className="text-xl font-semibold text-white mb-3">
            Key Confidence Factors
          </h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {confidenceFactors.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </section>
      )}

      {/* ── Model Assessment ───────────────────────────────────────── */}
      {modelAssessment && (
        <section aria-labelledby="ssr-model">
          <h2 id="ssr-model" className="text-xl font-semibold text-white mb-3">
            Model Assessment
          </h2>
          <p className="text-sm">{modelAssessment}</p>
        </section>
      )}

      {/* ── Betting Recommendations ────────────────────────────────── */}
      {bettingRecs?.primaryBet && (
        <section aria-labelledby="ssr-betting">
          <h2 id="ssr-betting" className="text-xl font-semibold text-white mb-3">
            Betting Recommendations
          </h2>
          <p className="text-sm mb-2">{bettingRecs.primaryBet}</p>
          {bettingRecs.alternativeBets.length > 0 && (
            <div className="mt-2">
              <h3 className="text-sm font-medium text-slate-400 mb-1">Alternative Bets</h3>
              <ul className="list-disc list-inside text-sm space-y-0.5">
                {bettingRecs.alternativeBets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── Risk Factors ───────────────────────────────────────────── */}
      {data.riskFactors.length > 0 && (
        <section aria-labelledby="ssr-risk">
          <h2 id="ssr-risk" className="text-xl font-semibold text-white mb-3">
            Risk Factors
          </h2>
          <ul className="list-disc list-inside text-sm space-y-0.5">
            {data.riskFactors.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>
      )}

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-6 text-center space-y-3">
        <p className="text-lg font-semibold text-white">
          Get the Full AI Prediction for {matchTitle}
        </p>
        <p className="text-sm text-slate-400">
          Unlock premium insights including fair odds, edge percentages, confidence scores, and parlay recommendations.
        </p>
        <a
          href={`${baseUrl}/match/${canonicalSlug}`}
          className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
        >
          View Full Prediction
        </a>
      </div>

      {/* ── Disclaimer ─────────────────────────────────────────────── */}
      <footer className="text-xs text-slate-500 border-t border-slate-800 pt-4">
        <p>
          This prediction is generated by SnapBet AI&apos;s machine learning models and is intended for informational purposes only.
          Always gamble responsibly. Past results do not guarantee future outcomes.
        </p>
      </footer>
    </article>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYOUT COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Match layout renders:
 * 1. Server-side JSON-LD structured data (SportsEvent + BreadcrumbList + FAQPage)
 * 2. The interactive client page ({children})
 * 3. A server-rendered article with real match content for crawler indexing
 */
export default async function MatchLayout({ children, params }: MatchLayoutProps) {
  const { slug } = await params
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'

  let jsonLdScripts: object[] = []
  let matchData: MatchCoreData | null = null

  try {
    matchData = await fetchMatchData(slug)

    if (matchData && matchData.homeTeam !== 'Home Team' && matchData.awayTeam !== 'Away Team') {
      const { homeTeam, awayTeam, league, isFinished, finalScore, kickoffDate } = matchData

      let canonicalSlug = slug
      if (isNumericSlug(slug)) {
        canonicalSlug = generateMatchSlug(homeTeam, awayTeam)
      }
      const canonical = `${baseUrl}/match/${canonicalSlug}`

      // SportsEvent
      jsonLdScripts.push({
        '@context': 'https://schema.org',
        '@type': isFinished ? 'SportsEvent' : 'Event',
        name: `${homeTeam} vs ${awayTeam}`,
        description: `AI-powered match prediction for ${homeTeam} vs ${awayTeam}`,
        startDate: kickoffDate?.toISOString(),
        location: { '@type': 'Place', name: league || 'Football Match' },
        sport: 'Football',
        ...(isFinished && finalScore && {
          result: {
            '@type': 'SportsEventResult',
            homeTeamScore: finalScore.home,
            awayTeamScore: finalScore.away,
          },
        }),
        competitor: [
          { '@type': 'SportsTeam', name: homeTeam },
          { '@type': 'SportsTeam', name: awayTeam },
        ],
      })

      // BreadcrumbList
      const crumbs = [
        { name: 'Home', url: baseUrl },
        { name: 'Matches', url: `${baseUrl}/dashboard/matches` },
        ...(league ? [{ name: league, url: `${baseUrl}/dashboard/matches` }] : []),
        { name: `${homeTeam} vs ${awayTeam}`, url: canonical },
      ]

      jsonLdScripts.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: c.url,
        })),
      })

      // FAQPage
      const faq = buildFaqSchema(matchData)
      if (faq) jsonLdScripts.push(faq)
    }
  } catch {
    // Structured data is non-critical — silently degrade
  }

  return (
    <>
      {/* JSON-LD structured data */}
      {jsonLdScripts.map((ld, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      {/* Interactive client page */}
      {children}

      {/* Server-rendered article for SEO — always present in initial HTML */}
      {matchData && (
        <ServerRenderedMatchArticle data={matchData} baseUrl={baseUrl} />
      )}
    </>
  )
}
