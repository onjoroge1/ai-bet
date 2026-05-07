import prisma from './lib/db'

async function main() {
  const now = new Date()
  const in24 = new Date(now.getTime() + 24 * 3600 * 1000)
  const in48 = new Date(now.getTime() + 48 * 3600 * 1000)
  const in72 = new Date(now.getTime() + 72 * 3600 * 1000)
  const in7d = new Date(now.getTime() + 7 * 86400 * 1000)

  const [
    totalUpcoming, futureUpcoming, stalePast, next24, next48, next72, next7d, hasOdds, lastSync
  ] = await Promise.all([
    prisma.marketMatch.count({ where: { status: 'UPCOMING', isActive: true } }),
    prisma.marketMatch.count({ where: { status: 'UPCOMING', isActive: true, kickoffDate: { gte: now } } }),
    prisma.marketMatch.count({ where: { status: 'UPCOMING', isActive: true, kickoffDate: { lt: now } } }),
    prisma.marketMatch.count({ where: { status: 'UPCOMING', isActive: true, kickoffDate: { gte: now, lt: in24 } } }),
    prisma.marketMatch.count({ where: { status: 'UPCOMING', isActive: true, kickoffDate: { gte: in24, lt: in48 } } }),
    prisma.marketMatch.count({ where: { status: 'UPCOMING', isActive: true, kickoffDate: { gte: in48, lt: in72 } } }),
    prisma.marketMatch.count({ where: { status: 'UPCOMING', isActive: true, kickoffDate: { gte: in72, lt: in7d } } }),
    prisma.marketMatch.count({ where: { status: 'UPCOMING', isActive: true, kickoffDate: { gte: now }, consensusOdds: { not: null } } }),
    prisma.marketMatch.findFirst({
      where: { status: 'UPCOMING', isActive: true },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true, syncCount: true, syncErrors: true, lastSyncError: true },
    }),
  ])

  console.log('Now:                       ', now.toISOString())
  console.log('Total UPCOMING (active):   ', totalUpcoming)
  console.log('Future UPCOMING:           ', futureUpcoming)
  console.log('Stale (past kickoff):      ', stalePast)
  console.log('  in next 24h:             ', next24)
  console.log('  24-48h:                  ', next48)
  console.log('  48-72h:                  ', next72)
  console.log('  3-7d:                    ', next7d)
  console.log('Future with consensusOdds: ', hasOdds)
  console.log('Most recent sync:          ', lastSync?.lastSyncedAt?.toISOString())
  console.log('  syncCount:               ', lastSync?.syncCount)
  console.log('  syncErrors:              ', lastSync?.syncErrors)
  console.log('  lastSyncError:           ', lastSync?.lastSyncError)
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
