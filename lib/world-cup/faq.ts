/**
 * Deterministic FAQ blocks for the World Cup hub family. Rendered as
 * visible Q&A cards + FAQPage JSON-LD. Same voice rules as soccer-hubs.
 */
import type { FAQEntry } from '@/lib/soccer-hubs/faq'
import { WC_METADATA } from '@/lib/world-cup/tournament'

export function worldCupHubFAQ(): FAQEntry[] {
  return [
    {
      question: `When does the ${WC_METADATA.edition} start?`,
      answer:
        `The tournament opens on 11 June 2026 and runs to the final on 19 July 2026, hosted across the USA, Canada and Mexico. It's the first 48-team World Cup — 12 groups of four, with the top two from each group plus the eight best third-placed teams advancing to a 32-team knockout round.`,
    },
    {
      question: `How are SnapBet's World Cup predictions generated?`,
      answer:
        `Once group fixtures are confirmed, each match runs through our two models — V1 (consensus statistical) and V3 (Sharp Intelligence). We surface the pick, confidence, and consensus odds per fixture, exactly as we do for club football. Note that international tournaments behave differently from club leagues, so early-tournament confidence should be read with that in mind. Full methodology is at /methodology.`,
    },
    {
      question: `Are World Cup predictions reliable given there's no recent national-team data?`,
      answer:
        `We're transparent about this: our models are trained primarily on club football, and national-team dynamics differ. We treat the group stage as a calibration window and lock every pick into our public tracker at /performance so you can see real results — wins and losses — rather than relying on claims.`,
    },
    {
      question: `Where can I find predictions for a specific group or team?`,
      answer:
        `Every group has its own page (e.g. /world-cup/group/a) listing its four teams and fixtures, and every nation has a page under /world-cup/team/ with its group context and schedule. Predictions populate automatically as fixtures enter our data window.`,
    },
    {
      question: `Are World Cup predictions free?`,
      answer:
        `Yes. The hub, group pages, team pages, and the public performance tracker are all free. Premium picks unlock the higher-conviction tier; you can preview the tracker's audited premium-only performance at /performance.`,
    },
  ]
}

export function groupPageFAQ(groupLetter: string, teamNames: string[]): FAQEntry[] {
  const teamsList = teamNames.join(', ')
  return [
    {
      question: `Which teams are in World Cup 2026 Group ${groupLetter}?`,
      answer:
        `Group ${groupLetter} contains ${teamsList}. The top two teams advance directly to the knockout round; third place may still progress as one of the eight best third-placed teams across all 12 groups.`,
    },
    {
      question: `How does the 48-team World Cup group stage work?`,
      answer:
        `Each of the 12 groups has four teams playing a single round-robin (three matches each). The top two from every group plus the eight best third-placed teams make up the 32-team knockout bracket. That means a strong third-place finish in Group ${groupLetter} can still be enough to advance.`,
    },
    {
      question: `Where are Group ${groupLetter} predictions?`,
      answer:
        `Match predictions for Group ${groupLetter} appear on this page and on each fixture's match page as soon as the games enter our data window. Each pick carries a model confidence and consensus odds, and every settled result is logged to our public tracker at /performance.`,
    },
  ]
}

export function teamPageFAQ(teamName: string, groupLetter: string): FAQEntry[] {
  return [
    {
      question: `Which group is ${teamName} in at World Cup 2026?`,
      answer:
        `${teamName} is in Group ${groupLetter}. You can see all four group teams and the full group schedule on the Group ${groupLetter} page. To advance, ${teamName} needs a top-two finish — or one of the eight best third-place records across the tournament.`,
    },
    {
      question: `Will SnapBet predict ${teamName}'s matches?`,
      answer:
        `Yes — once ${teamName}'s fixtures are confirmed and enter our data window, each match runs through our V1 and V3 models. We publish the pick, confidence and consensus odds, and log every result to the public tracker at /performance.`,
    },
    {
      question: `How accurate are predictions for national teams like ${teamName}?`,
      answer:
        `Our models are trained mainly on club football, so national-team predictions carry more uncertainty early in a tournament. We treat the group stage as a calibration window and stay transparent about results — both wins and losses — on /performance.`,
    },
  ]
}
