export type BookKey = "bet365" | "unibet" | "pinnacle";

export type MatchSide = "home" | "draw" | "away";
export type MatchStatus = "upcoming" | "live" | "finished";

export interface League {
  id: number;
  name: string;
  country?: string;
  flagUrl?: string;
}

export interface Team {
  id: number;
  name: string;
  logoUrl?: string;
}

export interface OddsSet {
  home: number;
  draw: number;
  away: number;
}

export interface Score {
  home: number;
  away: number;
}

export interface FreePrediction {
  side: MatchSide;
  confidence: number;
}

export interface PremiumPrediction {
  side: MatchSide;
  confidence: number;
}

export interface PremiumQuality {
  score: number;        // 0-100
  tier: 'premium' | 'strong' | 'standard' | 'speculative';
  stars: 3 | 2 | 1 | 0;
  signals: string[];
}

export interface MatchPredictions {
  free?: FreePrediction;
  premium?: PremiumPrediction;
  quality?: PremiumQuality;
}

export interface MarketMatch {
  id: string | number;
  status: MatchStatus;
  kickoff_utc: string;
  minute?: number;
  score?: Score;
  
  league: League;
  home: Team;
  away: Team;
  
  odds: Partial<Record<BookKey, OddsSet>>;
  primaryBook?: BookKey;
  /** Number of bookmakers contributing to consensus odds (novig_current) */
  booksCount?: number;
  
  predictions?: MatchPredictions;
  
  link?: string;
}

export interface MarketResponse {
  matches: any[]; // raw from API
  total_count: number;
}

