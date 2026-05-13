import Link from 'next/link'
import prisma from '@/lib/db'
import { makeTeamSlug } from '@/lib/team-stats/slug'
import { Users } from 'lucide-react'

interface TeamLinksRowProps {
  homeTeam: string
  awayTeam: string
}

/**
 * Server-rendered band that links a match blog to the two teams' pages.
 * Only renders teams that have a live TeamStats row (so we never produce
 * a broken /team/[slug]/predictions link).
 *
 * Drop-in above the MatchCTA on /blog/[slug] and /[country]/blog/[slug].
 */
export async function TeamLinksRow({ homeTeam, awayTeam }: TeamLinksRowProps) {
  if (!homeTeam || !awayTeam) return null

  const homeSlug = makeTeamSlug(homeTeam, homeTeam)
  const awaySlug = makeTeamSlug(awayTeam, awayTeam)

  // Single query: do these slugs have live pages?
  const live = await prisma.teamStats.findMany({
    where: { slug: { in: [homeSlug, awaySlug] }, isActive: true },
    select: { slug: true, name: true, logoUrl: true, matchesPlayed: true },
  })
  if (live.length === 0) return null

  const bySlug = new Map(live.map(t => [t.slug, t]))
  const homeLive = bySlug.get(homeSlug)
  const awayLive = bySlug.get(awaySlug)

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 sm:p-5 my-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest">
        <Users className="w-3.5 h-3.5" />
        Team analysis
      </div>
      <div className="flex flex-wrap gap-2">
        {homeLive && (
          <Link
            href={`/team/${homeLive.slug}/predictions`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 hover:border-blue-500/40 hover:bg-slate-900 transition-colors text-sm text-white"
          >
            {homeLive.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={homeLive.logoUrl} alt="" className="w-5 h-5 rounded" />
            )}
            <span>{homeLive.name}</span>
            <span className="text-xs text-slate-400">→</span>
          </Link>
        )}
        {awayLive && (
          <Link
            href={`/team/${awayLive.slug}/predictions`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-700 hover:border-blue-500/40 hover:bg-slate-900 transition-colors text-sm text-white"
          >
            {awayLive.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={awayLive.logoUrl} alt="" className="w-5 h-5 rounded" />
            )}
            <span>{awayLive.name}</span>
            <span className="text-xs text-slate-400">→</span>
          </Link>
        )}
      </div>
    </div>
  )
}
