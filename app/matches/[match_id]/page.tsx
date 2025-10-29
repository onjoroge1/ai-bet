"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * Redirect route from /matches/[match_id] to /match/[match_id]
 * For backward compatibility with old URLs
 */
export default function MatchesRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.match_id as string

  useEffect(() => {
    if (matchId) {
      router.replace(`/match/${matchId}`)
    }
  }, [matchId, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mx-auto mb-4" />
        <div className="text-white text-lg font-semibold">Redirecting...</div>
      </div>
    </div>
  )
}

