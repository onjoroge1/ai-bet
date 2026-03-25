"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConfidenceRing, getRelativeTime } from "@/components/match/shared"
import { OddsDisplay } from "./OddsDisplay"
import { Clock, CheckCircle2, XCircle, Trophy, Timer } from "lucide-react"

interface MatchModel {
  predictions: {
    home_win: number
    away_win: number
    pick: string
    confidence: number
    features_used?: number
  }
  source: string
  no_draw: boolean
  correct?: boolean
}

interface FinalResult {
  score: { home: number; away: number }
  result: string
  result_text: string
  overtime: boolean
}

interface MatchData {
  event_id: string
  status: string
  commence_time: string
  league: { name: string; sport_key: string }
  home: { name: string; team_id: number | null }
  away: { name: string; team_id: number | null }
  odds: {
    consensus: any | null
    books: Record<string, any>
    book_count: number
  }
  spread: { line: number | null; total: number | null } | null
  model: MatchModel | null
  final_result: FinalResult | null
}

const SPORT_ACCENT: Record<string, string> = {
  soccer: "border-l-emerald-500",
  basketball_nba: "border-l-orange-500",
  icehockey_nhl: "border-l-cyan-500",
  basketball_ncaab: "border-l-purple-500",
}

interface Props {
  match: MatchData
  sportKey: string
  /** Override link href (e.g. for soccer matches that use /match/[slug]) */
  href?: string
}

/** Build a URL-friendly slug from team names + event ID suffix for uniqueness */
function buildMatchSlug(home: string, away: string, eventId: string): string {
  const slugify = (s: string) => (s || 'team').toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const suffix = (eventId || 'unknown').slice(0, 8)
  return `${slugify(home)}-vs-${slugify(away)}-${suffix}`
}

export function SportMatchCard({ match, sportKey, href }: Props) {
  const isFinished = match.status === "FINISHED" || match.status === "finished"
  const isLive = match.status === "LIVE" || match.status === "live"
  const accent = SPORT_ACCENT[sportKey] || "border-l-slate-500"
  const model = match.model?.predictions
  const result = match.final_result

  const homeName = match.home?.name || "Home"
  const awayName = match.away?.name || "Away"
  const confidenceScore = model ? Math.round((model.confidence || 0) * 100) : 0
  const pickTeam = model?.pick === "H" || model?.pick === "home" ? homeName : awayName

  const slug = buildMatchSlug(homeName, awayName, match.event_id || '')
  const linkHref = href || `/sports/${sportKey}/${slug}`

  return (
    <Link href={linkHref}>
      <Card className={`bg-slate-800/60 border-slate-700/40 border-l-4 ${accent} hover:bg-slate-800/80 hover:border-slate-600/60 transition-all cursor-pointer group`}>
        <CardContent className="p-4 space-y-3">
          {/* Header: league + time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                {match.league.name}
              </span>
              {sportKey === "basketball_ncaab" && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-yellow-500/30 text-yellow-400">
                  Beta
                </Badge>
              )}
            </div>
            <div className={`flex items-center gap-1 text-[11px] ${isLive ? "text-red-400" : "text-slate-500"}`}>
              {isLive ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="font-semibold">LIVE</span>
                </>
              ) : isFinished ? (
                <>
                  <Trophy className="w-3 h-3" />
                  <span>Final</span>
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  <span>{getRelativeTime(match.commence_time)}</span>
                </>
              )}
            </div>
          </div>

          {/* Teams + Score/Model */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                {(model?.pick === "H" || model?.pick === "home") && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
                <span className={`text-sm font-medium truncate ${model?.pick === "H" || model?.pick === "home" ? "text-white" : "text-slate-300"}`}>
                  {homeName}
                </span>
                {(result || isLive) && (match as any).score && (
                  <span className="text-sm font-bold text-white ml-auto">{(match as any).score.home}</span>
                )}
                {result && !(match as any).score && (
                  <span className="text-sm font-bold text-white ml-auto">{result.score.home}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(model?.pick === "A" || model?.pick === "away") && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
                <span className={`text-sm font-medium truncate ${model?.pick === "A" || model?.pick === "away" ? "text-white" : "text-slate-300"}`}>
                  {awayName}
                </span>
                {(result || isLive) && (match as any).score && (
                  <span className="text-sm font-bold text-white ml-auto">{(match as any).score.away}</span>
                )}
                {result && !(match as any).score && (
                  <span className="text-sm font-bold text-white ml-auto">{result.score.away}</span>
                )}
              </div>
            </div>

            {/* Confidence ring + model pick */}
            {model && (
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <ConfidenceRing score={confidenceScore} size={44} />
                {isFinished && match.model?.correct !== undefined && (
                  match.model.correct ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )
                )}
              </div>
            )}
          </div>

          {/* OT badge for finished */}
          {result?.overtime && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-400">
              <Timer className="w-3 h-3 mr-0.5" /> OT
            </Badge>
          )}

          {/* Odds bar */}
          <OddsDisplay
            consensus={match.odds?.consensus}
            pick={model?.pick}
            compact={isFinished}
          />

          {/* Model pick summary */}
          {model && !isFinished && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                V3 Pick: <span className="text-emerald-400 font-medium">{pickTeam}</span>
              </span>
              {match.spread?.line !== null && match.spread?.line !== undefined && (
                <span className="text-slate-500">
                  Spread: {match.spread.line > 0 ? "+" : ""}{match.spread.line}
                </span>
              )}
              {match.spread?.total !== null && match.spread?.total !== undefined && (
                <span className="text-slate-500">O/U {match.spread.total}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
