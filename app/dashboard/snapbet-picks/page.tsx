"use client"

import { SnapBetPicksSection } from "@/components/snapbet-picks/SnapBetPicksSection"

export default function SnapBetPicksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <SnapBetPicksSection limit={20} showHeader />
      </div>
    </div>
  )
}
