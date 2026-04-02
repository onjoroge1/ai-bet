import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/social/images/match-result?matchId=xxx&format=twitter|instagram
 *
 * Generates a match result image with scores and correct/incorrect prediction badge.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const matchId = searchParams.get('matchId')
  const format = searchParams.get('format') || 'twitter'

  const isSquare = format === 'instagram'
  const width = isSquare ? 1080 : 1200
  const height = isSquare ? 1080 : 675

  let homeTeam = 'Home'
  let awayTeam = 'Away'
  let homeLogo: string | null = null
  let awayLogo: string | null = null
  let league = 'Football'
  let scoreHome = 0
  let scoreAway = 0
  let prediction = ''
  let wasCorrect = false

  if (matchId) {
    try {
      const [market, qp] = await Promise.all([
        prisma.marketMatch.findUnique({
          where: { matchId: String(matchId) },
          select: {
            homeTeam: true, awayTeam: true,
            homeTeamLogo: true, awayTeamLogo: true,
            league: true, finalResult: true,
          },
        }),
        prisma.quickPurchase.findFirst({
          where: { matchId: String(matchId), isActive: true },
          select: { predictionType: true },
        }),
      ])

      if (market) {
        homeTeam = market.homeTeam
        awayTeam = market.awayTeam
        homeLogo = market.homeTeamLogo
        awayLogo = market.awayTeamLogo
        league = market.league || 'Football'
        const result = market.finalResult as any
        if (result?.score) {
          scoreHome = result.score.home ?? 0
          scoreAway = result.score.away ?? 0
        }
        // Determine actual outcome
        const actualOutcome = scoreHome > scoreAway ? 'home' : scoreAway > scoreHome ? 'away' : 'draw'
        prediction = qp?.predictionType || ''
        const predNorm = prediction === 'home_win' ? 'home' : prediction === 'away_win' ? 'away' : prediction
        wasCorrect = predNorm === actualOutcome
      }
    } catch { /* fallback */ }
  }

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/)
    return words.length === 1 ? words[0].substring(0, 2).toUpperCase()
      : (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }

  const badgeColor = wasCorrect ? '#10b981' : '#f59e0b'
  const badgeText = wasCorrect ? 'CALLED IT' : 'TOUGH ONE'
  const badgeBg = wasCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'
  const badgeBorder = wasCorrect ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.5)'

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden',
        justifyContent: 'center', alignItems: 'center', padding: 40,
      }}>
        {/* Accent orbs */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 380, height: 380, borderRadius: '50%', background: wasCorrect ? 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)' }} />

        {/* Branding */}
        <div style={{ position: 'absolute', top: 24, left: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700 }}>S</div>
          <span style={{ color: '#94a3b8', fontSize: 16, fontWeight: 600 }}>SnapBet AI</span>
        </div>

        {/* FT + League */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ color: '#ef4444', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>FULL TIME</span>
          <span style={{ color: '#475569', fontSize: 14 }}>•</span>
          <span style={{ color: '#64748b', fontSize: 14 }}>{league}</span>
        </div>

        {/* Result badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: badgeBg, border: `2px solid ${badgeBorder}`, borderRadius: 24,
          padding: '8px 20px', marginBottom: 24,
        }}>
          <span style={{ fontSize: 18 }}>{wasCorrect ? '✅' : '😤'}</span>
          <span style={{ color: badgeColor, fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>{badgeText}</span>
        </div>

        {/* Teams + Score row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isSquare ? 30 : 48 }}>
          {/* Home */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {homeLogo ? (
              <img src={homeLogo} width={64} height={64} style={{ borderRadius: '50%', border: '3px solid #334155' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1e293b', border: '3px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 22, fontWeight: 700 }}>{getInitials(homeTeam)}</div>
            )}
            <span style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, textAlign: 'center', maxWidth: 180 }}>{homeTeam}</span>
          </div>

          {/* Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: '#f1f5f9', fontSize: isSquare ? 64 : 56, fontWeight: 800 }}>{scoreHome}</span>
            <span style={{ color: '#475569', fontSize: 28, fontWeight: 300 }}>—</span>
            <span style={{ color: '#f1f5f9', fontSize: isSquare ? 64 : 56, fontWeight: 800 }}>{scoreAway}</span>
          </div>

          {/* Away */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {awayLogo ? (
              <img src={awayLogo} width={64} height={64} style={{ borderRadius: '50%', border: '3px solid #334155' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1e293b', border: '3px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 22, fontWeight: 700 }}>{getInitials(awayTeam)}</div>
            )}
            <span style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, textAlign: 'center', maxWidth: 180 }}>{awayTeam}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#475569', fontSize: 12 }}>snapbet.ai</span>
          <span style={{ color: '#334155', fontSize: 12 }}>•</span>
          <span style={{ color: '#475569', fontSize: 12 }}>AI-powered sports predictions</span>
        </div>
      </div>
    ),
    { width, height }
  )
}
