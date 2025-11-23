"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { LogoutButton } from "@/components/auth/logout-button"

export default function AuthDebugPage() {
  const { data: session, status, update } = useSession()
  const [apiSession, setApiSession] = useState<any>(null)

  useEffect(() => {
    console.log("[DEBUG] useSession()", { status, session })
  }, [status, session])

  useEffect(() => {
    // Fetch session from API with no cache to get fresh data
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" })
        const json = await res.json()
        console.log("[DEBUG] /api/auth/session", json)
        setApiSession(json)
        
        // 🔥 CRITICAL: If API has a session but useSession() doesn't, force a refetch
        if (json?.user && status === "unauthenticated") {
          console.log("[DEBUG] Mismatch detected: API has session but useSession() doesn't - forcing refetch")
          // Force useSession() to refetch by calling update()
          await update()
        }
      } catch (error) {
        console.error("[DEBUG] Error fetching /api/auth/session", error)
        setApiSession({ error: String(error) })
      }
    }
    
    fetchSession()
    
    // Set up interval to refetch session periodically (every 2 seconds)
    // This helps catch session changes after logout and sync issues
    const interval = setInterval(fetchSession, 2000)
    
    return () => clearInterval(interval)
  }, [status, update]) // Refetch when session status changes

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Auth Debug Page</h1>
        
        <div className="space-y-6">
          {/* useSession() Status */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-2">useSession()</h2>
            <pre className="text-xs text-green-400 overflow-auto">
              {JSON.stringify({ status, session }, null, 2)}
            </pre>
          </div>

          {/* /api/auth/session */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-2">/api/auth/session</h2>
            <pre className="text-xs text-blue-400 overflow-auto">
              {apiSession ? JSON.stringify(apiSession, null, 2) : "Loading..."}
            </pre>
          </div>

          {/* Quick Status Summary */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-2">Quick Status</h2>
            <div className="space-y-2 text-sm">
              <div className="text-white">
                <span className="font-semibold">useSession status:</span>{" "}
                <span className={status === "authenticated" ? "text-green-400" : status === "loading" ? "text-yellow-400" : "text-red-400"}>
                  {status}
                </span>
              </div>
              <div className="text-white">
                <span className="font-semibold">Has session:</span>{" "}
                <span className={session?.user ? "text-green-400" : "text-red-400"}>
                  {session?.user ? "Yes" : "No"}
                </span>
              </div>
              <div className="text-white">
                <span className="font-semibold">User email:</span>{" "}
                <span className="text-cyan-400">
                  {session?.user?.email || "N/A"}
                </span>
              </div>
              <div className="text-white">
                <span className="font-semibold">User ID:</span>{" "}
                <span className="text-cyan-400">
                  {(session?.user as any)?.id || "N/A"}
                </span>
              </div>
              <div className="text-white">
                <span className="font-semibold">API Session user:</span>{" "}
                <span className="text-cyan-400">
                  {apiSession?.user?.email || "N/A"}
                </span>
              </div>
            </div>
            {status === "authenticated" && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <LogoutButton label="Test Logout" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

