/**
 * Social Image Composer — creates premium social graphics by compositing
 * dynamic match data onto pre-made background templates using sharp.
 *
 * Falls back to null if no background templates are available,
 * allowing the API routes to use ImageResponse as fallback.
 */

import sharp from 'sharp'
import prisma from '@/lib/db'
import path from 'path'
import fs from 'fs'

const BG_DIR = path.join(process.cwd(), 'public', 'social-bg')

// Background template mapping by sport/type
const BG_TEMPLATES: Record<string, string[]> = {
  soccer: ['stadium-01.png', 'stadium-02.png', 'stadium-03.png'],
  nba: ['court-nba.png', 'stadium-01.png'],
  nhl: ['rink-nhl.png', 'stadium-02.png'],
  ncaab: ['court-nba.png', 'stadium-01.png'],
  result: ['result-celebration.png', 'stadium-01.png'],
  summary: ['stadium-02.png', 'stadium-01.png'],
}

/**
 * Check if any background templates are available
 */
export function hasBackgroundTemplates(): boolean {
  try {
    if (!fs.existsSync(BG_DIR)) return false
    const files = fs.readdirSync(BG_DIR)
    return files.some(f => f.endsWith('.png') || f.endsWith('.jpg'))
  } catch {
    return false
  }
}

/**
 * Get a background template path for the given type
 */
function getBackgroundPath(type: string): string | null {
  const candidates = BG_TEMPLATES[type] || BG_TEMPLATES.soccer
  for (const candidate of candidates) {
    const fullPath = path.join(BG_DIR, candidate)
    if (fs.existsSync(fullPath)) return fullPath
  }
  // Try any available background as fallback
  try {
    const files = fs.readdirSync(BG_DIR).filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
    if (files.length > 0) return path.join(BG_DIR, files[0])
  } catch { /* no backgrounds */ }
  return null
}

/**
 * Fetch an image from a URL and return as Buffer, or null if failed
 */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Create SVG text overlay for match preview
 */
function createMatchPreviewSVG(data: {
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  confidence: number
  pick: string
  width: number
  height: number
}): string {
  const { homeTeam, awayTeam, league, kickoff, confidence, pick, width, height } = data
  const confColor = confidence >= 60 ? '#10b981' : confidence >= 40 ? '#f59e0b' : '#ef4444'
  const cx = width / 2
  const cy = height / 2

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.7"/>
        </filter>
      </defs>

      <!-- Semi-transparent dark overlay for text readability -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="rgba(0,0,0,0.35)" rx="0"/>

      <!-- SnapBet AI branding -->
      <circle cx="48" cy="36" r="16" fill="url(#brandGrad)"/>
      <text x="72" y="42" fill="#94a3b8" font-size="16" font-weight="600" font-family="system-ui, sans-serif">SnapBet AI</text>
      <defs>
        <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#3b82f6"/>
        </linearGradient>
      </defs>
      <text x="48" y="42" fill="white" font-size="14" font-weight="700" font-family="system-ui" text-anchor="middle">S</text>

      <!-- League + Date -->
      <text x="${cx}" y="${cy - 180}" fill="#10b981" font-size="20" font-weight="700" font-family="system-ui" text-anchor="middle" letter-spacing="3" filter="url(#shadow)">${league.toUpperCase()}</text>
      <text x="${cx}" y="${cy - 155}" fill="#94a3b8" font-size="16" font-family="system-ui" text-anchor="middle" filter="url(#shadow)">${kickoff}</text>

      <!-- VS -->
      <text x="${cx}" y="${cy - 40}" fill="#f59e0b" font-size="36" font-weight="800" font-family="system-ui" text-anchor="middle" filter="url(#shadow)">VS</text>

      <!-- Team names -->
      <text x="${cx - 200}" y="${cy + 30}" fill="white" font-size="28" font-weight="800" font-family="system-ui" text-anchor="middle" filter="url(#shadow)">${homeTeam.length > 15 ? homeTeam.substring(0, 13) + '..' : homeTeam}</text>
      <text x="${cx + 200}" y="${cy + 30}" fill="white" font-size="28" font-weight="800" font-family="system-ui" text-anchor="middle" filter="url(#shadow)">${awayTeam.length > 15 ? awayTeam.substring(0, 13) + '..' : awayTeam}</text>

      <!-- Confidence ring -->
      <circle cx="${cx}" cy="${cy + 10}" r="52" fill="none" stroke="${confColor}" stroke-width="5" stroke-opacity="0.3"/>
      <circle cx="${cx}" cy="${cy + 10}" r="52" fill="none" stroke="${confColor}" stroke-width="5"
        stroke-dasharray="${2 * Math.PI * 52}"
        stroke-dashoffset="${2 * Math.PI * 52 * (1 - confidence / 100)}"
        transform="rotate(-90 ${cx} ${cy + 10})"/>
      <circle cx="${cx}" cy="${cy + 10}" r="42" fill="rgba(0,0,0,0.5)"/>
      <text x="${cx}" y="${cy + 16}" fill="${confColor}" font-size="24" font-weight="800" font-family="system-ui" text-anchor="middle">${confidence}%</text>
      <text x="${cx}" y="${cy + 32}" fill="#64748b" font-size="9" font-family="system-ui" text-anchor="middle" text-transform="uppercase">CONFIDENCE</text>

      <!-- AI Pick banner -->
      <rect x="${cx - 160}" y="${height - 100}" width="320" height="48" rx="12" fill="rgba(16,185,129,0.2)" stroke="rgba(16,185,129,0.5)" stroke-width="1.5"/>
      <text x="${cx - 60}" y="${height - 70}" fill="#10b981" font-size="16" font-weight="700" font-family="system-ui">AI PICK:</text>
      <text x="${cx + 30}" y="${height - 70}" fill="white" font-size="20" font-weight="800" font-family="system-ui">${pick}</text>

      <!-- Footer -->
      <text x="${cx}" y="${height - 20}" fill="#475569" font-size="12" font-family="system-ui" text-anchor="middle">snapbet.ai • AI-powered sports predictions</text>
    </svg>
  `
}

/**
 * Compose a premium match preview image
 * Returns Buffer if backgrounds available, null otherwise (caller uses ImageResponse fallback)
 */
export async function composeMatchPreview(
  matchId: string,
  format: 'twitter' | 'instagram' = 'twitter'
): Promise<Buffer | null> {
  const bgPath = getBackgroundPath('soccer')
  if (!bgPath) return null

  const width = format === 'instagram' ? 1080 : 1200
  const height = format === 'instagram' ? 1080 : 675

  try {
    // Fetch match data
    const [market, qp] = await Promise.all([
      prisma.marketMatch.findUnique({
        where: { matchId },
        select: {
          homeTeam: true, awayTeam: true, homeTeamLogo: true, awayTeamLogo: true,
          league: true, kickoffDate: true,
        },
      }),
      prisma.quickPurchase.findFirst({
        where: { matchId, isActive: true },
        select: { confidenceScore: true, predictionType: true },
      }),
    ])

    if (!market) return null

    const confidence = qp?.confidenceScore ?? 0
    const pt = qp?.predictionType || ''
    const pick = pt === 'home' || pt === 'home_win' ? market.homeTeam
      : pt === 'away' || pt === 'away_win' ? market.awayTeam : 'Draw'
    const kickoff = market.kickoffDate
      ? market.kickoffDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
      : ''

    // Load and resize background
    let composited = sharp(bgPath).resize(width, height, { fit: 'cover' })

    // Create SVG text overlay
    const svgOverlay = createMatchPreviewSVG({
      homeTeam: market.homeTeam,
      awayTeam: market.awayTeam,
      league: market.league || 'Football',
      kickoff,
      confidence,
      pick,
      width,
      height,
    })

    // Composite SVG text on top of background
    composited = composited.composite([
      { input: Buffer.from(svgOverlay), top: 0, left: 0 },
    ])

    // Fetch and overlay team logos
    const logoSize = format === 'instagram' ? 100 : 90
    const logoY = Math.round(height / 2 - 100)

    if (market.homeTeamLogo) {
      const logoBuf = await fetchImageBuffer(market.homeTeamLogo)
      if (logoBuf) {
        const resizedLogo = await sharp(logoBuf)
          .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer()
        composited = sharp(await composited.toBuffer()).composite([
          { input: resizedLogo, left: Math.round(width / 2 - 200 - logoSize / 2), top: logoY },
        ])
      }
    }

    if (market.awayTeamLogo) {
      const logoBuf = await fetchImageBuffer(market.awayTeamLogo)
      if (logoBuf) {
        const resizedLogo = await sharp(logoBuf)
          .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer()
        composited = sharp(await composited.toBuffer()).composite([
          { input: resizedLogo, left: Math.round(width / 2 + 200 - logoSize / 2), top: logoY },
        ])
      }
    }

    return await composited.png().toBuffer()
  } catch (error) {
    console.error('[Image Composer] Error composing match preview:', error)
    return null
  }
}

/**
 * Compose a premium match result image
 */
export async function composeMatchResult(
  matchId: string,
  format: 'twitter' | 'instagram' = 'twitter'
): Promise<Buffer | null> {
  const bgPath = getBackgroundPath('result')
  if (!bgPath) return null

  // Similar to composeMatchPreview but with scores and correct/incorrect badge
  // For now, return null to use ImageResponse fallback
  // TODO: implement when result-celebration.png is provided
  return null
}
