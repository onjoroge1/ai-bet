import { MarketMatch, MarketResponse } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024";

export async function fetchMarket({
  status,
  limit = 10,
  leagueId,
}: {
  status: "upcoming" | "live" | "all";
  limit?: number;
  leagueId?: number;
}): Promise<MarketMatch[]> {
  try {
    let url = `${BASE_URL}/market`;
    url += `?status=${status}&limit=${limit}`;
    
    if (leagueId) {
      url += `&league=${leagueId}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      next: { revalidate: 60 }, // ISR hint for Next.js
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch market data: ${response.status}`);
    }

    const data = await response.json() as MarketResponse;
    return adaptMarket(data.matches);
  } catch (error) {
    console.error("Error fetching market data:", error);
    throw error;
  }
}

/**
 * Adapt raw API response to normalized MarketMatch format
 * This handles differences between backend schema and frontend expectations
 */
function adaptMarket(rawMatches: any[]): MarketMatch[] {
  return rawMatches.map((match): MarketMatch => {
    // Determine primary book (prefer bet365, then pinnacle, then unibet)
    const books = Object.keys(match.odds || {});
    let primaryBook: "bet365" | "unibet" | "pinnacle" | undefined;
    
    if (books.includes("bet365")) {
      primaryBook = "bet365";
    } else if (books.includes("pinnacle")) {
      primaryBook = "pinnacle";
    } else if (books.includes("unibet")) {
      primaryBook = "unibet";
    }

    // Normalize odds structure
    const normalizedOdds: Partial<Record<string, { home: number; draw: number; away: number }>> = {};
    
    if (match.odds) {
      Object.keys(match.odds).forEach((key) => {
        normalizedOdds[key] = {
          home: match.odds[key]?.home || match.odds[key]?.Home || 0,
          draw: match.odds[key]?.draw || match.odds[key]?.Draw || 0,
          away: match.odds[key]?.away || match.odds[key]?.Away || 0,
        };
      });
    }

    // Build predictions from various possible API formats
    const predictions: MarketMatch["predictions"] = {};
    
    if (match.prediction || match.predictions) {
      const pred = match.prediction || match.predictions;
      
      if (pred.free || pred.confidence) {
        predictions.free = {
          side: pred.side || pred.predictedTeam?.toLowerCase() || "home",
          confidence: pred.confidence || 0,
        };
      }
      
      if (pred.premium || pred.v2) {
        const premium = pred.premium || pred.v2;
        predictions.premium = {
          side: premium.side || premium.predictedTeam?.toLowerCase() || "home",
          confidence: premium.confidence || 0,
        };
      }
    }

    return {
      id: match.id || match.matchId || match._id,
      status: match.status === "live" || match.minute || match.score ? "live" : "upcoming",
      kickoff_utc: match.kickoff_utc || match.matchDate || match.date || new Date().toISOString(),
      minute: match.minute || match.elapsed,
      score: match.score || match.liveScore,
      
      league: {
        id: match.league?.id || match.leagueId,
        name: match.league?.name || "",
        country: match.league?.country || match.country,
        flagUrl: match.league?.flagUrl || match.flag,
      },
      
      home: {
        id: match.homeTeam?.id || match.home?.id || match.home_id,
        name: match.homeTeam?.name || match.home?.name || match.home_name || "Home",
        logoUrl: match.homeTeam?.logo || match.home?.logoUrl || match.home_logo,
      },
      
      away: {
        id: match.awayTeam?.id || match.away?.id || match.away_id,
        name: match.awayTeam?.name || match.away?.name || match.away_name || "Away",
        logoUrl: match.awayTeam?.logo || match.away?.logoUrl || match.away_logo,
      },
      
      odds: normalizedOdds as any,
      primaryBook,
      predictions,
      link: match.link || `/matches/${match.id || match.matchId}`,
    };
  });
}

