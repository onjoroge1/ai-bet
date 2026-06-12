/**
 * Lightweight feature flags. The app has no flag service — flags are
 * NEXT_PUBLIC_* env vars read at build/runtime. Keep this the single
 * place flags are defined so they're greppable and consistently named.
 *
 * Usage (server or client):
 *   import { isEdgePivotEnabled } from '@/lib/feature-flags'
 *   if (isEdgePivotEnabled()) { ...render edge UI... }
 */

/**
 * Edge pivot — lead with edge/EV/value bets instead of raw confidence.
 * Default OFF so the redesign ships dark and is enabled deliberately per
 * the migration plan (docs/EDGE_PIVOT_FRONTEND.md §7).
 */
export function isEdgePivotEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EDGE_PIVOT_MODE === 'true'
}
