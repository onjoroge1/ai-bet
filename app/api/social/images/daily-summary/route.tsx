import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'

export const runtime = 'nodejs'

interface PickData {
  homeTeam: string
  awayTeam: string
  league: string
  pick: string
  confidence: number
  correct?: boolean // For evening recap
}

/**
 * GET /api/social/images/daily-summary?type=morning|evening&format=twitter|instagram
 *
 * Morning: Top 5 picks card with confidence bars
 * Evening: Results recap with hit rate and correct/incorrect badges
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'morning'
  const format = searchParams.get('format') || 'twitter'

  const isSquare = format === 'instagram'
  const width = isSquare ? 1080 : 1200
  const height = isSquare ? 1080 : 675

  let picks: PickData[] = []
  let title = ''
  let subtitle = ''
  let hitRate = ''

  if (type === 'morning') {
    title = "TODAY'S TOP PICKS"
    subtitle = 'AI-powered predictions across all sports'
    try {
      const matches = await prisma.marketMatch.findMany({
        where: {
          status: 'UPCOMING',
          kickoffDate: { gte: new Date() },
          v1Model: { not: undefined },
        },
        include: {
          quickPurchases: {
            where: { isActive: true },
            take: 1,
            select: { confidenceScore: true, predictionType: true },
          },
        },
        orderBy: { kickoffDate: 'asc' },
        take: 50,
      })

      picks = matches
        .filter(m => m.quickPurchases[0]?.confidenceScore)
        .sort((a, b) => (b.quickPurchases[0]?.confidenceScore ?? 0) - (a.quickPurchases[0]?.confidenceScore ?? 0))
        .slice(0, 5)
        .map(m => {
          const qp = m.quickPurchases[0]
          const pt = qp?.predictionType || ''
          return {
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            league: m.league || 'Football',
            pick: pt === 'home' || pt === 'home_win' ? m.homeTeam : pt === 'away' || pt === 'away_win' ? m.awayTeam : 'Draw',
            confidence: qp?.confidenceScore ?? 0,
          }
        })
    } catch { /* fallback empty */ }
  } else {
    title = 'DAILY SCORECARD'
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const matches = await prisma.marketMatch.findMany({
        where: {
          status: 'FINISHED',
          kickoffDate: { gte: today },
          finalResult: { not: undefined },
        },
        include: {
          quickPurchases: {
            where: { isActive: true },
            take: 1,
            select: { confidenceScore: true, predictionType: true },
          },
        },
        take: 20,
      })

      let correct = 0
      let total = 0
      picks = matches.filter(m => m.quickPurchases[0]?.predictionType).slice(0, 5).map(m => {
        const qp = m.quickPurchases[0]
        const result = m.finalResult as any
        const scoreHome = result?.score?.home ?? 0
        const scoreAway = result?.score?.away ?? 0
        const actual = scoreHome > scoreAway ? 'home' : scoreAway > scoreHome ? 'away' : 'draw'
        const predNorm = qp?.predictionType === 'home_win' ? 'home' : qp?.predictionType === 'away_win' ? 'away' : qp?.predictionType || ''
        const wasCorrect = predNorm === actual
        total++
        if (wasCorrect) correct++
        return {
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          league: m.league || 'Football',
          pick: predNorm === 'home' ? m.homeTeam : predNorm === 'away' ? m.awayTeam : 'Draw',
          confidence: qp?.confidenceScore ?? 0,
          correct: wasCorrect,
        }
      })
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0
      hitRate = `${correct}/${total} correct (${pct}%)`
      subtitle = hitRate
    } catch { /* fallback */ }
  }

  const confColor = (c: number) => c >= 60 ? '#10b981' : c >= 40 ? '#f59e0b' : '#ef4444'

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        fontFamily: 'system-ui, sans-serif', padding: 40, position: 'relative', overflow: 'hidden',
      }}>
        {/* Accent */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />

        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>S</div>
          <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600 }}>SnapBet AI</span>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
          <span style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>{title}</span>
          <span style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>{subtitle}</span>
        </div>

        {/* Picks list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {picks.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.5)',
              borderRadius: 10, padding: '10px 16px',
            }}>
              {/* Number */}
              <span style={{ color: '#475569', fontSize: 14, fontWeight: 700, width: 20 }}>{i + 1}</span>

              {/* Match info */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>{p.homeTeam} vs {p.awayTeam}</span>
                <span style={{ color: '#64748b', fontSize: 11 }}>{p.league}</span>
              </div>

              {/* Pick */}
              <span style={{ color: '#10b981', fontSize: 12, fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{p.pick}</span>

              {/* Confidence or result badge */}
              {type === 'evening' && p.correct !== undefined ? (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: p.correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                  border: `2px solid ${p.correct ? '#10b981' : '#ef4444'}`,
                }}>
                  <span style={{ fontSize: 14 }}>{p.correct ? '✓' : '✗'}</span>
                </div>
              ) : (
                <div style={{
                  width: 40, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${confColor(p.confidence)}20`, border: `1px solid ${confColor(p.confidence)}50`,
                }}>
                  <span style={{ color: confColor(p.confidence), fontSize: 12, fontWeight: 700 }}>{p.confidence}%</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <span style={{ color: '#475569', fontSize: 11 }}>snapbet.ai • AI-powered sports predictions</span>
          {type === 'evening' && hitRate && (
            <span style={{ color: '#10b981', fontSize: 13, fontWeight: 700 }}>{hitRate}</span>
          )}
        </div>
      </div>
    ),
    { width, height }
  )
}
