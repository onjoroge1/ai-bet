/**
 * /api/multisport/* must read MultisportMatch only (the pipeline is the writer)
 * and must degrade honestly during the cold start (rows with model = null).
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    multisportMatch: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  },
}))

const db = require('@/lib/db').default

const now = new Date()
const inTwoDays = new Date(now.getTime() + 2 * 86400 * 1000)

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msp_1',
    eventId: 'evt-1',
    sport: 'americanfootball_nfl',
    status: 'upcoming',
    homeTeam: 'Buffalo Bills',
    awayTeam: 'Miami Dolphins',
    homeTeamId: null,
    awayTeamId: null,
    league: 'NFL',
    commenceTime: inTwoDays,
    odds: { consensus: { home_odds: 1.57, away_odds: 2.45, home_prob: 0.61, away_prob: 0.39, n_bookmakers: 12 }, books: {}, book_count: 12 },
    spread: { line: -6.5, total: 47.5 },
    totalLine: { total: 47.5, over_odds: 1.91, under_odds: 1.91 },
    model: null,
    predictionData: null,
    predictionFetchedAt: null,
    finalResult: null,
    teamContext: null,
    modelInfo: null,
    lastSyncedAt: now,
    syncCount: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('GET /api/multisport/market', () => {
  beforeEach(() => jest.clearAllMocks())

  it('serves upcoming rows from the database with cold-start note when no model exists', async () => {
    db.multisportMatch.findMany.mockResolvedValue([row()])
    const { GET } = await import('@/app/api/multisport/market/route')
    const res = await GET(new NextRequest('http://localhost/api/multisport/market?sport=americanfootball_nfl&status=upcoming'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.source).toBe('database')
    expect(json.sport_name).toBe('NFL')
    expect(json.matches).toHaveLength(1)
    expect(json.matches[0]).toMatchObject({
      event_id: 'evt-1',
      home: { name: 'Buffalo Bills' },
      league: { name: 'NFL', sport_key: 'americanfootball_nfl' },
      model: null,
    })
    expect(json.model_info.confidence_note).toMatch(/Market line only/)
    // never calls anything but prisma
    expect(db.multisportMatch.findMany).toHaveBeenCalledTimes(1)
    const where = db.multisportMatch.findMany.mock.calls[0][0].where
    expect(where.sport).toBe('americanfootball_nfl')
    expect(where.status).toBe('upcoming')
  })

  it('flags stale data and omits the note when models are present', async () => {
    const stale = new Date(now.getTime() - 5 * 3600 * 1000)
    db.multisportMatch.findMany.mockResolvedValue([
      row({ lastSyncedAt: stale, model: { predictions: { pick: 'H', confidence: 0.64 } }, modelInfo: { n_samples: 180 } }),
    ])
    const { GET } = await import('@/app/api/multisport/market/route')
    const json = await (await GET(new NextRequest('http://localhost/api/multisport/market?sport=basketball_nba'))).json()
    expect(json.source).toBe('database_stale')
    expect(json.model_info).toEqual({ training_samples: 180, confidence_note: null })
  })

  it('rejects unknown sports without touching the database', async () => {
    const { GET } = await import('@/app/api/multisport/market/route')
    const res = await GET(new NextRequest('http://localhost/api/multisport/market?sport=soccer_epl'))
    expect(res.status).toBe(400)
    expect(db.multisportMatch.findMany).not.toHaveBeenCalled()
  })

  it('returns an empty list (not an error) when nothing is published yet', async () => {
    db.multisportMatch.findMany.mockResolvedValue([])
    const { GET } = await import('@/app/api/multisport/market/route')
    const json = await (await GET(new NextRequest('http://localhost/api/multisport/market?sport=americanfootball_nfl'))).json()
    expect(json.matches).toEqual([])
    expect(json.source).toBe('database_empty')
  })
})

describe('POST /api/multisport/predict', () => {
  beforeEach(() => jest.clearAllMocks())

  const post = (body: unknown) =>
    new NextRequest('http://localhost/api/multisport/predict', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('returns the stored pipeline payload', async () => {
    const stored = {
      match_info: { home_team: 'Buffalo Bills', away_team: 'Miami Dolphins' },
      predictions: { home_win: 0.63, away_win: 0.37, pick: 'H', confidence: 0.63 },
      market: { implied: { home: 0.61, away: 0.39 } },
      model_track_record: { edge_validated: false },
    }
    db.multisportMatch.findUnique.mockResolvedValue(row({ predictionData: stored, predictionFetchedAt: now }))
    const { POST } = await import('@/app/api/multisport/predict/route')
    const res = await POST(post({ sport_key: 'americanfootball_nfl', event_id: 'evt-1' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.predictions.pick).toBe('H')
    expect(json.market.implied.home).toBe(0.61)
    expect(json.status).toBe('upcoming')
    expect(db.multisportMatch.findUnique).toHaveBeenCalledWith({
      where: { eventId_sport: { eventId: 'evt-1', sport: 'americanfootball_nfl' } },
    })
  })

  it('builds a market-only payload when the row has no predictionData (cold start)', async () => {
    db.multisportMatch.findUnique.mockResolvedValue(row())
    const { POST } = await import('@/app/api/multisport/predict/route')
    const json = await (await POST(post({ sport_key: 'americanfootball_nfl', event_id: 'evt-1' }))).json()
    expect(json.predictions).toBeNull()
    expect(json.match_info.home_team).toBe('Buffalo Bills')
    expect(json.odds.home_prob).toBe(0.61)
    expect(json.model_track_record).toBeNull()
  })

  it('404s for unknown events and 400s for bad input', async () => {
    db.multisportMatch.findUnique.mockResolvedValue(null)
    const { POST } = await import('@/app/api/multisport/predict/route')
    expect((await POST(post({ sport_key: 'basketball_nba', event_id: 'nope' }))).status).toBe(404)
    expect((await POST(post({ sport_key: 'basketball_nba' }))).status).toBe(400)
    expect((await POST(post({ sport_key: 'soccer_epl', event_id: 'x' }))).status).toBe(400)
  })
})

describe('GET /api/multisport/sports', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reports NBA + NFL only, with model availability from the rows', async () => {
    // count is called 3x per sport: upcoming, upcoming-with-model, finished
    db.multisportMatch.count
      .mockResolvedValueOnce(12).mockResolvedValueOnce(12).mockResolvedValueOnce(300)   // NBA
      .mockResolvedValueOnce(14).mockResolvedValueOnce(0).mockResolvedValueOnce(40)     // NFL
    db.multisportMatch.findFirst
      .mockResolvedValueOnce({ modelInfo: { n_samples: 180, edge_gate: { validation: 'OOF 61% vs favorite 60%' } } })
      .mockResolvedValueOnce(null)
    const { GET } = await import('@/app/api/multisport/sports/route')
    const json = await (await GET()).json()
    expect(json.sports.map((s: any) => s.sport_key)).toEqual(['basketball_nba', 'americanfootball_nfl'])
    const [nba, nfl] = json.sports
    expect(nba.model).toEqual({ available: true, training_samples: 180, confidence_note: 'OOF 61% vs favorite 60%' })
    expect(nba.fixtures).toEqual({ upcoming: 12, upcoming_with_odds: 12, finished: 300, total: 312 })
    expect(nfl.model.available).toBe(false)
    expect(nfl.model.confidence_note).toMatch(/no trained model/)
  })
})
