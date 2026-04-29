import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import OpenAI from 'openai'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { getSnapBetPicks } from '@/lib/premium-picks-engine'
import { EmailTemplateService } from '@/lib/email-template-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import crypto from 'node:crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — accommodate Resend batch latency

const FROM = process.env.EMAIL_FROM || 'SnapBet <noreply@snapbet.bet>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.snapbet.bet'

interface BriefingBullet {
  text: string
  tier: 'free' | 'premium'
  icon: 'fire' | 'trend' | 'warn' | 'star' | 'check'
}

const ICON_EMOJI: Record<BriefingBullet['icon'], string> = {
  fire: '🔥', trend: '📈', warn: '⚠️', star: '⭐', check: '✅',
}

/**
 * POST /api/admin/email/nightly-briefing/send
 *
 * Sends the nightly briefing email to all opted-in users.
 *
 * Auth: Bearer CRON_SECRET (same pattern as other crons). Or admin session
 * for ad-hoc / preview sends.
 *
 * Modes:
 *   - default: send to all eligible users
 *   - body { testEmail: "..." }: send only to that email (admin-session only)
 *   - body { testEmail: "...", testFirstName: "..." }: same with custom name
 *   - body { dryRun: true }: gather data, render, but don't send anything;
 *     return the rendered HTML so admin can preview
 */
export async function POST(request: NextRequest) {
  const auth = await authoriseRequest(request)
  if (!auth.allowed) {
    return NextResponse.json({ error: auth.reason }, { status: 401 })
  }

  let body: { testEmail?: string; testFirstName?: string; dryRun?: boolean } = {}
  try { body = await request.json() } catch { /* no body, fine */ }

  // Test/preview modes require an admin session — never via CRON_SECRET
  if ((body.testEmail || body.dryRun) && auth.via !== 'admin') {
    return NextResponse.json({ error: 'Test/preview mode requires admin session' }, { status: 403 })
  }

  try {
    // ─── Gather + pre-render data once ─────────────────────────────
    const data = await gatherBriefingData()
    const blocks = renderBriefingBlocks(data)

    // ─── Auto-seed template if missing (idempotent) ───────────────
    let tpl = await EmailTemplateService.getTemplateBySlug('nightly-briefing')
    if (!tpl) {
      logger.info('[NightlyBriefing] Template missing — seeding defaults')
      await EmailTemplateService.seedDefaultTemplates()
      // Re-fetch so EmailLog rows get a real templateId (not '')
      tpl = await EmailTemplateService.getTemplateBySlug('nightly-briefing')
    }

    // ─── Dry-run: render with sample user, return HTML, no send ───
    if (body.dryRun) {
      const rendered = await EmailTemplateService.renderTemplate('nightly-briefing', {
        firstName: body.testFirstName || 'Friend',
        ...blocks,
        dashboardUrl: APP_URL,
        unsubscribeUrl: makeUnsubscribeUrl(body.testEmail || 'preview@example.com'),
      })
      return NextResponse.json({
        success: true,
        dryRun: true,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        variables: blocks,
      })
    }

    // ─── Build recipient list ────────────────────────────────────
    const recipients = body.testEmail
      ? [{ id: 'test', email: body.testEmail, fullName: body.testFirstName || 'Friend' }]
      : await prisma.user.findMany({
          where: {
            isActive: true,
            emailNotifications: true,
            email: { not: '' },
            // Don't email suspended/banned users
            OR: [{ accountStatus: null }, { accountStatus: 'active' }],
          },
          select: { id: true, email: true, fullName: true },
        })

    if (recipients.length === 0) {
      return NextResponse.json({ success: true, message: 'No eligible recipients', sent: 0, failed: 0 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    let sent = 0
    let failed = 0
    const errors: Array<{ email: string; error: string }> = []

    // Batch sends — Resend's *free tier* limits to 5 requests/second. We use
    // 4 concurrent + 1.2s gap between batches to stay safely under (paid plans
    // raise this to 100/sec; bump BATCH_SIZE / drop delay if you upgrade).
    const BATCH_SIZE = 4
    const BATCH_DELAY_MS = 1200
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(async (user) => {
        const firstName = (user.fullName || '').split(' ')[0] || 'Friend'
        try {
          const rendered = await EmailTemplateService.renderTemplate('nightly-briefing', {
            firstName,
            ...blocks,
            dashboardUrl: APP_URL,
            unsubscribeUrl: makeUnsubscribeUrl(user.email),
          })
          const result = await resend.emails.send({
            from: FROM,
            to: user.email,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text || undefined,
          })
          if (result.error) throw new Error(result.error.message || 'Resend error')
          sent++
          // EmailLog write — best-effort
          await prisma.emailLog.create({
            data: {
              templateId: tpl?.id ?? '',
              recipient: user.email,
              subject: rendered.subject,
              status: 'sent',
            },
          }).catch(() => { /* non-fatal */ })
        } catch (e) {
          failed++
          const msg = e instanceof Error ? e.message : 'Unknown error'
          errors.push({ email: user.email, error: msg })
          logger.error('[NightlyBriefing] Send failed', { tags: ['email', 'nightly-briefing'], data: { email: user.email, error: msg } })
          await prisma.emailLog.create({
            data: {
              templateId: tpl?.id ?? '',
              recipient: user.email,
              subject: 'Nightly Briefing',
              status: 'failed',
              errorMessage: msg.slice(0, 500),
            },
          }).catch(() => { /* non-fatal */ })
        }
      }))
      // Pause between batches to respect Resend's per-second rate limit
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    logger.info('[NightlyBriefing] Send complete', {
      tags: ['email', 'nightly-briefing'],
      data: { sent, failed, total: recipients.length },
    })

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent,
      failed,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    logger.error('[NightlyBriefing] Fatal', { error: error instanceof Error ? error : undefined })
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

// Allow GET for cron (Vercel cron uses GET by default)
export async function GET(request: NextRequest) {
  return POST(request)
}

// ─── Auth ─────────────────────────────────────────────────────────
async function authoriseRequest(request: NextRequest): Promise<{ allowed: boolean; via?: 'cron' | 'admin'; reason?: string }> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { allowed: true, via: 'cron' }
  }
  const session = await getServerSession(authOptions)
  if (session?.user?.role?.toLowerCase() === 'admin') {
    return { allowed: true, via: 'admin' }
  }
  return { allowed: false, reason: 'Unauthorized' }
}

// ─── Data gathering ───────────────────────────────────────────────
async function gatherBriefingData() {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)

  const [picks, upcomingCount, recentFinished] = await Promise.all([
    getSnapBetPicks(5).catch(() => []),
    prisma.marketMatch.count({
      where: { status: 'UPCOMING', isActive: true, kickoffDate: { gte: now } },
    }),
    prisma.marketMatch.findMany({
      where: {
        status: 'FINISHED',
        isActive: true,
        finalResult: { not: null },
        v3Model: { not: null },
        kickoffDate: { gte: sevenDaysAgo },
      },
      select: { league: true, v3Model: true, finalResult: true },
      take: 200,
    }),
  ])

  // Per-league accuracy snapshot (mirrors the briefing endpoint)
  const leagueStats: Record<string, { total: number; correct: number }> = {}
  for (const m of recentFinished) {
    const v3 = m.v3Model as any
    const fr = m.finalResult as any
    const pick = String(v3?.pick ?? '').toLowerCase().replace('_win', '')
    const outcome = String(fr?.outcome ?? '').toLowerCase().replace('_win', '')
    const norm = (x: string) => x === 'h' ? 'home' : x === 'd' ? 'draw' : x === 'a' ? 'away' : x
    if (!pick || !outcome) continue
    const lg = m.league || 'Unknown'
    leagueStats[lg] ||= { total: 0, correct: 0 }
    leagueStats[lg].total++
    if (norm(pick) === norm(outcome)) leagueStats[lg].correct++
  }
  const ranked = Object.entries(leagueStats)
    .filter(([, s]) => s.total >= 5)
    .map(([league, s]) => ({ league, accuracy: s.correct / s.total, n: s.total }))
    .sort((a, b) => b.accuracy - a.accuracy)
  const topLeagues = ranked.slice(0, 3)
  const weakLeagues = ranked.slice(-3).reverse().filter(l => l.accuracy < 0.45)

  // LLM bullets — same prompt shape as the dashboard briefing
  const bullets = await generateBulletsLLM({ picks, upcomingCount, topLeagues, weakLeagues })
    .catch(() => makeBulletsFallback({ picks, upcomingCount, topLeagues, weakLeagues }))

  return { picks, upcomingCount, topLeagues, weakLeagues, bullets }
}

async function generateBulletsLLM(inputs: {
  picks: Awaited<ReturnType<typeof getSnapBetPicks>>
  upcomingCount: number
  topLeagues: Array<{ league: string; accuracy: number; n: number }>
  weakLeagues: Array<{ league: string; accuracy: number; n: number }>
}): Promise<BriefingBullet[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY missing')

  const openai = new OpenAI({ apiKey })
  const systemPrompt = `You write a daily sports-betting briefing for SnapBet users. Tone: confident analyst, ≤25 words per bullet, never salesy. Generate exactly 3 bullets ranked by usefulness — these go in a marketing email so all 3 should land for free users. Mark each bullet's tier as "free". Return ONLY valid JSON: {"bullets":[{"text":"...","tier":"free","icon":"fire|trend|warn|star|check"}]}.`

  const userPrompt = `Today's data:
- Matches in 24h: ${inputs.upcomingCount}
- Top picks (model's most confident):
${inputs.picks.slice(0, 3).map(p => `  • ${p.homeTeam} vs ${p.awayTeam} (${p.league}): ${p.pickTeam} ${p.confidence}%`).join('\n') || '  (none)'}
- Strongest leagues recently (≥5 matches): ${inputs.topLeagues.map(l => `${l.league} ${(l.accuracy * 100).toFixed(0)}%`).join(', ') || 'n/a'}
- Cautious on: ${inputs.weakLeagues.map(l => `${l.league} ${(l.accuracy * 100).toFixed(0)}%`).join(', ') || 'none flagged'}

Generate 3 bullets now.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
    temperature: 0.65,
    max_tokens: 500,
  })
  const raw = completion.choices[0]?.message?.content
  if (!raw) throw new Error('Empty LLM response')
  const parsed = JSON.parse(raw) as { bullets: BriefingBullet[] }
  return (parsed.bullets || []).slice(0, 3)
}

function makeBulletsFallback(inputs: {
  picks: Awaited<ReturnType<typeof getSnapBetPicks>>
  upcomingCount: number
  topLeagues: Array<{ league: string; accuracy: number; n: number }>
  weakLeagues: Array<{ league: string; accuracy: number; n: number }>
}): BriefingBullet[] {
  const out: BriefingBullet[] = []
  if (inputs.picks[0]) {
    const p = inputs.picks[0]
    out.push({
      text: `${p.homeTeam} vs ${p.awayTeam} (${p.league}) — model's strongest call at ${p.confidence}% on ${p.pickTeam}.`,
      tier: 'free', icon: 'fire',
    })
  }
  if (inputs.upcomingCount > 0) {
    out.push({
      text: `${inputs.upcomingCount} matches in the next 24 hours across major leagues — plenty of opportunity to find value.`,
      tier: 'free', icon: 'trend',
    })
  }
  if (inputs.topLeagues[0]) {
    const l = inputs.topLeagues[0]
    out.push({
      text: `${l.league} has been the model's best league recently — ${(l.accuracy * 100).toFixed(0)}% accuracy on ${l.n} matches.`,
      tier: 'free', icon: 'star',
    })
  }
  return out
}

// ─── Pre-render variable blocks for the email template ───────────
function renderBriefingBlocks(data: Awaited<ReturnType<typeof gatherBriefingData>>) {
  const { picks, upcomingCount, bullets } = data

  // Date label (e.g., "Apr 30")
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const briefingDate = tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Headline summary
  const briefingHeadline = upcomingCount > 0
    ? `${upcomingCount} matches across the next 24 hours, ${picks.length} picks worth your attention.`
    : `Quiet slate ahead — we'll flag what matters as fixtures publish.`

  // ── Briefing bullets HTML + text ──
  const briefingBulletsHtml = bullets.length === 0
    ? `<p style="margin:0;color:#94a3b8;font-size:14px;">Briefing arriving soon — check back tomorrow.</p>`
    : bullets.map(b => `
        <div style="display:block;margin-bottom:10px;padding-left:24px;position:relative;">
          <span style="position:absolute;left:0;top:0;font-size:14px;line-height:1.5;">${ICON_EMOJI[b.icon] ?? '✓'}</span>
          <span style="color:#e2e8f0;font-size:14px;line-height:1.5;">${escapeHtml(b.text)}</span>
        </div>
      `).join('')
  const briefingBulletsText = bullets.map(b => `${ICON_EMOJI[b.icon] ?? '-'} ${b.text}`).join('\n')

  // ── Top picks block (3 rows) ──
  const topPicks = picks.slice(0, 3)
  const topPicksHtml = topPicks.length === 0
    ? `<p style="margin:0;color:#94a3b8;font-size:14px;">No picks surfaced yet for tomorrow's slate.</p>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${topPicks.map(p => {
          const confColor = p.confidence >= 60 ? '#84cc16' : p.confidence >= 40 ? '#facc15' : '#94a3b8'
          return `<tr>
            <td style="padding:10px 14px;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:8px;margin-bottom:8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#f1f5f9;font-size:14px;font-weight:700;">${escapeHtml(p.homeTeam)} <span style="color:#475569;font-weight:400;">vs</span> ${escapeHtml(p.awayTeam)}</td>
                  <td align="right" style="color:${confColor};font-size:14px;font-weight:800;font-family:monospace;">${p.confidence}%</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;font-size:12px;padding-top:4px;">${escapeHtml(p.league || '')} · Pick: <strong style="color:${confColor};">${escapeHtml(p.pickTeam)}</strong></td>
                  <td align="right" style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;padding-top:4px;">${escapeHtml(p.tier)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td height="6"></td></tr>`
        }).join('')}
      </table>`
  const topPicksText = topPicks.length === 0
    ? '(no picks today)'
    : topPicks.map(p => `• ${p.homeTeam} vs ${p.awayTeam} (${p.league}) — ${p.pickTeam} ${p.confidence}% [${p.tier}]`).join('\n')

  // ── Hot parlay placeholder — wired in next pass when /api/premium/suggested-parlays is reliable
  const hotParlaySection = ''
  const hotParlayText = ''

  // ── CLV opportunity teaser line ──
  const clvOpportunityLine = topPicks[0]
    ? `Today the model spotted <strong style="color:#fbbf24;">${escapeHtml(topPicks[0].pickTeam)}</strong> as a value opportunity in <strong>${escapeHtml(topPicks[0].league || 'a top league')}</strong>.`
    : `We surface CLV moves daily across all major leagues — premium members see the live tracker.`

  return {
    briefingDate,
    briefingHeadline: escapeHtml(briefingHeadline),
    briefingBulletsHtml,
    briefingBulletsText,
    topPicksHtml,
    topPicksText,
    hotParlaySection,
    hotParlayText,
    clvOpportunityLine,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function makeUnsubscribeUrl(email: string): string {
  // HMAC-signed token so the unsubscribe URL can't be forged
  const secret = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || 'fallback-secret'
  const token = crypto
    .createHmac('sha256', secret)
    .update(email)
    .digest('hex')
    .slice(0, 24)
  const params = new URLSearchParams({ email, token })
  return `${APP_URL}/unsubscribe?${params.toString()}`
}
