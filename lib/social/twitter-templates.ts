/**
 * Twitter/X Post Templates
 * Exact templates as specified by user
 */

export interface TwitterTemplate {
  id: string
  category: 'Blog Summary' | 'Upcoming Match' | 'Live Analysis' | 'Parlay' | 'Brand'
  name: string
  content: string
  requiresConfidence?: boolean
  requiresLiveData?: boolean
  requiresMatchMinute?: boolean
  requiresMomentum?: boolean
  requiresObservations?: boolean
  hasUrl?: boolean
}

export const TWITTER_TEMPLATES: TwitterTemplate[] = [
  // Blog Summary Templates
  {
    id: 'blog-ai-confidence',
    category: 'Blog Summary',
    name: 'AI Confidence',
    content: `{TEAM_A} vs {TEAM_B} ⚽\nSnapBet AI gives {TEAM_A} a {AI_CONF}% win probability based on form and matchup data.\n\nFull AI breakdown 👉 {MATCH_URL}`,
    requiresConfidence: true,
    hasUrl: true,
  },
  {
    id: 'blog-ai-vs-market',
    category: 'Blog Summary',
    name: 'AI vs Market',
    content: `AI vs market 📊\n{TEAM_A} vs {TEAM_B} shows a gap between model probability and market odds.\n\nSee the analysis 👉 {MATCH_URL}`,
    hasUrl: true,
  },
  {
    id: 'blog-neutral-preview',
    category: 'Blog Summary',
    name: 'Neutral Preview',
    content: `{LEAGUE} preview\n{TEAM_A} vs {TEAM_B} — AI match analysis now live on SnapBet.\n\nRead more 👉 {MATCH_URL}`,
    hasUrl: true,
  },
  {
    id: 'blog-value-signal',
    category: 'Blog Summary',
    name: 'Value Signal',
    content: `This match stood out in our AI scan 👀\n{TEAM_A} vs {TEAM_B} flagged due to form and matchup signals.\n\nFull breakdown 👉 {MATCH_URL}`,
    hasUrl: true,
  },
  {
    id: 'blog-minimal',
    category: 'Blog Summary',
    name: 'Minimal',
    content: `AI match analysis ⚽\n{TEAM_A} vs {TEAM_B} — confidence, context, and key factors.\n\nDetails 👉 {MATCH_URL}`,
    hasUrl: true,
  },
  // Upcoming Match Templates
  {
    id: 'upcoming-fixture-alert',
    category: 'Upcoming Match',
    name: 'Fixture Alert',
    content: `Upcoming match ⚽\n{TEAM_A} vs {TEAM_B}\nAI analysis dropping soon on SnapBet.`,
    hasUrl: false,
  },
  {
    id: 'upcoming-league-focus',
    category: 'Upcoming Match',
    name: 'League Focus',
    content: `{LEAGUE} this week 👀\n{TEAM_A} vs {TEAM_B} is on our radar.\nAI preview coming shortly.`,
    hasUrl: false,
  },
  // Live Analysis Templates
  {
    id: 'live-momentum',
    category: 'Live Analysis',
    name: 'Momentum',
    content: `AI Live Analysis ⚽\n{TEAM_A} vs {TEAM_B} — {MATCH_MINUTE}'\n{MOMENTUM_SUMMARY}\n\nLive match view 👉 {LIVE_URL}`,
    requiresLiveData: true,
    requiresMatchMinute: true,
    requiresMomentum: true,
    hasUrl: true,
  },
  {
    id: 'live-observations',
    category: 'Live Analysis',
    name: 'Observations',
    content: `Live AI Update ⏱\n{TEAM_A} vs {TEAM_B} — {MATCH_MINUTE}'\nKey observations:\n• {OBS_1}\n• {OBS_2}\n\nFull live view 👉 {LIVE_URL}`,
    requiresLiveData: true,
    requiresMatchMinute: true,
    requiresObservations: true,
    hasUrl: true,
  },
  // Parlay Templates
  {
    id: 'parlay-daily',
    category: 'Parlay',
    name: 'Daily Parlay',
    content: `Daily AI Parlay ⚽\nOne multi-match parlay generated from today's fixtures using correlation-aware signals.\n\nView today's parlay 👉 {PARLAY_BUILDER_URL}`,
    hasUrl: true,
  },
  // Brand Templates
  {
    id: 'brand-authority',
    category: 'Brand',
    name: 'Authority',
    content: `SnapBet AI analyzes matches using form, odds, and historical context.\nNo hype — just data.`,
    hasUrl: false,
  },
  {
    id: 'brand-educational',
    category: 'Brand',
    name: 'Educational',
    content: `AI confidence reflects probability, not certainty.\nEvery match carries risk.`,
    hasUrl: false,
  },
]

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TwitterTemplate['category']): TwitterTemplate[] {
  return TWITTER_TEMPLATES.filter(t => t.category === category)
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): TwitterTemplate | undefined {
  return TWITTER_TEMPLATES.find(t => t.id === id)
}

/**
 * Get available templates for a match
 */
export function getAvailableTemplatesForMatch(options: {
  hasConfidence?: boolean
  hasLiveData?: boolean
  hasMatchMinute?: boolean
  hasMomentum?: boolean
  hasObservations?: boolean
}): TwitterTemplate[] {
  return TWITTER_TEMPLATES.filter(template => {
    // Blog Summary and Upcoming Match templates are always available for matches
    if (template.category === 'Blog Summary' || template.category === 'Upcoming Match') {
      // Check if confidence is required
      if (template.requiresConfidence && !options.hasConfidence) {
        return false
      }
      return true
    }
    
    // Live Analysis templates require live data
    if (template.category === 'Live Analysis') {
      if (template.requiresLiveData && !options.hasLiveData) return false
      if (template.requiresMatchMinute && !options.hasMatchMinute) return false
      if (template.requiresMomentum && !options.hasMomentum) return false
      if (template.requiresObservations && !options.hasObservations) return false
      return true
    }
    
    // Brand templates are always available
    if (template.category === 'Brand') {
      return true
    }
    
    return false
  })
}

/**
 * Get available templates for a parlay
 */
export function getAvailableTemplatesForParlay(): TwitterTemplate[] {
  return TWITTER_TEMPLATES.filter(t => t.category === 'Parlay' || t.category === 'Brand')
}

