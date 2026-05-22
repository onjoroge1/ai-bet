import type { Metadata } from 'next'
import { DailyHubBody } from '@/components/multisport-hub/DailyHubBody'
import { getSportBySlug } from '@/lib/multisport-hubs/data'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const sport = getSportBySlug('nba')!

export const metadata: Metadata = {
  title: `${sport.displayName} Tomorrow's Picks | SnapBet AI`,
  description: `Tomorrow's ${sport.displayName} AI predictions with confidence scores and odds.`,
  alternates: { canonical: '/nba/tomorrow' },
}

export default async function NBATomorrowPage() {
  return <DailyHubBody sport={sport} dayName="tomorrow" />
}
