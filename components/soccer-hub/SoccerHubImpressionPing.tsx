"use client"

import { useEffect } from "react"

/**
 * Fires a one-shot impression event for the /soccer magazine hub.
 * Lets /admin/blogs/performance answer "is the soccer index actually
 * pulling visitors?" without rolling Vercel Analytics for this slice.
 *
 * Uses sendBeacon so the event survives page unload. Tracker failure
 * never blocks UX.
 */
export function SoccerHubImpressionPing() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const body = JSON.stringify({ type: "soccer_hub_impression" })
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" })
        if (navigator.sendBeacon("/api/premium-tracker/track", blob)) return
      }
      void fetch("/api/premium-tracker/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {})
    } catch {
      /* tracker failure must not break UX */
    }
  }, [])
  return null
}
