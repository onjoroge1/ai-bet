/**
 * Shared WhatsApp message templates
 * Used by both webhook and test-command endpoints
 */

/**
 * Get the main menu message
 */
export function getMainMenuMessage(): string {
  return [
    "📊 SNAPBET COMMANDS",
    "",
    "FREE:",
    "",
    "1 – Today's free picks",
    "",
    "2 – Popular matches",
    "",
    "[Match ID] – Sample AI analysis",
    "",
    "TODAY – Free picks",
    "",
    "MENU – All options",
    "",
    "HELP – How SnapBet works",
    "",
    "PREMIUM:",
    "",
    "VIP – VIP pricing",
    "",
    "BUY – Payment options",
    "",
    "VIP PICKS – Premium predictions",
    "",
    "PARLAY – Parlay builder",
    "",
    "CS – Correct scores",
    "",
    "BTTS – Both teams to score (or BTTS [Match ID])",
    "",
    "OVERS – Over/Under goals (or OVERS [Match ID])",
    "",
    "UNDERS – Under 2.5 goals (or UNDERS [Match ID])",
    "",
    "WEEKEND – Mega weekend pack",
    "",
    "V3 – Highest accuracy AI picks",
    "",
    "AUTO – Subscription info",
  ].join("\n");
}

/**
 * Get the help message
 */
export function getHelpMessage(): string {
  return [
    "📲 **SNAPBET HELP**",
    "",
    "**How SnapBet Works:**",
    "We use AI to analyze matches and provide predictions with confidence scores.",
    "",
    "**FREE COMMANDS:**",
    "1 – Today's free picks (2-3 matches)",
    "2 – Popular matches / leagues",
    "[Match ID] – Sample AI analysis",
    "TODAY – Free picks summary",
    "FREE – Free tier options",
    "HOW – How AI predictions work",
    "LEAGUES – Supported leagues",
    "STATS – Basic team stats",
    "",
    "**PREMIUM COMMANDS:**",
    "VIP – VIP pricing & plans",
    "BUY – Payment options",
    "VIP PICKS – Premium predictions",
    "PARLAY – AI-built parlay (3-6 matches)",
    "CS – Correct score predictions",
    "BTTS – Both Teams To Score (or BTTS [Match ID])",
    "OVERS – Over/Under goals (or OVERS [Match ID])",
    "UNDERS – Under 2.5 goals (or UNDERS [Match ID])",
    "WEEKEND – Mega weekend pack",
    "V2 – High-accuracy ML picks",
    "V3 – Highest-confidence picks",
    "AUTO – Auto subscription",
    "LIVE – In-play predictions",
    "RENEW – Renew VIP access",
    "STATUS – Check VIP status",
    "",
    "**Market Commands:**",
    "• BTTS – Browse BTTS picks (or BTTS [Match ID] for details)",
    "• OVERS – Browse Over/Under picks (or OVERS [Match ID] for details)",
    "• UNDERS – Browse Under 2.5 picks (or UNDERS [Match ID] for details)",
    "• Send 'BTTS MORE', 'OVERS MORE', or 'UNDERS MORE' for pagination",
    "",
    "**Quick Tips:**",
    "• Type a Match ID directly for analysis",
    "• Send 'MENU' to see all commands",
    "• Send 'VIP' to upgrade for premium features",
    "",
    "Visit https://www.snapbet.bet for more info",
  ].join("\n");
}

/**
 * Get the welcome message
 */
export function getWelcomeMessage(): string {
  return [
    "🎉 Welcome to SnapBet! ⚽🔥",
    "",
    "Get AI-powered sports predictions delivered directly to your WhatsApp.",
    "",
    "📊 **What we offer:**",
    "• Daily top picks with AI analysis",
    "• Team strengths, weaknesses & injuries",
    "• Asian Handicap insights",
    "• Confidence factors & betting intelligence",
    "",
    "🆓 **FREE TIER:**",
    "• Today's free picks (2-3 matches)",
    "• Sample AI analysis",
    "• Popular matches & leagues",
    "",
    "💎 **VIP TIER:**",
    "• Premium AI picks (V2/V3)",
    "• Parlay builder",
    "• Correct scores, BTTS, Over/Under",
    "",
    "**Quick Start:**",
    "• Type '1' for today's free picks",
    "• Type a Match ID for AI analysis",
    "• Type 'MENU' for all commands",
    "• Type 'VIP' to see pricing",
    "",
    "For more information visit https://www.snapbet.bet",
  ].join("\n");
}

