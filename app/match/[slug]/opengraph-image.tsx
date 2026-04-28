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
        // Final result JSON shape: { score: { home, away }, outcome, outcome_text }
        // currentScore (live) shape: { home, away } (flat). Handle both.
        const fr = (market.finalResult ?? market.currentScore) as any
        if (isFinished && fr) {
          const sc = fr.score ?? fr
          scoreHome = typeof sc?.home === "number" ? sc.home : null
          scoreAway = typeof sc?.away === "number" ? sc.away : null
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

  /* ── Confidence colour token + label for the AI Pick pill ───── */
  const confColor = confidence >= 60 ? "#a3e635" : confidence >= 40 ? "#facc15" : "#f87171"
  const pickUpper = (pickLabel && pickLabel !== "—" ? `${pickLabel} WIN` : "—").toUpperCase()
  const showPickPill = !isFinished && pickLabel && pickLabel !== "—" && confidence > 0

  /* ── Render ─────────────────────────────────────────────────── */
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000000",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Diagonal green stripes — bottom-left accent */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(45deg, rgba(132,204,22,0.18) 0%, rgba(132,204,22,0.07) 18%, transparent 38%)",
          }}
        />
        {/* Faint diagonal lines on the left half (field-grid feel) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 720,
            height: "100%",
            background:
              "repeating-linear-gradient(60deg, transparent 0px, transparent 22px, rgba(132,204,22,0.05) 22px, rgba(132,204,22,0.05) 24px)",
          }}
        />
        {/* Blue spotlight glow — top-right */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 720,
            height: 720,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(34,211,238,0.28) 0%, rgba(34,211,238,0.10) 35%, transparent 65%)",
          }}
        />
        {/* Soft cyan rim at far right */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 4,
            height: "100%",
            background:
              "linear-gradient(180deg, transparent 0%, rgba(34,211,238,0.6) 50%, transparent 100%)",
          }}
        />
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

        {/* Top bar — SnapBet branding (left) + status badge (right) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "32px 56px 0",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Circular green-outlined "S" emblem (mirrors brand mark) */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: "3px solid #84cc16",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.4)",
                boxShadow: "0 0 24px rgba(132,204,22,0.4)",
              }}
            >
              <span
                style={{
                  color: "#84cc16",
                  fontSize: 30,
                  fontWeight: 900,
                  fontStyle: "italic",
                  lineHeight: 1,
                }}
              >
                S
              </span>
            </div>
            <span
              style={{
                color: "#84cc16",
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: -0.5,
              }}
            >
              SnapBet
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(34,211,238,0.12)",
              borderRadius: 999,
              padding: "8px 20px",
              border: "1px solid rgba(34,211,238,0.45)",
            }}
          >
            <span
              style={{
                color: "#67e8f9",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1.5,
              }}
            >
              {isFinished ? "MATCH RESULT" : "AI PREDICTION"}
            </span>
          </div>
        </div>

        {/* League + date — small subtle line above the matchup */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "20px 56px 0",
            position: "relative",
            zIndex: 2,
          }}
        >
          <span
            style={{
              color: "#94a3b8",
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: 1.2,
            }}
          >
            {league.toUpperCase()}
            {kickoff ? ` · ${kickoff.toUpperCase()}` : ""}
          </span>
        </div>

        {/* Teams row — crest + name on each side, dramatic VS slash in middle */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 56px",
            gap: 24,
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Home team — crest left of name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              justifyContent: "flex-end",
              gap: 28,
            }}
          >
            <span
              style={{
                color: "#f1f5f9",
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: -1,
                textAlign: "right",
                maxWidth: 360,
                lineHeight: 1,
              }}
            >
              {homeTeam.toUpperCase()}
            </span>
            {homeTeamLogo ? (
              <img
                src={homeTeamLogo}
                width={130}
                height={130}
                style={{
                  objectFit: "contain",
                  filter: "drop-shadow(0 0 20px rgba(220,38,38,0.35))",
                }}
              />
            ) : (
              <div
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #334155, #1e293b)",
                  border: "3px solid rgba(148,163,184,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 48,
                  fontWeight: 900,
                  color: "#cbd5e1",
                }}
              >
                {getInitials(homeTeam)}
              </div>
            )}
          </div>

          {/* VS — bold + diagonal slash effect through the middle */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              minWidth: 110,
              height: 160,
            }}
          >
            {/* Diagonal cyan→green slash bar behind the VS text */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                width: 8,
                height: 160,
                background:
                  "linear-gradient(180deg, #67e8f9 0%, #84cc16 100%)",
                transform: "translateX(-50%) rotate(15deg)",
                borderRadius: 4,
                boxShadow: "0 0 22px rgba(132,204,22,0.5), 0 0 44px rgba(34,211,238,0.3)",
              }}
            />
            <span
              style={{
                color: "#f1f5f9",
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: -1,
                position: "relative",
                zIndex: 2,
              }}
            >
              VS
            </span>
          </div>

          {/* Away team — crest right of name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              justifyContent: "flex-start",
              gap: 28,
            }}
          >
            {awayTeamLogo ? (
              <img
                src={awayTeamLogo}
                width={130}
                height={130}
                style={{
                  objectFit: "contain",
                  filter: "drop-shadow(0 0 20px rgba(34,211,238,0.35))",
                }}
              />
            ) : (
              <div
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #334155, #1e293b)",
                  border: "3px solid rgba(148,163,184,0.25)",
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
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: -1,
                textAlign: "left",
                maxWidth: 360,
                lineHeight: 1,
              }}
            >
              {awayTeam.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Score row (only when finished) — replaces pick pill */}
        {isFinished && (scoreHome !== null || scoreAway !== null) && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "0 56px 36px",
              gap: 24,
              position: "relative",
              zIndex: 2,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 32,
                background: "rgba(0,0,0,0.55)",
                border: "2px solid rgba(132,204,22,0.55)",
                borderRadius: 999,
                padding: "14px 40px",
                boxShadow: "0 0 30px rgba(132,204,22,0.35)",
              }}
            >
              <span style={{ color: "#94a3b8", fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>
                FINAL
              </span>
              <span style={{ color: "#f1f5f9", fontSize: 44, fontWeight: 900 }}>
                {scoreHome ?? "—"} <span style={{ color: "#475569", margin: "0 12px" }}>·</span> {scoreAway ?? "—"}
              </span>
            </div>
          </div>
        )}

        {/* AI Pick pill (only for upcoming matches) — glowing green border */}
        {showPickPill && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "0 56px 40px",
              position: "relative",
              zIndex: 2,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                background: "rgba(0,0,0,0.55)",
                border: "2px solid #84cc16",
                borderRadius: 999,
                padding: "14px 32px",
                boxShadow: "0 0 30px rgba(132,204,22,0.45), inset 0 0 18px rgba(132,204,22,0.08)",
              }}
            >
              <span
                style={{
                  color: "#94a3b8",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                }}
              >
                AI PICK:
              </span>
              <span
                style={{
                  color: "#a3e635",
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: 0.5,
                }}
              >
                {pickUpper}
              </span>
              <span style={{ color: "#475569", fontSize: 24, fontWeight: 600 }}>|</span>
              <span
                style={{
                  color: confColor,
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: 0.5,
                }}
              >
                {confidence}%
              </span>
              <span
                style={{
                  color: "#94a3b8",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                }}
              >
                CONFIDENCE
              </span>
            </div>
          </div>
        )}
      </div>
    ),
    { ...size }
  )
}
