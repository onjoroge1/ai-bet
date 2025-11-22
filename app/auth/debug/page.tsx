"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

export default function AuthDebugPage() {
  const { data: session, status } = useSession()
  const [apiSession, setApiSession] = useState<any>(null)
  const [cookies, setCookies] = useState<string>("")

  useEffect(() => {
    console.log("[DEBUG] useSession()", { status, session })
  }, [status, session])

  useEffect(() => {
    // Fetch session from API
    ;(async () => {
      try {
        const res = await fetch("/api/auth/session")
        const json = await res.json()
        console.log("[DEBUG] /api/auth/session", json)
        setApiSession(json)
      } catch (error) {
        console.error("[DEBUG] Error fetching /api/auth/session", error)
        setApiSession({ error: String(error) })
      }
    })()

    // Get cookies
    if (typeof document !== "undefined") {
      setCookies(document.cookie)
      console.log("[DEBUG] document.cookie", document.cookie)
    }
  }, [])

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

          {/* Cookies */}
          <div className="bg-slate-800 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-2">document.cookie</h2>
            <pre className="text-xs text-yellow-400 overflow-auto break-all">
              {cookies || "No cookies"}
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
                <span className={session ? "text-green-400" : "text-red-400"}>
                  {session ? "Yes" : "No"}
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
                <span className="font-semibold">Has session cookie:</span>{" "}
                <span className={cookies.includes("next-auth.session-token") ? "text-green-400" : "text-red-400"}>
                  {cookies.includes("next-auth.session-token") ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

