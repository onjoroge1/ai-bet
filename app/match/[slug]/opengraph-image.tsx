import { ImageResponse } from "next/og"
import { resolveSlugToMatchId } from "@/lib/match-slug-server"
import prisma from "@/lib/db"

export const runtime = "nodejs"
export const alt = "Match Prediction — SnapBet AI"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/**
 * Dynamic Open Graph image for `/match/[slug]`.
 *
 * Renders team logos (or initial fallback), team names, league,
 * kickoff date, AI confidence, and predicted outcome into a
 * branded card that social platforms can display.
 */
export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  /* ── Resolve data ───────────────────────────────────────────── */
  let homeTeam = "Home"
  let awayTeam = "Away"
  let homeTeamLogo: string | null = null
  let awayTeamLogo: string | null = null
  let league = "Football"
  let kickoff = ""
  let confidence = 0
  let pick = ""
  let isFinished = false
  let scoreHome: number | null = null
  let scoreAway: number | null = null

  try {
    const matchId = await resolveSlugToMatchId(slug)
    if (matchId) {
      const [market, qp] = await Promise.all([
        prisma.marketMatch.findUnique({
          where: { matchId: String(matchId) },
          select: {
            homeTeam: true,
            awayTeam: true,
            homeTeamLogo: true,
            awayTeamLogo: true,
            league: true,
            status: true,
            kickoffDate: true,
            currentScore: true,
            finalResult: true,
          },
        }),
        prisma.quickPurchase.findFirst({
          where: {
            matchId: String(matchId),
            type: { in: ["prediction", "tip"] },
            isActive: true,
          },
          select: {
            confidenceScore: true,
            predictionType: true,
            predictionData: true,
            name: true,
          },
        }),
      ])

      if (market) {
        homeTeam = market.homeTeam || homeTeam
        awayTeam = market.awayTeam || awayTeam
        homeTeamLogo = market.homeTeamLogo || null
        awayTeamLogo = market.awayTeamLogo || null
        league = market.league || league
        isFinished = market.status === "FINISHED"
        if (market.kickoffDate) {
          kickoff = market.kickoffDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        }
        const finalScore = (market.finalResult ?? market.currentScore) as Record<string, number> | null
        if (isFinished && finalScore) {
          scoreHome = finalScore.home ?? null
          scoreAway = finalScore.away ?? null
        }
      } else if (qp?.name) {
        const parts = qp.name.split(" vs ")
        homeTeam = parts[0]?.trim() || homeTeam
        awayTeam = parts[1]?.trim() || awayTeam
      }

      if (qp) {
        confidence = qp.confidenceScore ?? 0
        pick = qp.predictionType ?? ""
      }
    }
  } catch {
    // Fallback to defaults — image still renders with generic branding
  }

  /* ── Pick label ─────────────────────────────────────────────── */
  const pickLabel =
    pick === "home_win" || pick === "home"
      ? homeTeam
      : pick === "away_win" || pick === "away"
        ? awayTeam
        : pick === "draw"
          ? "Draw"
          : pick || "—"

  /* ── Helper: get initials for fallback logo ──────────────────── */
  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/)
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase()
    return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background accents */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "28px 48px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              ⚡
            </div>
            <span style={{ color: "#e2e8f0", fontSize: 24, fontWeight: 700 }}>
              SnapBet AI
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(16,185,129,0.15)",
              borderRadius: 24,
              padding: "6px 18px",
              border: "1px solid rgba(16,185,129,0.3)",
            }}
          >
            <span style={{ color: "#34d399", fontSize: 14, fontWeight: 600 }}>
              {isFinished ? "MATCH RESULT" : "AI PREDICTION"}
            </span>
          </div>
        </div>

        {/* League + date */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "16px 48px 0",
          }}
        >
          <span style={{ color: "#94a3b8", fontSize: 18, fontWeight: 500 }}>
            {league}
            {kickoff ? ` · ${kickoff}` : ""}
          </span>
        </div>

        {/* Teams row with logos */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 48px",
            gap: 32,
          }}
        >
          {/* Home team */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              gap: 12,
            }}
          >
            {/* Logo or initial circle */}
            {homeTeamLogo ? (
              <img
                src={homeTeamLogo}
                width={80}
                height={80}
                style={{
                  borderRadius: "50%",
                  objectFit: "contain",
                  background: "rgba(30,41,59,0.8)",
                  border: "2px solid rgba(148,163,184,0.2)",
                  padding: 6,
                }}
              />
            ) : (
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #334155, #1e293b)",
                  border: "2px solid rgba(148,163,184,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#94a3b8",
                }}
              >
                {getInitials(homeTeam)}
              </div>
            )}

            <span
              style={{
                color: "#f1f5f9",
                fontSize: 34,
                fontWeight: 800,
                textAlign: "center",
                lineHeight: 1.15,
                maxWidth: 360,
              }}
            >
              {homeTeam}
            </span>
            {isFinished && scoreHome !== null && (
              <span style={{ color: "#10b981", fontSize: 52, fontWeight: 800 }}>
                {scoreHome}
              </span>
            )}
          </div>

          {/* VS divider */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(30,41,59,0.9)",
                border: "1px solid rgba(71,85,105,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  color: "#64748b",
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 2,
                }}
              >
                VS
              </span>
            </div>
          </div>

          {/* Away team */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              gap: 12,
            }}
          >
            {/* Logo or initial circle */}
            {awayTeamLogo ? (
              <img
                src={awayTeamLogo}
                width={80}
                height={80}
                style={{
                  borderRadius: "50%",
                  objectFit: "contain",
                  background: "rgba(30,41,59,0.8)",
                  border: "2px solid rgba(148,163,184,0.2)",
                  padding: 6,
                }}
              />
            ) : (
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #334155, #1e293b)",
                  border: "2px solid rgba(148,163,184,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#94a3b8",
                }}
              >
                {getInitials(awayTeam)}
              </div>
            )}

            <span
              style={{
                color: "#f1f5f9",
                fontSize: 34,
                fontWeight: 800,
                textAlign: "center",
                lineHeight: 1.15,
                maxWidth: 360,
              }}
            >
              {awayTeam}
            </span>
            {isFinished && scoreAway !== null && (
              <span style={{ color: "#10b981", fontSize: 52, fontWeight: 800 }}>
                {scoreAway}
              </span>
            )}
          </div>
        </div>

        {/* Bottom bar — confidence + pick */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 32,
            padding: "0 48px 32px",
          }}
        >
          {confidence > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(30,41,59,0.9)",
                borderRadius: 16,
                padding: "12px 24px",
                border: "1px solid rgba(71,85,105,0.5)",
              }}
            >
              <span style={{ color: "#94a3b8", fontSize: 16, fontWeight: 500 }}>
                AI Confidence
              </span>
              <span
                style={{
                  color: confidence >= 60 ? "#34d399" : confidence >= 40 ? "#fbbf24" : "#f87171",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                {confidence}%
              </span>
            </div>
          )}
          {pickLabel && pickLabel !== "—" && !isFinished && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(16,185,129,0.12)",
                borderRadius: 16,
                padding: "12px 24px",
                border: "1px solid rgba(16,185,129,0.3)",
              }}
            >
              <span style={{ color: "#94a3b8", fontSize: 16, fontWeight: 500 }}>
                Prediction
              </span>
              <span style={{ color: "#34d399", fontSize: 22, fontWeight: 800 }}>
                {pickLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  )
}
