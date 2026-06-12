/**
 * Sidebar stats widget. Previously rendered hardcoded demo numbers
 * ("91% live accuracy", "82% avg confidence") — replaced with real last-30-day tracker
 * figures (edge pivot P0: no invented accuracy claims).
 */
import { TrackerSidebarStats } from "@/components/tracker/TrackerSidebarStats"

export function LiveStats() {
  return <TrackerSidebarStats title="Tracker — last 30 days" />
}
