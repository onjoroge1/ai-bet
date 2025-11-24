"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { LogoutButton } from "@/components/auth/logout-button"

/**
 * Auth Debug Page - Server-Side First Architecture
 * 
 * 🔥 NEW ARCHITECTURE:
 * - Primary Source of Truth: /api/auth/session (server-side)
 * - Background Sync: useSession() updates in background (non-blocking)
 * - Auth Decisions: Made server-side, no waiting for client sync
 * - Sign-Off: Kill session server-side, redirect immediately
 */
export default function AuthDebugPage() {
  const { data: session, status, update } = useSession()
  const [apiSession, setApiSession] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [syncStatus, setSyncStatus] = useState<"synced" | "mismatch" | "checking">("checking")
  const [architecture, setArchitecture] = useState<"server-side-first" | "client-side-first">("server-side-first")
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 🔥 SIMPLIFIED: Direct /api/auth/session fetch (matches signin/logout approach)
  const fetchApiSession = async () => {
    try {
      const res = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch session: ${res.status}`)
      }
      return await res.json()
    } catch (error) {
      console.error("[DEBUG] Error fetching /api/auth/session", error)
      return { error: String(error) }
    }
  }

  // Check session sync status
  const checkSync = useCallback(async () => {
    setIsChecking(true)
    setSyncStatus("checking")
    
    try {
      const api = await fetchApiSession()
      setApiSession(api)
      
      // 🔥 SERVER-SIDE FIRST ARCHITECTURE:
      // - /api/auth/session is PRIMARY source of truth
      // - useSession() is SECONDARY (background sync)
      // - Mismatch is OK if useSession() hasn't synced yet (non-blocking)
      
      const hasUserInUseSession = !!session?.user
      const hasUserInApi = !!api?.user
      const bothHaveUser = hasUserInUseSession && hasUserInApi
      const neitherHasUser = !hasUserInUseSession && !hasUserInApi
      
      // In server-side-first architecture:
      // - If API has user but useSession() doesn't = OK (useSession() syncing in background)
      // - If API doesn't have user but useSession() does = Mismatch (stale client cache)
      // - If both match = Perfect sync
      
      if (bothHaveUser || neitherHasUser) {
        setSyncStatus("synced")
      } else if (hasUserInApi && !hasUserInUseSession) {
        // API has session, useSession() hasn't synced yet - this is OK in server-side-first
        setSyncStatus("synced") // Consider this synced - useSession() will catch up
        console.log("[DEBUG] Server-side session exists, useSession() syncing in background (expected)", {
          apiHasUser: hasUserInApi,
          useSessionStatus: status,
          architecture: "server-side-first",
        })
      } else {
        // useSession() has session but API doesn't - this is a real mismatch
        setSyncStatus("mismatch")
        console.log("[DEBUG] Mismatch detected:", {
          useSessionHasUser: hasUserInUseSession,
          apiHasUser: hasUserInApi,
          useSessionStatus: status,
          apiSession: api,
          architecture: "server-side-first",
        })
      }
    } catch (error) {
      console.error("[DEBUG] Error checking session sync", error)
      setSyncStatus("mismatch")
      setApiSession({ error: String(error) })
    } finally {
      setIsChecking(false)
    }
  }, [status, session])
  
  // Manual trigger for useSession() sync (for testing)
  const triggerBackgroundSync = useCallback(async () => {
    console.log("[DEBUG] Manually triggering useSession() background sync")
    await update()
    // Wait a bit for sync to complete
    setTimeout(() => {
      checkSync()
    }, 500)
  }, [update, checkSync])

  // Fetch API session when useSession() changes
  useEffect(() => {
    console.log("[DEBUG] useSession() changed", { status, session })
    checkSync()
  }, [status, session, checkSync])

  // Set up polling to periodically check sync status (every 2 seconds)
  useEffect(() => {
    // Initial check
    checkSync()

    // Set up interval to check sync status periodically
    intervalRef.current = setInterval(checkSync, 2000)

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [checkSync])

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Auth Debug Page</h1>
        <p className="text-slate-400 text-sm mb-6">
          🔥 Server-Side First Architecture: /api/auth/session is primary source of truth, useSession() syncs in background
        </p>
        
        <div className="space-y-6">
          {/* Architecture Info */}
          <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-emerald-400 mb-2">Architecture: Server-Side First</h2>
            <div className="text-sm text-slate-300 space-y-1">
              <p>✅ <strong>Primary:</strong> /api/auth/session (server-side, immediate)</p>
              <p>🔄 <strong>Background:</strong> useSession() (client-side, syncs in background)</p>
              <p>⚡ <strong>Auth Decisions:</strong> Made server-side, no waiting for client sync</p>
              <p>🚪 <strong>Sign-Off:</strong> Kill session server-side, redirect immediately</p>
            </div>
          </div>

          {/* /api/auth/session - PRIMARY SOURCE OF TRUTH */}
          <div className="bg-slate-800 p-4 rounded-lg border-2 border-blue-500/50">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-white">/api/auth/session</h2>
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">PRIMARY SOURCE</span>
            </div>
            <pre className="text-xs text-blue-400 overflow-auto max-h-64">
              {apiSession ? JSON.stringify(apiSession, null, 2) : "Loading..."}
            </pre>
            <div className="mt-2 text-xs text-slate-400">
              This is the <strong>primary source of truth</strong> for authentication. All auth decisions are made based on this.
            </div>
          </div>

          {/* useSession() - BACKGROUND SYNC */}
          <div className="bg-slate-800 p-4 rounded-lg border-2 border-green-500/30">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-white">useSession()</h2>
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">BACKGROUND SYNC</span>
            </div>
            <pre className="text-xs text-green-400 overflow-auto max-h-64">
              {JSON.stringify({ status, session }, null, 2)}
            </pre>
            <div className="mt-2 text-xs text-slate-400">
              This syncs in the <strong>background</strong> and is used for UI components. Mismatch is OK if it hasn't synced yet.
            </div>
          </div>

          {/* Quick Status Summary */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-2">Quick Status</h2>
            <div className="space-y-2 text-sm">
              <div className="text-white">
                <span className="font-semibold">Architecture:</span>{" "}
                <span className="text-emerald-400 font-mono">server-side-first</span>
              </div>
              <div className="text-white">
                <span className="font-semibold">Sync Status:</span>{" "}
                <span className={
                  syncStatus === "synced" ? "text-green-400" : 
                  syncStatus === "mismatch" ? "text-red-400" : 
                  "text-yellow-400"
                }>
                  {isChecking ? "Checking..." : syncStatus === "synced" ? "✅ Synced" : syncStatus === "mismatch" ? "⚠️ Mismatch" : "Checking..."}
                </span>
              </div>
              <div className="text-white">
                <span className="font-semibold">Server Session (Primary):</span>{" "}
                <span className={apiSession?.user ? "text-green-400" : "text-red-400"}>
                  {apiSession?.user ? `✅ ${apiSession.user.email}` : "❌ No session"}
                </span>
              </div>
              <div className="text-white">
                <span className="font-semibold">Client Session (Background):</span>{" "}
                <span className={status === "authenticated" ? "text-green-400" : status === "loading" ? "text-yellow-400" : "text-red-400"}>
                  {status === "authenticated" ? `✅ ${session?.user?.email || "Authenticated"}` : status === "loading" ? "⏳ Loading..." : "❌ Not authenticated"}
                </span>
              </div>
              <div className="text-white">
                <span className="font-semibold">User ID (Server):</span>{" "}
                <span className="text-cyan-400">
                  {apiSession?.user?.id || "N/A"}
                </span>
              </div>
              <div className="text-white">
                <span className="font-semibold">User ID (Client):</span>{" "}
                <span className="text-cyan-400">
                  {(session?.user as any)?.id || "N/A"}
                </span>
              </div>
              <div className="text-white">
                <span className="font-semibold">Expected Behavior:</span>{" "}
                <span className="text-slate-400 text-xs">
                  Server session is primary. Client session may lag behind (OK - non-blocking).
                  {apiSession?.user && !session?.user && " ⚠️ Client sync in progress (expected)"}
                  {!apiSession?.user && session?.user && " ⚠️ Stale client cache (mismatch)"}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={checkSync}
                  disabled={isChecking}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-sm"
                >
                  {isChecking ? "Checking..." : "Check Sync"}
                </button>
                <button
                  onClick={triggerBackgroundSync}
                  disabled={isChecking}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-sm"
                >
                  Trigger useSession() Sync
                </button>
              </div>
              {status === "authenticated" && (
                <div className="mt-2">
                  <LogoutButton label="Test Logout" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

