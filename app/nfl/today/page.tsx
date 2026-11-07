import type { Metadata } from 'next'
import { DailyHubBody } from '@/components/multisport-hub/DailyHubBody'
import { getSportBySlug } from '@/lib/multisport-hubs/data'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const sport = getSportBySlug('nfl')!

export const metadata: Metadata = {
  title: `${sport.displayName} Today's Picks | SnapBet AI`,
  description: `Today's ${sport.displayName} AI predictions, confidence scores, and consensus odds. Every game in our data window.`,
  alternates: { canonical: '/nfl/today' },
}

export default async function NFLTodayPage() {
  return <DailyHubBody sport={sport} dayName="today" />
}
