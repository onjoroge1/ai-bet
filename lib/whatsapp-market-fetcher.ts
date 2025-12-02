import { logger } from '@/lib/logger';

const MARKET_API_TIMEOUT = 5000; // 5 seconds
const MARKET_API_RETRIES = 1;

interface MarketApiResponse {
  matches: any[];
  total_count: number;
  error?: string;
}

/**
 * Fetch upcoming matches from Market API
 * Only fetches status=upcoming (never cache live matches)
 */
export async function fetchUpcomingMatchesFromMarket(
  limit: number = 50
): Promise<MarketApiResponse> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/market?status=upcoming&limit=${limit}&include_v2=false`;

  logger.info('Fetching upcoming matches from Market API', {
    tags: ['whatsapp', 'market', 'fetch'],
    data: { url, limit },
  });

  for (let attempt = 1; attempt <= MARKET_API_RETRIES + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MARKET_API_TIMEOUT);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        next: {
          revalidate: 0, // Always fetch fresh for WhatsApp
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.warn('Market API returned error', {
          tags: ['whatsapp', 'market', 'fetch', 'error'],
          data: {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            attempt,
          },
        });

        if (attempt <= MARKET_API_RETRIES) {
          continue; // Retry
        }

        return {
          matches: [],
          total_count: 0,
          error: `Market API error: ${response.status} ${response.statusText}`,
        };
      }

      const data = (await response.json()) as {
        matches?: any[];
        total_count?: number;
      };

      if (!data.matches || !Array.isArray(data.matches)) {
        logger.warn('Market API returned invalid data structure', {
          tags: ['whatsapp', 'market', 'fetch', 'error'],
          data: { response: data },
        });
        return {
          matches: [],
          total_count: 0,
          error: 'Invalid response structure from Market API',
        };
      }

      logger.info('Successfully fetched matches from Market API', {
        tags: ['whatsapp', 'market', 'fetch'],
        data: {
          matchCount: data.matches.length,
          totalCount: data.total_count || data.matches.length,
          attempt,
        },
      });

      return {
        matches: data.matches || [],
        total_count: data.total_count || data.matches.length,
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.warn('Error fetching from Market API', {
        tags: ['whatsapp', 'market', 'fetch', 'error'],
        data: {
          error: errorMessage,
          isTimeout,
          attempt,
          maxRetries: MARKET_API_RETRIES,
        },
      });

      if (attempt <= MARKET_API_RETRIES && !isTimeout) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );
        continue;
      }

      return {
        matches: [],
        total_count: 0,
        error: isTimeout
          ? 'Market API request timeout'
          : `Market API error: ${errorMessage}`,
      };
    }
  }

  return {
    matches: [],
    total_count: 0,
    error: 'Failed to fetch from Market API after retries',
  };
}

/**
 * Extract matchIds from Market API response
 */
export function extractMatchIds(matches: any[]): string[] {
  return matches
    .map((match) => {
      const id = match.id || match.matchId || match._id;
      return id ? String(id) : null;
    })
    .filter((id): id is string => id !== null);
}

/**
 * Normalize Market API match to WhatsApp format
 * Returns null if match is missing required fields (like id)
 */
export function normalizeMarketMatch(match: any): {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoffDate: string;
  odds: {
    consensus?: { home: number; draw: number; away: number };
    isConsensus?: boolean; // True if novig_current/consensus, false if single bookmaker
    primaryBook?: string;
    booksCount?: number;
  };
  modelPredictions?: {
    free?: { side: string; confidence: number };
    premium?: { side: string; confidence: number };
  };
} | null {
  // Extract matchId - try multiple possible fields (handle both string and number IDs)
  let id: string | null = null;
  
  // Try each field, converting to string if it's a number
  if (match.id !== undefined && match.id !== null) {
    id = String(match.id).trim();
  } else if (match.matchId !== undefined && match.matchId !== null) {
    id = String(match.matchId).trim();
  } else if (match._id !== undefined && match._id !== null) {
    id = String(match._id).trim();
  } else if (match.match_id !== undefined && match.match_id !== null) {
    id = String(match.match_id).trim();
  }

  // Validate matchId - if missing or invalid, return null to skip
  if (!id || id === '' || id === 'undefined' || id === 'null' || id === 'NaN') {
    logger.warn("Match missing valid ID, skipping", {
      tags: ["whatsapp", "market", "normalize"],
      data: {
        matchKeys: Object.keys(match),
        idValue: match.id,
        matchIdValue: match.matchId,
        _idValue: match._id,
        match_idValue: match.match_id,
        extractedId: id,
      },
    });
    return null;
  }

  const homeTeam =
    match.home?.name ||
    match.homeTeam?.name ||
    match.home_name ||
    'Home Team';
  const awayTeam =
    match.away?.name ||
    match.awayTeam?.name ||
    match.away_name ||
    'Away Team';
  const league =
    match.league?.name || match.leagueName || match.league_name || 'Unknown League';
  const kickoffDate =
    match.kickoff_utc || match.matchDate || match.date || new Date().toISOString();

  // Extract odds - use v1_consensus probabilities from Market API
  const odds: {
    consensus?: { home: number; draw: number; away: number };
    isConsensus?: boolean;
    primaryBook?: string;
    booksCount?: number;
  } = {};
  let isConsensusOdds = false;
  
  // Helper function to convert probability to odds
  const probToOdds = (prob: number): number => {
    if (prob <= 0 || prob >= 1) return 0;
    return Number((1 / prob).toFixed(2));
  };
  
  // Method 1: Use models.v1_consensus.probs (consensus probabilities from Market API)
  if (match.models?.v1_consensus?.probs) {
    const probs = match.models.v1_consensus.probs;
    if (probs.home && probs.draw && probs.away) {
      odds.consensus = {
        home: probToOdds(probs.home),
        draw: probToOdds(probs.draw),
        away: probToOdds(probs.away),
      };
      isConsensusOdds = true;
      odds.primaryBook = undefined; // Consensus odds, not from a single book
    }
  }
  // Method 2: Fallback to single bookmaker if v1_consensus not available
  else if (match.odds) {
    const primaryBook = match.primaryBook || 'bet365';
    const bookOdds = match.odds.books?.[primaryBook] || match.odds.books?.bet365 || match.odds.books?.pinnacle || match.odds.books?.unibet;
    
    // Try to find any book with valid odds
    if (!bookOdds && match.odds.books && typeof match.odds.books === 'object') {
      const bookKeys = Object.keys(match.odds.books);
      for (const key of bookKeys) {
        const book = match.odds.books[key];
        if (book && (book.home || book.Home) && (book.draw || book.Draw) && (book.away || book.Away)) {
          const home = book.home || book.Home || 0;
          const draw = book.draw || book.Draw || 0;
          const away = book.away || book.Away || 0;
          
          if (home > 1.0 && draw > 1.0 && away > 1.0) {
            odds.consensus = { home, draw, away };
            odds.primaryBook = key;
            isConsensusOdds = false;
            break;
          }
        }
      }
    } else if (bookOdds) {
      const home = bookOdds.home || bookOdds.Home || 0;
      const draw = bookOdds.draw || bookOdds.Draw || 0;
      const away = bookOdds.away || bookOdds.Away || 0;
      
      if (home > 1.0 && draw > 1.0 && away > 1.0) {
        odds.consensus = { home, draw, away };
        odds.primaryBook = primaryBook;
        isConsensusOdds = false;
      }
    }
  }
  
  // Set consensus flag
  odds.isConsensus = isConsensusOdds;
  
  // Count bookmakers if available
  if (match.odds?.books && typeof match.odds.books === 'object') {
    odds.booksCount = Object.keys(match.odds.books).length;
  } else {
    odds.booksCount = match.booksCount || 0;
  }

  // Extract model predictions
  const modelPredictions: any = {};
  if (match.predictions) {
    if (match.predictions.free) {
      modelPredictions.free = {
        side: match.predictions.free.side || 'home',
        confidence: (match.predictions.free.confidence || 0) * 100, // Convert to percentage
      };
    }
    if (match.predictions.premium) {
      modelPredictions.premium = {
        side: match.predictions.premium.side || 'home',
        confidence: (match.predictions.premium.confidence || 0) * 100, // Convert to percentage
      };
    }
  }

  return {
    id,
    homeTeam,
    awayTeam,
    league,
    kickoffDate,
    odds,
    modelPredictions: Object.keys(modelPredictions).length > 0 ? modelPredictions : undefined,
  };
}

