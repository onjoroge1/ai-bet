"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Mail, CheckCircle, Loader2, TrendingUp, Calendar, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Build the match-detail slug the same way `/match/[slug]` does. */
function matchSlug(home: string, away: string, matchId: string): string {
  const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-')
  return `${slugify(home)}-vs-${slugify(away)}-${matchId}`
}

function relativeKickoff(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = t - Date.now()
  const past = diff < 0
  const absHours = Math.abs(Math.floor(diff / 3600000))
  if (past) {
    if (absHours < 24) return `${absHours}h ago`
    return `${Math.floor(absHours / 24)}d ago`
  }
  if (absHours < 1) return 'kicking off soon'
  if (absHours < 24) return `in ${absHours}h`
  return `in ${Math.floor(absHours / 24)}d`
}

// ─── Match CTA (renders only when blog is linked to a MarketMatch) ───────

interface MatchCtaProps {
  marketMatch: {
    matchId: string
    homeTeam: string
    awayTeam: string
    league: string | null
    kickoffDate: string
    status: string
  }
}

export function MatchCTA({ marketMatch }: MatchCtaProps) {
  const slug = matchSlug(marketMatch.homeTeam, marketMatch.awayTeam, marketMatch.matchId)
  const isFinished = marketMatch.status === 'FINISHED'
  const isLive = marketMatch.status === 'LIVE'
  const isUpcoming = marketMatch.status === 'UPCOMING'

  const headline = isFinished
    ? 'See how the AI prediction played out'
    : isLive
    ? 'Live match — see the real-time AI analysis'
    : 'See the full AI prediction'

  const subtitle = isFinished
    ? `${marketMatch.homeTeam} vs ${marketMatch.awayTeam}`
    : isLive
    ? `${marketMatch.homeTeam} vs ${marketMatch.awayTeam} — LIVE NOW`
    : `${marketMatch.homeTeam} vs ${marketMatch.awayTeam} — ${relativeKickoff(marketMatch.kickoffDate)}`

  return (
    <Link
      href={`/match/${slug}`}
      className="block rounded-xl overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 hover:from-emerald-500/15 hover:to-blue-500/15 transition-all my-8 group"
    >
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            {isLive ? <TrendingUp className="w-6 h-6 text-red-400" />
              : isFinished ? <Trophy className="w-6 h-6 text-amber-400" />
              : <Calendar className="w-6 h-6 text-emerald-400" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-1">
            {marketMatch.league || 'Match'}
          </p>
          <h3 className="text-base sm:text-lg font-semibold text-white leading-snug">{headline}</h3>
          <p className="text-sm text-slate-300 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold text-sm group-hover:bg-emerald-400 transition-colors">
            View Match <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Newsletter Signup (mid-article CTA) ─────────────────────────────────

export function NewsletterCTA() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes("@")) return
    setStatus("loading"); setErrorMsg("")
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setStatus("success")
      } else {
        setStatus("error")
        setErrorMsg(data.error || "Failed to subscribe — try again later")
      }
    } catch {
      setStatus("error")
      setErrorMsg("Network error — try again")
    }
  }

  return (
    <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-900/30 to-purple-900/20 p-6 sm:p-8 my-10">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Mail className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight">Get tomorrow's edge in your inbox</h3>
          <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
            Daily briefing with the AI's top picks, calibration, and CLV opportunities — sent before the lines move. Free.
          </p>
        </div>
      </div>

      {status === "success" ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">You're in. Tomorrow's briefing will land before kickoff.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email"
            inputMode="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setStatus("idle"); setErrorMsg("") }}
            className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 flex-1"
            required
            disabled={status === "loading"}
          />
          <Button
            type="submit"
            disabled={status === "loading" || !email.includes("@")}
            className="bg-blue-500 hover:bg-blue-400 text-slate-900 font-semibold whitespace-nowrap"
          >
            {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {status === "loading" ? "Subscribing…" : "Get the briefing"}
          </Button>
        </form>
      )}
      {status === "error" && (
        <p className="text-sm text-red-400 mt-2">{errorMsg}</p>
      )}
      <p className="text-[11px] text-slate-500 mt-3">
        No spam. One email a day. Unsubscribe anytime — link in every email.
      </p>
    </div>
  )
}

// ─── Share Buttons (POSTs to /api/blogs/[id]/share) ──────────────────────

interface ShareButtonsProps {
  blogId: string
  title: string
  slug: string
}

type Platform = 'twitter' | 'facebook' | 'linkedin' | 'copy' | 'native'

export function ShareButtons({ blogId, title, slug }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  async function track(platform: Platform) {
    try {
      await fetch(`/api/blogs/${blogId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      })
    } catch {
      /* non-fatal */
    }
  }

  function url() {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/blog/${slug}`
  }

  async function handleShare() {
    // Prefer native share sheet on mobile if available
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, url: url() })
        track('native')
        return
      } catch {
        /* user cancelled */
        return
      }
    }
    // Desktop fallback: copy link
    try {
      await navigator.clipboard.writeText(url())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      track('copy')
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => { window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url())}&text=${encodeURIComponent(title)}`, '_blank', 'noopener,noreferrer'); track('twitter') }}
        className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 h-8 px-2.5 text-xs rounded-md transition-colors inline-flex items-center gap-1"
        title="Share on X"
      >
        <span aria-hidden>𝕏</span>
      </button>
      <button
        type="button"
        onClick={() => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`, '_blank', 'noopener,noreferrer'); track('facebook') }}
        className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 h-8 px-2.5 text-xs rounded-md transition-colors inline-flex items-center gap-1"
        title="Share on Facebook"
      >
        f
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 h-8 px-2.5 text-xs rounded-md transition-colors inline-flex items-center gap-1"
        title={copied ? "Copied!" : "Copy link / native share"}
      >
        {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <span aria-hidden>↗</span>}
        <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
      </button>
    </div>
  )
}
