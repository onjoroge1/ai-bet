/**
 * Live Match Types
 * Definitions for real-time match data, momentum, and model markets
 */

export interface LiveData {
  current_score: {
    home: number
    away: number
  }
  minute: number
  period: string
  statistics?: {
    shots?: { home: number; away: number }
    shots_on_target?: { home: number; away: number }
    possession?: { home: number; away: number }
    corners?: { home: number; away: number }
    fouls?: { home: number; away: number }
    yellow_cards?: { home: number; away: number }
    red_cards?: { home: number; away: number }
    passes?: { home: number; away: number }
    pass_accuracy?: { home: number; away: number } // Percentage
    saves?: { home: number; away: number }
    tackles?: { home: number; away: number }
    offsides?: { home: number; away: number }
    throw_ins?: { home: number; away: number }
    dribbles?: { home: number; away: number }
    clearances?: { home: number; away: number }
    blocks?: { home: number; away: number }
    long_balls?: { home: number; away: number }
    aerials_won?: { home: number; away: number }
    [key: string]: any
  }
  events?: Array<{
    minute: number
    type: 'goal' | 'card' | 'substitution' | 'var'
    team: 'home' | 'away'
    player?: string
    description?: string
  }>
}

export interface MomentumDriverSummary {
  shots_on_target?: string  // 'home', 'away', or 'balanced'
  possession?: string        // 'home', 'away', or 'balanced'
  red_card?: string | null   // Which team has red card advantage
  [key: string]: string | null | undefined
}

export interface Momentum {
  home: number  // 0-100
  away: number  // 0-100
  driver_summary: MomentumDriverSummary
  minute: number
}

export interface WinDrawWinMarket {
  home: number
  draw: number
  away: number
}

export interface OverUnderMarket {
  over: number
  under: number
  line: number
}

export interface NextGoalMarket {
  home: number
  none: number
  away: number
}

export interface ModelMarkets {
  updated_at: string
  win_draw_win: WinDrawWinMarket
  over_under: OverUnderMarket
  next_goal: NextGoalMarket
}

export interface LiveMatchDelta {
  match_id: number
  minute?: number
  momentum?: Partial<Momentum>
  model_markets?: Partial<ModelMarkets>
  live_data?: Partial<LiveData>
}

/**
 * Extended MatchData interface with live-specific fields
 */
export interface EnhancedMatchData {
  match_id: string | number
  status: 'UPCOMING' | 'LIVE' | 'FINISHED'
  kickoff_at: string
  final_result?: {
    score: { home: number; away: number }
    outcome: string
    outcome_text: string
  }
  league?: {
    id: number | null
    name: string | null
  }
  home: {
    name: string
    team_id?: number | null
    logo_url?: string | null
  }
  away: {
    name: string
    team_id?: number | null
    logo_url?: string | null
  }
  odds?: {
    novig_current?: {
      home: number
      draw: number
      away: number
    }
    consensus?: {
      home: number
      draw: number
      away: number
    }
    books?: Record<string, {
      home: number
      draw: number
      away: number
    }>
  }
  // Support both backend structures (predictions.v1/v2) and legacy (models.v1_consensus/v2_lightgbm)
  predictions?: {
    v1?: {
      pick: string
      confidence: number
      probs?: {
        home: number
        draw: number
        away: number
      }
    }
    v2?: {
      pick: string
      confidence: number
      probs?: {
        home: number
        draw: number
        away: number
      }
    }
  }
  // Legacy support
  models?: {
    v1_consensus?: {
      pick: string
      confidence: number
      probs?: {
        home: number
        draw: number
        away: number
      }
    } | null
    v2_lightgbm?: {
      pick: string
      confidence: number
      probs?: {
        home: number
        draw: number
        away: number
      }
    } | null
  }
  score?: {
    home: number
    away: number
  }
  
  // Live-specific data (only when status=LIVE)
  live_data?: LiveData
  momentum?: Momentum
  model_markets?: ModelMarkets
}



