/**
 * Unit tests for lib/premium-tracker/capture-helpers.ts.
 *
 * These functions back the premium-tracker capture and settle crons.
 * Bugs here corrupt the audit table forever (settled rows are immutable),
 * so the contract is locked in here.
 */
import {
  qualifyForTracker,
  consensusToDecimalOdds,
  pickToMarket,
  pickToLabel,
  outcomeFromFinalResult,
  settlePick,
  isStrongLeague,
} from '@/lib/premium-tracker/capture-helpers'

describe('isStrongLeague', () => {
  it('recognises curated strong leagues', () => {
    expect(isStrongLeague('Premier League')).toBe(true)
    expect(isStrongLeague('La Liga')).toBe(true)
    expect(isStrongLeague('Bundesliga')).toBe(true)
  })
  it('returns false for unknown leagues', () => {
    expect(isStrongLeague('Random Regional Cup')).toBe(false)
    expect(isStrongLeague(null)).toBe(false)
    expect(isStrongLeague(undefined)).toBe(false)
    expect(isStrongLeague('')).toBe(false)
  })
})

describe('qualifyForTracker', () => {
  function build(opts: { homeProb?: number; drawProb?: number; awayProb?: number; conf?: number; league?: string; premiumScore?: number | null }) {
    return {
      v3Model: { confidence: opts.conf ?? 0.6 },
      predictionData: {
        predictions: {
          home_win: opts.homeProb ?? 0.5,
          draw: opts.drawProb ?? 0.25,
          away_win: opts.awayProb ?? 0.25,
          confidence: opts.conf ?? 0.6,
        },
      },
      premiumScore: opts.premiumScore ?? null,
      league: opts.league ?? 'Premier League',
    }
  }

  it('qualifies premium tier at V3 confidence ≥60%', () => {
    const q = qualifyForTracker(build({ conf: 0.6, homeProb: 0.6, awayProb: 0.2, drawProb: 0.2 }))
    expect(q).not.toBeNull()
    expect(q!.tier).toBe('premium')
    expect(q!.pick).toBe('home')
  })

  it('qualifies strong tier at V3 ≥50% in strong league', () => {
    const q = qualifyForTracker(build({ conf: 0.55, homeProb: 0.55, awayProb: 0.25, drawProb: 0.2, league: 'La Liga' }))
    expect(q).not.toBeNull()
    expect(q!.tier).toBe('strong')
  })

  it('does NOT qualify at V3 <50%, weak league, low premium score', () => {
    const q = qualifyForTracker(build({ conf: 0.4, homeProb: 0.4, drawProb: 0.3, awayProb: 0.3, league: 'Some Random Cup', premiumScore: 30 }))
    expect(q).toBeNull()
  })

  it('qualifies strong tier on premium score ≥60 regardless of league', () => {
    const q = qualifyForTracker(build({ conf: 0.4, homeProb: 0.4, drawProb: 0.3, awayProb: 0.3, league: 'Random Cup', premiumScore: 65 }))
    expect(q).not.toBeNull()
    expect(q!.tier).toBe('strong')
  })

  it('premium tier wins over strong tier when both criteria met', () => {
    const q = qualifyForTracker(build({ conf: 0.65, homeProb: 0.65, league: 'Premier League', premiumScore: 70 }))
    expect(q!.tier).toBe('premium')
  })

  it('selects highest-probability side as pick', () => {
    const home = qualifyForTracker(build({ homeProb: 0.6, drawProb: 0.2, awayProb: 0.2, conf: 0.6 }))
    const draw = qualifyForTracker(build({ homeProb: 0.3, drawProb: 0.4, awayProb: 0.3, conf: 0.6 }))
    const away = qualifyForTracker(build({ homeProb: 0.2, drawProb: 0.2, awayProb: 0.6, conf: 0.6 }))
    expect(home!.pick).toBe('home')
    expect(draw!.pick).toBe('draw')
    expect(away!.pick).toBe('away')
  })

  it('falls back to v3Model.pick when probability distribution is missing', () => {
    const q = qualifyForTracker({
      v3Model: { pick: 'AWAY', confidence: 0.62 },
      predictionData: null,
      premiumScore: null,
      league: 'Premier League',
    })
    expect(q!.pick).toBe('away')
    expect(q!.tier).toBe('premium')
  })

  it('returns null when no pick can be derived', () => {
    const q = qualifyForTracker({ v3Model: {}, predictionData: null, premiumScore: null, league: null })
    expect(q).toBeNull()
  })
})

describe('consensusToDecimalOdds', () => {
  it('inverts implied probability to decimal odds', () => {
    expect(consensusToDecimalOdds({ home: 0.5, draw: 0.25, away: 0.25 }, 'home')).toBe(2)
    expect(consensusToDecimalOdds({ home: 0.5, draw: 0.25, away: 0.25 }, 'draw')).toBe(4)
    expect(consensusToDecimalOdds({ home: 0.485, draw: 0.266, away: 0.248 }, 'home')).toBeCloseTo(2.062, 2)
  })
  it('returns null when probability missing or invalid', () => {
    expect(consensusToDecimalOdds(null, 'home')).toBeNull()
    expect(consensusToDecimalOdds({ home: 0 }, 'home')).toBeNull()
    expect(consensusToDecimalOdds({ home: 1.5 }, 'home')).toBeNull()  // probabilities can't exceed 1
    expect(consensusToDecimalOdds({ home: -0.1 }, 'home')).toBeNull()
    expect(consensusToDecimalOdds({}, 'home')).toBeNull()
  })
})

describe('pickToMarket', () => {
  it('maps each pick side to its 1X2 market', () => {
    expect(pickToMarket('home')).toBe('1X2_HOME')
    expect(pickToMarket('away')).toBe('1X2_AWAY')
    expect(pickToMarket('draw')).toBe('1X2_DRAW')
  })
})

describe('pickToLabel', () => {
  it('produces human-readable labels', () => {
    expect(pickToLabel('home', 'Arsenal', 'Chelsea')).toBe('Arsenal to win')
    expect(pickToLabel('away', 'Arsenal', 'Chelsea')).toBe('Chelsea to win')
    expect(pickToLabel('draw', 'Arsenal', 'Chelsea')).toBe('Draw')
  })
})

describe('outcomeFromFinalResult', () => {
  it('reads explicit outcome field', () => {
    expect(outcomeFromFinalResult({ outcome: 'home' })).toBe('home')
    expect(outcomeFromFinalResult({ outcome: 'Away' })).toBe('away')
    expect(outcomeFromFinalResult({ outcome: 'DRAW' })).toBe('draw')
  })
  it('derives from score when outcome missing', () => {
    expect(outcomeFromFinalResult({ score: { home: 2, away: 1 } })).toBe('home')
    expect(outcomeFromFinalResult({ score: { home: 0, away: 1 } })).toBe('away')
    expect(outcomeFromFinalResult({ score: { home: 1, away: 1 } })).toBe('draw')
  })
  it('returns null for unparseable shapes', () => {
    expect(outcomeFromFinalResult(null)).toBeNull()
    expect(outcomeFromFinalResult({})).toBeNull()
    expect(outcomeFromFinalResult({ outcome: 'cancelled' })).toBeNull()
    expect(outcomeFromFinalResult({ score: { home: 'foo' } })).toBeNull()
  })
})

describe('settlePick', () => {
  it('computes win P/L at flat $100 stake', () => {
    expect(settlePick('home', 'home', 1.85)).toEqual({ result: 'win', netDollars: 85, netUnits: 0.85 })
    expect(settlePick('home', 'home', 2.5)).toEqual({ result: 'win', netDollars: 150, netUnits: 1.5 })
  })
  it('computes loss P/L', () => {
    expect(settlePick('home', 'away', 1.85)).toEqual({ result: 'loss', netDollars: -100, netUnits: -1 })
    expect(settlePick('away', 'draw', 2.5)).toEqual({ result: 'loss', netDollars: -100, netUnits: -1 })
  })
  it('returns null when outcome is null', () => {
    expect(settlePick('home', null, 1.85)).toBeNull()
  })
  it('honours custom stake', () => {
    expect(settlePick('home', 'home', 2.0, 50)).toEqual({ result: 'win', netDollars: 50, netUnits: 0.5 })
  })
})
