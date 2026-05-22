import type { Metadata } from 'next'
import { SportHubBody } from '@/components/multisport-hub/SportHubBody'
import { getSportBySlug } from '@/lib/multisport-hubs/data'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const sport = getSportBySlug('nba')!

export const metadata: Metadata = {
  title: `${sport.displayName} Predictions & AI Analysis | SnapBet AI`,
  description: sport.description,
  alternates: { canonical: '/nba' },
  openGraph: {
    title: `${sport.displayName} AI Predictions`,
    description: sport.description,
    url: '/nba',
    type: 'website',
  },
}

export default async function NBAHubPage() {
  return <SportHubBody sport={sport} />
}
