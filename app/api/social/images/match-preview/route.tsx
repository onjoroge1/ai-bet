import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { composeMatchPreview, hasBackgroundTemplates } from '@/lib/social/image-composer'

export const runtime = 'nodejs'

/**
 * GET /api/social/images/match-preview?matchId=xxx&format=twitter|instagram
 *
 * Generates a shareable match preview image with team logos, prediction, and confidence ring.
 * If premium background templates exist in /public/social-bg/, uses sharp compositing.
 * Otherwise falls back to ImageResponse (CSS gradient).
 * Twitter: 1200x675 (16:9)
 * Instagram: 1080x1080 (square)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const matchId = searchParams.get('matchId')
  const format = (searchParams.get('format') || 'twitter') as 'twitter' | 'instagram'

  // Try premium compositing first (if background templates exist)
  if (matchId && hasBackgroundTemplates()) {
    try {
      const premiumBuffer = await composeMatchPreview(matchId, format)
      if (premiumBuffer) {
        return new NextResponse(premiumBuffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        })
      }
    } catch (err) {
      console.warn('[Social Image] Premium compositing failed, falling back to ImageResponse:', err)
    }
  }

  // Fallback to ImageResponse (CSS gradient)
  const isSquare = format === 'instagram'
  const width = isSquare ? 1080 : 1200
  const height = isSquare ? 1080 : 675

  // Defaults
  let homeTeam = 'Home Team'
  let awayTeam = 'Away Team'
  let homeLogo: string | null = null
  let awayLogo: string | null = null
  let league = 'Football'
  let confidence = 0
  let pick = ''
  let pickLabel = '—'
  let kickoff = ''

  if (matchId) {
    try {
      const [market, qp] = await Promise.all([
        prisma.marketMatch.findUnique({
          where: { matchId: String(matchId) },
          select: {
            homeTeam: true, awayTeam: true,
            homeTeamLogo: true, awayTeamLogo: true,
            league: true, kickoffDate: true,
          },
        }),
        prisma.quickPurchase.findFirst({
          where: { matchId: String(matchId), isActive: true },
          select: { confidenceScore: true, predictionType: true },
        }),
      ])

      if (market) {
        homeTeam = market.homeTeam
        awayTeam = market.awayTeam
        homeLogo = market.homeTeamLogo
        awayLogo = market.awayTeamLogo
        league = market.league || 'Football'
        if (market.kickoffDate) {
          kickoff = market.kickoffDate.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })
        }
      }
      if (qp) {
        confidence = qp.confidenceScore ?? 0
        pick = qp.predictionType ?? ''
        pickLabel = pick === 'home' || pick === 'home_win' ? homeTeam
          : pick === 'away' || pick === 'away_win' ? awayTeam
          : pick === 'draw' ? 'Draw' : '—'
      }
    } catch { /* fallback to defaults */ }
  }

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/)
    return words.length === 1 ? words[0].substring(0, 2).toUpperCase()
      : (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }

  const confColor = confidence >= 60 ? '#10b981' : confidence >= 40 ? '#f59e0b' : '#ef4444'

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden',
        justifyContent: 'center', alignItems: 'center', padding: 40,
      }}>
        {/* Accent orbs */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />

        {/* SnapBet branding */}
        <div style={{ position: 'absolute', top: 24, left: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700 }}>S</div>
          <span style={{ color: '#94a3b8', fontSize: 16, fontWeight: 600 }}>SnapBet AI</span>
        </div>

        {/* League + Kickoff */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ color: '#10b981', fontSize: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2 }}>{league}</span>
          {kickoff && <span style={{ color: '#475569', fontSize: 14 }}>•</span>}
          {kickoff && <span style={{ color: '#64748b', fontSize: 14 }}>{kickoff}</span>}
        </div>

        {/* Teams row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isSquare ? 40 : 60, marginBottom: 32 }}>
          {/* Home team */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {homeLogo ? (
              <img src={homeLogo} width={isSquare ? 80 : 72} height={isSquare ? 80 : 72} style={{ borderRadius: '50%', border: '3px solid #334155' }} />
            ) : (
              <div style={{ width: isSquare ? 80 : 72, height: isSquare ? 80 : 72, borderRadius: '50%', background: '#1e293b', border: '3px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 24, fontWeight: 700 }}>{getInitials(homeTeam)}</div>
            )}
            <span style={{ color: '#f1f5f9', fontSize: isSquare ? 22 : 20, fontWeight: 700, textAlign: 'center', maxWidth: 200 }}>{homeTeam}</span>
          </div>

          {/* VS / Confidence ring */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: isSquare ? 100 : 88, height: isSquare ? 100 : 88, borderRadius: '50%', border: `4px solid ${confColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
              <span style={{ color: confColor, fontSize: isSquare ? 28 : 24, fontWeight: 800 }}>{confidence}%</span>
              <span style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>confidence</span>
            </div>
            <span style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}>VS</span>
          </div>

          {/* Away team */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {awayLogo ? (
              <img src={awayLogo} width={isSquare ? 80 : 72} height={isSquare ? 80 : 72} style={{ borderRadius: '50%', border: '3px solid #334155' }} />
            ) : (
              <div style={{ width: isSquare ? 80 : 72, height: isSquare ? 80 : 72, borderRadius: '50%', background: '#1e293b', border: '3px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 24, fontWeight: 700 }}>{getInitials(awayTeam)}</div>
            )}
            <span style={{ color: '#f1f5f9', fontSize: isSquare ? 22 : 20, fontWeight: 700, textAlign: 'center', maxWidth: 200 }}>{awayTeam}</span>
          </div>
        </div>

        {/* AI Pick banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'linear-gradient(90deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
          border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12,
          padding: '12px 24px',
        }}>
          <span style={{ color: '#10b981', fontSize: 14, fontWeight: 600 }}>AI PICK:</span>
          <span style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700 }}>{pickLabel}</span>
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
