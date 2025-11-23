"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { LogoutButton } from "@/components/auth/logout-button"

export default function AuthDebugPage() {
  const { data: session, status } = useSession()
  const [apiSession, setApiSession] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [syncStatus, setSyncStatus] = useState<"synced" | "mismatch" | "checking">("checking")
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
      
      // Determine sync status by comparing useSession() with /api/auth/session
      const hasUserInUseSession = !!session?.user
      const hasUserInApi = !!api?.user
      const bothHaveUser = hasUserInUseSession && hasUserInApi
      const neitherHasUser = !hasUserInUseSession && !hasUserInApi
      
      if (bothHaveUser || neitherHasUser) {
        setSyncStatus("synced")
      } else {
        setSyncStatus("mismatch")
        console.log("[DEBUG] Mismatch detected:", {
          useSessionHasUser: hasUserInUseSession,
          apiHasUser: hasUserInApi,
          useSessionStatus: status,
          apiSession: api,
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
              <div className="text-white">
                <span className="font-semibold">Mismatch:</span>{" "}
                <span className={
                  (session?.user && !apiSession?.user) || (!session?.user && apiSession?.user) 
                    ? "text-red-400" 
                    : "text-green-400"
                }>
                  {(session?.user && !apiSession?.user) || (!session?.user && apiSession?.user) 
                    ? "Yes ⚠️" 
                    : "No ✅"}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
              <button
                onClick={checkSync}
                disabled={isChecking}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-sm"
              >
                {isChecking ? "Checking..." : "Force Check Sync"}
              </button>
              {status === "authenticated" && (
                <div>
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

