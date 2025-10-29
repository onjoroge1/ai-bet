import { MatchStatus } from "./types";

/**
 * Format time to HH:mm for upcoming matches
 */
export function formatKickoffTime(kickoffUtc: string): string {
  try {
    const date = new Date(kickoffUtc);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "--:--";
  }
}

/**
 * Format date to DD/MM
 */
export function formatDate(kickoffUtc: string): string {
  try {
    const date = new Date(kickoffUtc);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month}`;
  } catch {
    return "--/--";
  }
}

/**
 * Format minute to MM' (e.g., 43')
 */
export function formatMinute(minute?: number): string {
  if (minute === undefined || minute === null) return "";
  return `${minute}'`;
}

/**
 * Format score as "X-Y"
 */
export function formatScore(score: { home: number; away: number }): string {
  return `${score.home}-${score.away}`;
}

/**
 * Get confidence color class based on percentage
 */
export function getConfidenceColorClass(confidence: number): string {
  if (confidence >= 75) {
    return "text-emerald-600 shadow-[0_0_20px_rgba(16,185,129,.25)]";
  } else if (confidence >= 60) {
    return "text-emerald-500";
  } else if (confidence >= 40) {
    return "text-emerald-400";
  }
  return "text-slate-300";
}

/**
 * Determine if match is scheduled for today
 */
export function isToday(kickoffUtc: string): boolean {
  try {
    const date = new Date(kickoffUtc);
    const today = new Date();
    
    const dateDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return dateDate.getTime() === todayDate.getTime();
  } catch {
    return false;
  }
}

/**
 * Determine if match is scheduled for tomorrow
 */
export function isTomorrow(kickoffUtc: string): boolean {
  try {
    const date = new Date(kickoffUtc);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const tomorrowDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    
    return dateDate.getTime() === tomorrowDate.getTime();
  } catch {
    return false;
  }
}

/**
 * Sort matches by kickoff time (ascending)
 */
export function sortByKickoff<T extends { kickoff_utc: string; status: MatchStatus }>(
  matches: T[]
): T[] {
  return [...matches].sort((a, b) => {
    // Live matches first
    if (a.status === "live" && b.status !== "live") return -1;
    if (a.status !== "live" && b.status === "live") return 1;
    
    // Then sort by kickoff time
    return new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime();
  });
}

/**
 * Sort matches by confidence (descending)
 */
export function sortByConfidence<T extends { predictions?: { free?: { confidence: number } } }>(
  matches: T[]
): T[] {
  return [...matches].sort((a, b) => {
    const confidenceA = a.predictions?.free?.confidence || 0;
    const confidenceB = b.predictions?.free?.confidence || 0;
    return confidenceB - confidenceA;
  });
}

