/**
 * One-shot: set lastEnrichmentAt = updatedAt for QuickPurchase rows whose
 * predictionData is fresh (updatedAt within last 1h) but lastEnrichmentAt
 * is null. These are the 34 matches we just refreshed via /predict before
 * adding the lastEnrichmentAt write to the route.
 *
 * After this lands, /admin/matches will correctly reflect their fresh state.
 */
import prisma from '../lib/db'

;(async () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  // Find candidates first so we can report
  const candidates = await prisma.quickPurchase.findMany({
    where: {
      lastEnrichmentAt: null,
      updatedAt: { gte: oneHourAgo },
      predictionData: { not: { equals: null as unknown as object } },
    },
    select: { id: true, matchId: true, updatedAt: true },
  })
  console.log(`Candidates (fresh predictionData but no lastEnrichmentAt): ${candidates.length}`)

  if (candidates.length === 0) {
    console.log('Nothing to backfill.\n')
    await prisma.$disconnect()
    process.exit(0)
  }

  // Sync lastEnrichmentAt to updatedAt for each
  let ok = 0
  for (const c of candidates) {
    await prisma.quickPurchase.update({
      where: { id: c.id },
      data: { lastEnrichmentAt: c.updatedAt },
    })
    ok++
  }
  console.log(`✅ Backfilled lastEnrichmentAt on ${ok} rows.\n`)
  await prisma.$disconnect()
  process.exit(0)
})()
