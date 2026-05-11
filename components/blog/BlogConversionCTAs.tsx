"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Mail, CheckCircle, Loader2, TrendingUp, Calendar, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// ─── Newsletter cookie state ─────────────────────────────────────────────
// Tracks two outcomes so neither static block nor popup nag a user twice:
//   - 'dismissed' — they clicked X on the popup (30d TTL)
//   - 'subscribed' — they submitted their email (1y TTL)
// Either value suppresses the popup. The static block always renders.

const NL_COOKIE = "snapbet_nl"

function readNlCookie(): "dismissed" | "subscribed" | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${NL_COOKIE}=([^;]+)`))
  if (!m) return null
  const v = decodeURIComponent(m[1])
  return v === "dismissed" || v === "subscribed" ? v : null
}

function writeNlCookie(value: "dismissed" | "subscribed") {
  if (typeof document === "undefined") return
  const days = value === "subscribed" ? 365 : 30
  const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString()
  document.cookie = `${NL_COOKIE}=${value}; Path=/; Expires=${expires}; SameSite=Lax`
}

// ─── Newsletter funnel tracking ──────────────────────────────────────────
// Fire-and-forget event reporter. Uses sendBeacon when available so the
// event survives page unload (e.g. tab close after dismiss). Falls back to
// keepalive fetch. Tracker failure must never break UX, so all errors are
// swallowed.

type NlEventType = "impression" | "dismiss" | "subscribe"
type NlEventSource = "static_widget" | "popup"

function trackNewsletter(
  type: NlEventType,
  source: NlEventSource,
  opts: { blogId?: string; email?: string } = {}
) {
  if (typeof window === "undefined") return
  const payload = JSON.stringify({
    type,
    source,
    blogId: opts.blogId,
    email: opts.email,
  })
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" })
      const ok = navigator.sendBeacon("/api/newsletter/track", blob)
      if (ok) return
    }
    void fetch("/api/newsletter/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* swallow — tracker failure must not break UX */
  }
}

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
  blogId: string
  marketMatch: {
    matchId: string
    homeTeam: string
    awayTeam: string
    league: string | null
    kickoffDate: string
    status: string
  }
}

export function MatchCTA({ blogId, marketMatch }: MatchCtaProps) {
  const slug = matchSlug(marketMatch.homeTeam, marketMatch.awayTeam, marketMatch.matchId)
  const isFinished = marketMatch.status === 'FINISHED'
  const isLive = marketMatch.status === 'LIVE'

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

  // Fire-and-forget click tracking. Using sendBeacon when available so the
  // request still completes after the page starts navigating; falls back to
  // fetch with keepalive otherwise. We don't block navigation on this.
  function trackClick() {
    const url = `/api/blogs/${blogId}/cta-click`
    const payload = JSON.stringify({ destination: 'match' })
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon(url, blob)
      } else {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => { /* non-fatal */ })
      }
    } catch {
      /* never fail the click */
    }
  }

  return (
    <Link
      href={`/match/${slug}`}
      onClick={trackClick}
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

interface NewsletterCtaProps {
  blogId?: string
}

export function NewsletterCTA({ blogId }: NewsletterCtaProps = {}) {
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
        writeNlCookie("subscribed")
        trackNewsletter("subscribe", "static_widget", { blogId, email })
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
          <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight">{"Get tomorrow's edge in your inbox"}</h3>
          <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
            {"Daily briefing with the AI's top picks, calibration, and CLV opportunities — sent before the lines move. Free."}
          </p>
        </div>
      </div>

      {status === "success" ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{"You're in. Tomorrow's briefing will land before kickoff."}</span>
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
    type NavigatorWithShare = Navigator & { share?: (data: { title: string; url: string }) => Promise<void> }
    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithShare) : null
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title, url: url() })
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

// ─── Newsletter Popup (scroll-triggered, exit-intent, dismissible) ───────
//
// Triggers on whichever happens first:
//   - Reader scrolls past 60% of the document height
//   - Cursor leaves the viewport upward (desktop exit-intent)
//
// Does NOT trigger when the cookie says dismissed or subscribed, and waits
// 5 s after page load before arming (lets the reader settle / SEO-safe).
// Dismissed via X button, backdrop click, or Esc key. Each path persists
// the dismiss cookie so the popup never fires for that browser for 30 days.
//
// Google "intrusive interstitials" compliance: not on page-load, fires only
// after meaningful engagement, easily dismissible. Static `NewsletterCTA`
// stays in the article body as the always-visible fallback.

interface NewsletterPopupProps {
  blogId?: string
}

export function NewsletterPopup({ blogId }: NewsletterPopupProps = {}) {
  const [open, setOpen] = useState(false)
  const [armed, setArmed] = useState(false)
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  // Arm the trigger 5 s after mount — and only if the user hasn't already
  // subscribed or dismissed. We re-check the cookie on each render in case
  // the static block fired in the meantime.
  useEffect(() => {
    const cookie = readNlCookie()
    if (cookie) return // already subscribed or dismissed — never arm
    const t = setTimeout(() => setArmed(true), 5000)
    return () => clearTimeout(t)
  }, [])

  // Track impression exactly once when the popup first opens. Fires before
  // any dismiss/subscribe so the funnel denominator is always recorded.
  useEffect(() => {
    if (open) trackNewsletter("impression", "popup", { blogId })
  }, [open, blogId])

  const dismiss = useCallback(() => {
    setOpen(false)
    writeNlCookie("dismissed")
    trackNewsletter("dismiss", "popup", { blogId })
  }, [blogId])

  // Scroll-depth trigger
  useEffect(() => {
    if (!armed) return
    if (open) return
    function onScroll() {
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      if (max <= 0) return
      const pct = window.scrollY / max
      if (pct >= 0.6) {
        setOpen(true)
        window.removeEventListener("scroll", onScroll)
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll() // fire once in case already past threshold (long readers re-mounting)
    return () => window.removeEventListener("scroll", onScroll)
  }, [armed, open])

  // Exit-intent trigger (desktop only — pointer leaves viewport upward)
  useEffect(() => {
    if (!armed) return
    if (open) return
    function onMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0) {
        setOpen(true)
        document.removeEventListener("mouseleave", onMouseLeave)
      }
    }
    document.addEventListener("mouseleave", onMouseLeave)
    return () => document.removeEventListener("mouseleave", onMouseLeave)
  }, [armed, open])

  // Esc to close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, dismiss])

  // Body scroll lock while open (mobile UX)
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

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
        writeNlCookie("subscribed")
        trackNewsletter("subscribe", "popup", { blogId, email })
      } else {
        setStatus("error")
        setErrorMsg(data.error || "Failed to subscribe — try again later")
      }
    } catch {
      setStatus("error")
      setErrorMsg("Network error — try again")
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nl-popup-title"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
    >
      {/* Backdrop — click to dismiss */}
      <button
        type="button"
        aria-label="Close popup"
        onClick={dismiss}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-blue-500/30 bg-gradient-to-br from-slate-900 via-blue-950/40 to-purple-950/30 p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Dismiss X */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Mail className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 id="nl-popup-title" className="text-xl font-bold text-white leading-tight">
              {"Get tomorrow's edge"}
            </h3>
            <p className="text-xs text-blue-300 mt-0.5">Free daily briefing</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          {"The AI's top picks, calibration, and CLV opportunities delivered before the lines move. One email, no spam."}
        </p>

        {status === "success" ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{"You're in. Tomorrow's briefing arrives before kickoff."}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <Input
              type="email"
              inputMode="email"
              autoFocus
              placeholder="you@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus("idle"); setErrorMsg("") }}
              className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
              required
              disabled={status === "loading"}
            />
            <Button
              type="submit"
              disabled={status === "loading" || !email.includes("@")}
              className="w-full bg-blue-500 hover:bg-blue-400 text-slate-900 font-semibold"
            >
              {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {status === "loading" ? "Subscribing…" : "Send me the briefing"}
            </Button>
          </form>
        )}
        {status === "error" && <p className="text-xs text-red-400 mt-2">{errorMsg}</p>}
        <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
          Unsubscribe link in every email. We never share your address.
        </p>
      </div>
    </div>
  )
}
