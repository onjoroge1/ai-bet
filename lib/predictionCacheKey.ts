// lib/predictionCacheKey.ts
export function predictionCacheKey(matchId: number, consensusCreatedAt?: string): string {
  const version = consensusCreatedAt || 'none'
  return `prediction:${matchId}:${version}`
}

// Dynamic TTL based on time bucket (as per playbook)
export function ttlForMatch(a?: { time_bucket?: string | null }): number {
  // fallbacks if time_bucket unknown
  if (!a?.time_bucket) return 90 * 60 // 90 min
  
  switch (a.time_bucket) {
    case '72h':
    case '48h': return 2 * 60 * 60   // 2h
    case '24h': return 45 * 60       // 45m
    case '12h': return 30 * 60       // 30m
    case '6h':  return 20 * 60       // 20m
    case '3h':  return 10 * 60       // 10m
    default:    return 90 * 60       // 90 min
  }
}
