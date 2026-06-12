/**
 * Sidebar stats widget. Previously rendered hardcoded demo numbers
 * ("92% week win rate", "94% avg confidence") — replaced with real last-30-day tracker
 * figures (edge pivot P0: no invented accuracy claims).
 */
import { TrackerSidebarStats } from "@/components/tracker/TrackerSidebarStats"

export function WeeklyStats() {
  return <TrackerSidebarStats title="Tracker — last 30 days" />
}
