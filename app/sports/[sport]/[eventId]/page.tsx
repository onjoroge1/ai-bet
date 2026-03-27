"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConfidenceRing, getConfidenceColor } from "@/components/match/shared"
import { OddsDisplay } from "@/components/multisport/OddsDisplay"
import {
  ArrowLeft, Clock, Trophy, Shield, Zap, BarChart3, Target, Timer,
  TrendingUp, TrendingDown, Brain, AlertTriangle, CheckCircle, XCircle,
  Activity, Star, ChevronDown, ChevronUp, Flame, Bed, Swords,
  ThumbsUp, ThumbsDown, Info, Lightbulb, DollarSign
} from "lucide-react"
import Link from "next/link"

const SPORT_NAMES: Record<string, string> = {
  basketball_nba: "NBA",
  icehockey_nhl: "NHL",
  basketball_ncaab: "NCAA Basketball",
}

const SPORT_ACCENT: Record<string, { text: string; bg: string; border: string; borderL: string }> = {
  basketball_nba: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", borderL: "border-l-orange-500" },
  icehockey_nhl: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", borderL: "border-l-cyan-500" },
  basketball_ncaab: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", borderL: "border-l-purple-500" },
}

function extractEventId(slug: string): string {
  if (slug.includes("-vs-")) {
    const lastDash = slug.lastIndexOf("-")
    return slug.slice(lastDash + 1)
  }
  return slug
}

// ── Tiny helpers ──────────────────────────────────────────────────────────
function pct(v: number | null | undefined, decimals = 1) {
  if (v == null) return "N/A"
  return `${(v * 100).toFixed(decimals)}%`
}

function signed(v: number | null | undefined, decimals = 1) {
  if (v == null) return "N/A"
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(decimals)}%`
}

function FormBubble({ result, opponent, score, date, venue }: {
  result: string; opponent?: string; score?: string; date?: string; venue?: string
}) {
  const isWin = result === "W"
  return (
    <div className="group relative">
      <span className={`w-6 h-6 rounded text-[10px] flex items-center justify-center font-bold cursor-default ${
        isWin ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
      }`}>{result}</span>
      {(opponent || score) && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50
                        bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300
                        whitespace-nowrap shadow-xl">
          {opponent && <div className="font-medium text-white">{venue === "Home" ? "vs" : "@"} {opponent}</div>}
          {score && <div>{score}</div>}
          {date && <div className="text-slate-500">{date}</div>}
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────
export default function SportPredictionPage() {
  const params = useParams()
  const sport = params.sport as string
  const rawSlug = params.eventId as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFeatures, setShowFeatures] = useState(false)

  useEffect(() => {
    async function fetchPrediction() {
      setLoading(true)
      try {
        let eventId = rawSlug
        if (rawSlug.includes("-vs-")) {
          const prefix = extractEventId(rawSlug)
          // Search upcoming and finished matches for the full event ID
          const [upRes, finRes] = await Promise.allSettled([
            fetch(`/api/multisport/market?sport=${sport}&status=upcoming&limit=50`).then(r => r.json()),
            fetch(`/api/multisport/market?sport=${sport}&status=finished&limit=50`).then(r => r.json()),
          ])
          const allMatches = [
            ...(upRes.status === 'fulfilled' ? upRes.value?.matches || [] : []),
            ...(finRes.status === 'fulfilled' ? finRes.value?.matches || [] : []),
          ]
          const found = allMatches.find((m: any) => m.event_id?.startsWith(prefix))
          if (found) eventId = found.event_id
          else eventId = prefix
        }

        const res = await fetch("/api/multisport/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sport_key: sport, event_id: eventId }),
        })
        const json = await res.json()
        if (json.error) setError(json.error)
        else setData(json)
      } catch {
        setError("Failed to load prediction")
      } finally {
        setLoading(false)
      }
    }
    fetchPrediction()
  }, [sport, rawSlug])

  const accent = SPORT_ACCENT[sport] || SPORT_ACCENT.basketball_nba

  // ── Loading skeleton ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <div className="h-8 w-32 bg-slate-700/50 rounded animate-pulse" />
          <div className="h-56 bg-slate-800/60 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-slate-800/60 rounded-xl animate-pulse" />
            <div className="h-48 bg-slate-800/60 rounded-xl animate-pulse" />
          </div>
          <div className="h-40 bg-slate-800/60 rounded-xl animate-pulse" />
          <div className="h-64 bg-slate-800/60 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link href="/sports" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Sports
          </Link>
          <Card className="bg-slate-800/60 border-slate-700/40">
            <CardContent className="p-8 text-center">
              <p className="text-slate-400">{error || "No data available"}</p>
              <Link href="/sports" className="mt-3 inline-block text-emerald-400 text-sm hover:text-emerald-300">
                Back to matches
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Data extraction ─────────────────────────────────────────────────
  const pred = data.predictions || {}
  const matchInfo = data.match_info || {}
  const modelInfo = data.model_info || {}
  const odds = data.odds || {}
  const homeCtx = data.team_context?.home || {}
  const awayCtx = data.team_context?.away || {}
  const rawMarkets = data.markets || data.best_bets || []
  const markets = Array.isArray(rawMarkets) ? rawMarkets : []
  const analysis = data.analysis || {}
  const h2h = data.h2h || []
  const featureValues = data.feature_values || {}
  const confScore = Math.round((pred.confidence || 0) * 100)
  const calibratedScore = pred.calibrated_confidence ? Math.round(pred.calibrated_confidence * 100) : null
  const pickTeam = pred.pick === "H" ? matchInfo.home_team : matchInfo.away_team
  const otherTeam = pred.pick === "H" ? matchInfo.away_team : matchInfo.home_team

  const convictionStyles: Record<string, { label: string; color: string; icon: typeof Star }> = {
    premium: { label: "Premium", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: Star },
    strong: { label: "Strong", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: TrendingUp },
    standard: { label: "Standard", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: Target },
  }
  const conviction = convictionStyles[pred.conviction_tier || "standard"] || convictionStyles.standard
  const ConvictionIcon = conviction.icon

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* ── Back nav ─────────────────────────────────────────────── */}
        <Link href="/sports" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to {SPORT_NAMES[sport] || "Sports"}
        </Link>

        {/* ══════════════════════════════════════════════════════════
            1. MATCH HEADER — teams, confidence ring, conviction
           ══════════════════════════════════════════════════════════ */}
        <Card className={`bg-slate-800/60 border-slate-700/40 border-l-4 ${accent.borderL}`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Badge variant="outline" className={`text-xs ${accent.border} ${accent.text}`}>
                {matchInfo.league_name || SPORT_NAMES[sport]}
              </Badge>
              {sport === "basketball_ncaab" && (
                <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">Beta</Badge>
              )}
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {matchInfo.commence_time
                  ? new Date(matchInfo.commence_time).toLocaleString("en-US", {
                      weekday: "short", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })
                  : "TBD"}
              </span>
              {odds.n_bookmakers && (
                <span className="text-[10px] text-slate-600">{odds.n_bookmakers} bookmakers</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  {pred.pick === "H" && <Zap className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                  <span className={`text-xl font-bold ${pred.pick === "H" ? "text-white" : "text-slate-300"}`}>
                    {matchInfo.home_team}
                  </span>
                  {homeCtx.rest?.is_back_to_back && (
                    <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400 px-1.5">B2B</Badge>
                  )}
                </div>
                <div className="text-slate-500 text-sm pl-8">vs</div>
                <div className="flex items-center gap-3">
                  {pred.pick === "A" && <Zap className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                  <span className={`text-xl font-bold ${pred.pick === "A" ? "text-white" : "text-slate-300"}`}>
                    {matchInfo.away_team}
                  </span>
                  {awayCtx.rest?.is_back_to_back && (
                    <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400 px-1.5">B2B</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <ConfidenceRing score={confScore} size={72} />
                <Badge variant="outline" className={`text-xs ${conviction.color}`}>
                  <ConvictionIcon className="w-3 h-3 mr-1" />
                  {conviction.label}
                </Badge>
                {calibratedScore !== null && calibratedScore !== confScore && (
                  <span className="text-[10px] text-slate-500">Calibrated: {calibratedScore}%</span>
                )}
              </div>
            </div>

            {/* Recommended bet line */}
            {pred.recommended_bet && (
              <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-300">
                  <span className="text-emerald-400 font-medium">{pred.recommended_bet}</span>
                  {pred.recommendation_tone && (
                    <span className="text-slate-500 ml-2 text-xs">({pred.recommendation_tone})</span>
                  )}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════
            2. AI ANALYSIS — match overview + key factors (GPT-4o)
           ══════════════════════════════════════════════════════════ */}
        {analysis.match_overview && (
          <Card className="bg-slate-800/60 border-slate-700/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" /> AI Analysis
                {analysis.metadata?.model_used && (
                  <Badge variant="outline" className="text-[9px] border-purple-500/30 text-purple-400 ml-auto">
                    {analysis.metadata.model_used}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.match_overview}</p>

              {analysis.key_factors?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Key Factors</h4>
                  <div className="space-y-2">
                    {analysis.key_factors.map((factor: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <Lightbulb className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <span>{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.final_verdict && (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-1">Verdict</h4>
                  <p className="text-sm text-slate-300">{analysis.final_verdict}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════
            3. PREDICTION + MODEL INFO — side by side
           ══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* V3 Prediction card */}
          <Card className="bg-slate-800/60 border-slate-700/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Target className="w-4 h-4" /> V3 Prediction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">{matchInfo.home_team}</span>
                  <span className="text-sm font-bold text-white">{pct(pred.home_win)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">{matchInfo.away_team}</span>
                  <span className="text-sm font-bold text-white">{pct(pred.away_win)}</span>
                </div>
              </div>

              <OddsDisplay
                consensus={{
                  home_odds: odds.home_odds || null,
                  away_odds: odds.away_odds || null,
                  home_prob: pred.home_win,
                  away_prob: pred.away_win,
                  home_spread: odds.home_spread || null,
                  total_line: odds.total_line || null,
                  over_odds: odds.over_odds || null,
                  under_odds: odds.under_odds || null,
                  n_bookmakers: odds.n_bookmakers || null,
                }}
                pick={pred.pick}
              />

              <div className="text-xs space-y-1.5 text-slate-500 border-t border-slate-700/50 pt-2">
                <div className="flex justify-between">
                  <span>Pick</span>
                  <span className="text-emerald-400 font-medium">{pickTeam}</span>
                </div>
                {pred.edge_vs_market != null && (
                  <div className="flex justify-between">
                    <span>Edge vs Market</span>
                    <span className={pred.edge_vs_market > 0 ? "text-emerald-400" : "text-red-400"}>
                      {signed(pred.edge_vs_market)}
                    </span>
                  </div>
                )}
                {pred.confidence_method && (
                  <div className="flex justify-between">
                    <span>Method</span>
                    <span className="text-slate-400">{pred.confidence_method.replace(/_/g, " ")}</span>
                  </div>
                )}
                {odds.overround && (
                  <div className="flex justify-between">
                    <span>Market Overround</span>
                    <span className="text-slate-400">{pct(odds.overround - 1)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Model info card */}
          <Card className="bg-slate-800/60 border-slate-700/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Model Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-2 text-slate-400">
                <div className="flex justify-between">
                  <span>Model</span>
                  <span className="text-white text-right max-w-[60%] truncate">{modelInfo.name || "V3 Multisport"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Accuracy</span>
                  <span className="text-emerald-400 font-medium">{modelInfo.accuracy ? pct(modelInfo.accuracy) : "N/A"}</span>
                </div>
                {modelInfo.logloss && (
                  <div className="flex justify-between">
                    <span>Log Loss</span>
                    <span className="text-white">{modelInfo.logloss.toFixed(4)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Features Used</span>
                  <span className="text-white">{modelInfo.features_used || modelInfo.n_features || "N/A"}{modelInfo.n_features ? ` / ${modelInfo.n_features}` : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span>Training Samples</span>
                  <span className="text-white">{modelInfo.n_training_samples?.toLocaleString() || "N/A"}</span>
                </div>
                {modelInfo.trained_at && (
                  <div className="flex justify-between">
                    <span>Trained</span>
                    <span className="text-slate-400">{new Date(modelInfo.trained_at).toLocaleDateString()}</span>
                  </div>
                )}

                {/* Feature groups breakdown */}
                {modelInfo.feature_groups && Object.keys(modelInfo.feature_groups).length > 0 && (
                  <div className="border-t border-slate-700/50 pt-2 mt-2">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider">Feature Groups</span>
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                      {Object.entries(modelInfo.feature_groups).map(([group, count]: [string, any]) => (
                        <div key={group} className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/50">
                          <span className="text-[10px] text-slate-400 capitalize">{group.replace(/_/g, " ")}</span>
                          <span className="text-[10px] text-white font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top features */}
                {modelInfo.top_features?.length > 0 && (
                  <div className="border-t border-slate-700/50 pt-2 mt-2">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider">Top Features</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {modelInfo.top_features.slice(0, 8).map((f: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 border-slate-600 text-slate-400">
                          {typeof f === "string" ? f : f.name || f.feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ══════════════════════════════════════════════════════════
            4. BETTING MARKETS — structured markets with edges
           ══════════════════════════════════════════════════════════ */}
        {(markets.length > 0 || (odds.home_spread != null || odds.total_line != null)) && (
          <Card className="bg-slate-800/60 border-slate-700/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Betting Markets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {markets.length > 0 ? (
                <div className="space-y-3">
                  {markets.map((market: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium">
                        {typeof market.market === 'string' ? market.market : typeof market.name === 'string' ? market.name : `Market ${i + 1}`}
                      </div>
                      <div className="space-y-1.5">
                        {market.options ? (
                          /* Structured format: { market, options: [{ label, model_prob, implied_prob, edge }] } */
                          market.options.map((opt: any, j: number) => {
                            const hasEdge = opt.edge != null && opt.edge !== 0
                            return (
                              <div key={j} className="flex items-center justify-between text-xs">
                                <span className="text-slate-300">{opt.label}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-slate-500">
                                    Model: <span className="text-white">{pct(opt.model_prob)}</span>
                                  </span>
                                  {opt.implied_prob != null && (
                                    <span className="text-slate-500">
                                      Market: <span className="text-slate-400">{pct(opt.implied_prob)}</span>
                                    </span>
                                  )}
                                  {opt.decimal_odds && (
                                    <span className="text-slate-400 font-mono text-[11px]">{typeof opt.decimal_odds === 'number' ? opt.decimal_odds.toFixed(2) : opt.decimal_odds}</span>
                                  )}
                                  {hasEdge && (
                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                                      opt.edge > 0 ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"
                                    }`}>
                                      {opt.edge > 0 ? "+" : ""}{(opt.edge * 100).toFixed(1)}%
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          /* Flat format: { market, selection, odds, model_probability, edge_vs_market, conviction } */
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">{typeof market.selection === 'string' ? market.selection : JSON.stringify(market.selection) || '—'}</span>
                            <div className="flex items-center gap-3">
                              {market.model_probability != null && (
                                <span className="text-slate-500">
                                  Model: <span className="text-white">{pct(market.model_probability)}</span>
                                </span>
                              )}
                              {market.odds != null && typeof market.odds !== 'object' && (
                                <span className="text-slate-400 font-mono text-[11px]">{typeof market.odds === 'number' ? market.odds.toFixed(2) : String(market.odds)}</span>
                              )}
                              {market.edge_vs_market != null && market.edge_vs_market !== 0 && (
                                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                                  market.edge_vs_market > 0 ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"
                                }`}>
                                  {market.edge_vs_market > 0 ? "+" : ""}{(market.edge_vs_market * 100).toFixed(1)}%
                                </Badge>
                              )}
                              {market.conviction && (
                                <span className="text-slate-500 text-[10px]">{market.conviction}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Fallback: raw odds display */
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {odds.home_odds && (
                    <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Moneyline</div>
                      <div className="text-sm">
                        <span className="text-white font-medium">{matchInfo.home_team?.split(" ").pop()}</span>
                        <span className="text-slate-400 ml-1">{odds.home_odds.toFixed(2)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-white font-medium">{matchInfo.away_team?.split(" ").pop()}</span>
                        <span className="text-slate-400 ml-1">{odds.away_odds?.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  {odds.home_spread != null && (
                    <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Spread</div>
                      <div className="text-lg font-bold text-white">{odds.home_spread > 0 ? "+" : ""}{odds.home_spread}</div>
                      <div className="text-xs text-slate-500">{matchInfo.home_team?.split(" ").pop()}</div>
                    </div>
                  )}
                  {odds.total_line != null && (
                    <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Over/Under</div>
                      <div className="text-lg font-bold text-white">{odds.total_line}</div>
                      <div className="text-xs text-slate-500">O {odds.over_odds?.toFixed(2)} / U {odds.under_odds?.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════
            5. BETTING RECOMMENDATIONS (from AI analysis)
           ══════════════════════════════════════════════════════════ */}
        {analysis.betting_recommendations && (
          <Card className="bg-slate-800/60 border-slate-700/40 border-l-4 border-l-emerald-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Betting Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.betting_recommendations.primary_bet && (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1 font-medium">Primary Bet</div>
                  {typeof analysis.betting_recommendations.primary_bet === 'string' ? (
                    <p className="text-sm text-slate-300">{analysis.betting_recommendations.primary_bet}</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm text-white font-medium">
                        {analysis.betting_recommendations.primary_bet.selection || 'N/A'}
                        {analysis.betting_recommendations.primary_bet.market && (
                          <span className="text-slate-400 font-normal ml-2 text-xs">({analysis.betting_recommendations.primary_bet.market})</span>
                        )}
                      </p>
                      <div className="flex gap-3 text-xs text-slate-400">
                        {analysis.betting_recommendations.primary_bet.model_probability != null && (
                          <span>Model: <span className="text-emerald-400">{analysis.betting_recommendations.primary_bet.model_probability}%</span></span>
                        )}
                        {analysis.betting_recommendations.primary_bet.odds != null && (
                          <span>Odds: <span className="text-white">{analysis.betting_recommendations.primary_bet.odds}</span></span>
                        )}
                        {analysis.betting_recommendations.primary_bet.edge_vs_market != null && (
                          <span>Edge: <span className={analysis.betting_recommendations.primary_bet.edge_vs_market > 0 ? "text-emerald-400" : "text-red-400"}>
                            {analysis.betting_recommendations.primary_bet.edge_vs_market > 0 ? "+" : ""}{analysis.betting_recommendations.primary_bet.edge_vs_market}%
                          </span></span>
                        )}
                        {analysis.betting_recommendations.primary_bet.conviction && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-400 capitalize">
                            {analysis.betting_recommendations.primary_bet.conviction}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(analysis.betting_recommendations.alternative_bets?.length > 0 || analysis.betting_recommendations.alternatives?.length > 0) && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Alternatives</div>
                  {(analysis.betting_recommendations.alternative_bets || analysis.betting_recommendations.alternatives || []).map((bet: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-400 mb-1">
                      <ChevronDown className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-500" />
                      <span>{typeof bet === 'string' ? bet : `${bet.selection || ''} (${bet.market || ''})${bet.reasoning ? ' — ' + bet.reasoning : ''}`}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-4 text-xs text-slate-500 pt-1 border-t border-slate-700/50">
                {analysis.betting_recommendations.risk_level && (
                  <span>Risk: <span className="text-white">{analysis.betting_recommendations.risk_level}</span></span>
                )}
                {analysis.betting_recommendations.suggested_stake && (
                  <span>Stake: <span className="text-white">{analysis.betting_recommendations.suggested_stake}</span></span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════
            6. TEAM ANALYSIS — strengths, weaknesses, rest, form
           ══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { ctx: homeCtx, teamAnalysis: analysis.team_analysis?.home_team, label: matchInfo.home_team, side: "home" },
            { ctx: awayCtx, teamAnalysis: analysis.team_analysis?.away_team, label: matchInfo.away_team, side: "away" },
          ].map(({ ctx, teamAnalysis, label, side }) => (
            <Card key={side} className="bg-slate-800/60 border-slate-700/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                  {label}
                  {ctx.rest?.is_back_to_back && (
                    <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400">B2B</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Season stats */}
                {ctx.season_stats && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ctx.season_stats.wins != null && (
                      <div className="p-2 rounded bg-slate-900/50">
                        <div className="text-slate-500 text-[10px]">Record</div>
                        <div className="text-white font-medium">{ctx.season_stats.wins}W-{ctx.season_stats.losses}L</div>
                        {ctx.season_stats.win_pct != null && (
                          <div className="text-slate-500 text-[10px]">{pct(ctx.season_stats.win_pct, 0)}</div>
                        )}
                      </div>
                    )}
                    {(side === "home" ? ctx.season_stats.home_record : ctx.season_stats.away_record) && (
                      <div className="p-2 rounded bg-slate-900/50">
                        <div className="text-slate-500 text-[10px]">{side === "home" ? "Home" : "Away"}</div>
                        <div className="text-white font-medium">{side === "home" ? ctx.season_stats.home_record : ctx.season_stats.away_record}</div>
                      </div>
                    )}
                    {ctx.season_stats.points_per_game != null && (
                      <div className="p-2 rounded bg-slate-900/50">
                        <div className="text-slate-500 text-[10px]">PPG</div>
                        <div className="text-white font-medium">{ctx.season_stats.points_per_game}</div>
                      </div>
                    )}
                    {ctx.season_stats.points_against_per_game != null && (
                      <div className="p-2 rounded bg-slate-900/50">
                        <div className="text-slate-500 text-[10px]">Opp PPG</div>
                        <div className="text-white font-medium">{ctx.season_stats.points_against_per_game}</div>
                      </div>
                    )}
                    {ctx.season_stats.streak && (
                      <div className="p-2 rounded bg-slate-900/50">
                        <div className="text-slate-500 text-[10px]">Streak</div>
                        <div className={`font-medium ${ctx.season_stats.streak.startsWith("W") ? "text-emerald-400" : "text-red-400"}`}>
                          {ctx.season_stats.streak}
                        </div>
                      </div>
                    )}
                    {ctx.season_stats.playoff_position != null && (
                      <div className="p-2 rounded bg-slate-900/50">
                        <div className="text-slate-500 text-[10px]">Rank</div>
                        <div className="text-white font-medium">#{ctx.season_stats.playoff_position}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Rest info */}
                {ctx.rest && (
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <Bed className="w-3.5 h-3.5 text-slate-500" />
                    <span>{ctx.rest.rest_days} day{ctx.rest.rest_days !== 1 ? "s" : ""} rest</span>
                    {ctx.rest.is_back_to_back && (
                      <span className="text-yellow-400 text-[10px]">Back-to-back</span>
                    )}
                  </div>
                )}

                {/* AI team analysis */}
                {teamAnalysis && (
                  <div className="space-y-2 border-t border-slate-700/50 pt-2">
                    {teamAnalysis.strengths?.length > 0 && (
                      <div>
                        <div className="text-[10px] text-emerald-400/80 uppercase tracking-wider mb-1">Strengths</div>
                        {teamAnalysis.strengths.map((s: string, i: number) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400 mb-0.5">
                            <ThumbsUp className="w-3 h-3 text-emerald-400/60 mt-0.5 flex-shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {teamAnalysis.weaknesses?.length > 0 && (
                      <div>
                        <div className="text-[10px] text-red-400/80 uppercase tracking-wider mb-1">Weaknesses</div>
                        {teamAnalysis.weaknesses.map((w: string, i: number) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400 mb-0.5">
                            <ThumbsDown className="w-3 h-3 text-red-400/60 mt-0.5 flex-shrink-0" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {teamAnalysis.form_assessment && (
                      <p className="text-[11px] text-slate-500 italic">{teamAnalysis.form_assessment}</p>
                    )}
                    {teamAnalysis.rest_impact && (
                      <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
                        <Bed className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{teamAnalysis.rest_impact}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Recent form */}
                {ctx.recent_form?.length > 0 && (
                  <div className="border-t border-slate-700/50 pt-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Last {ctx.recent_form.length} Games</div>
                    <div className="flex gap-1">
                      {ctx.recent_form.map((r: any, i: number) => {
                        const result = typeof r === "string" ? r : r?.result || "?"
                        const opponent = typeof r === "object" ? r?.opponent : undefined
                        const score = typeof r === "object" ? r?.score : undefined
                        const date = typeof r === "object" ? r?.date : undefined
                        const venue = typeof r === "object" ? r?.venue : undefined
                        return <FormBubble key={i} result={result} opponent={opponent} score={score} date={date} venue={venue} />
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════
            7. PREDICTION ANALYSIS (from AI)
           ══════════════════════════════════════════════════════════ */}
        {analysis.prediction_analysis && (
          <Card className="bg-slate-800/60 border-slate-700/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Prediction Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.prediction_analysis.model_assessment && (
                <p className="text-sm text-slate-300">{analysis.prediction_analysis.model_assessment}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.prediction_analysis.confidence_factors?.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                    <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1.5">Confidence Factors</div>
                    {analysis.prediction_analysis.confidence_factors.map((f: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400 mb-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400/60 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}
                {analysis.prediction_analysis.risk_factors?.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                    <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1.5">Risk Factors</div>
                    {analysis.prediction_analysis.risk_factors.map((f: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400 mb-1">
                        <AlertTriangle className="w-3 h-3 text-red-400/60 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {analysis.prediction_analysis.value_assessment && (
                <p className="text-xs text-slate-500 italic">{analysis.prediction_analysis.value_assessment}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════
            8. HEAD-TO-HEAD HISTORY
           ══════════════════════════════════════════════════════════ */}
        {h2h.length > 0 && (
          <Card className="bg-slate-800/60 border-slate-700/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Swords className="w-4 h-4" /> Head-to-Head
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {h2h.slice(0, 5).map((game: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-slate-900/50">
                    <span className="text-slate-400">{game.date}</span>
                    <span className="text-white font-medium">{game.home_team} {game.home_score} - {game.away_score} {game.away_team}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════
            9. MODEL FEATURES (expandable transparency section)
           ══════════════════════════════════════════════════════════ */}
        {Object.keys(featureValues).length > 0 && (
          <Card className="bg-slate-800/60 border-slate-700/40">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowFeatures(!showFeatures)}>
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Info className="w-4 h-4" /> Model Features ({Object.keys(featureValues).length})
                </span>
                {showFeatures ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CardTitle>
            </CardHeader>
            {showFeatures && (
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[11px]">
                  {Object.entries(featureValues)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, val]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/50">
                        <span className="text-slate-500 truncate mr-2">{key.replace(/_/g, " ")}</span>
                        <span className="text-white font-mono text-[10px] flex-shrink-0">
                          {typeof val === "number" ? (Number.isInteger(val) ? val : val.toFixed(4)) : String(val)}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ── Footer: processing time + data sources ───────────── */}
        <div className="flex items-center justify-between text-[10px] text-slate-600 pb-4">
          {data.processing_time && <span>Processed in {data.processing_time.toFixed(1)}s</span>}
          {analysis.metadata?.data_sources && (
            <span>Sources: {analysis.metadata.data_sources.join(", ")}</span>
          )}
        </div>
      </div>
    </div>
  )
}
