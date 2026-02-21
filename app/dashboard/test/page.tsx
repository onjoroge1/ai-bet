"use client"

export default function TestPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Test Page</h1>
        <p className="text-slate-400">
          This is a test page to verify routing is working
        </p>
      </div>

      <div className="bg-slate-800/50 border-slate-700 p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-white mb-4">Route Test</h2>
        <p className="text-slate-300">
          If you can see this page, then the routing to /dashboard/test is working correctly.
        </p>
        <p className="text-slate-300 mt-2">
          Current pathname: {typeof window !== 'undefined' ? window.location.pathname : 'Loading...'}
        </p>
      </div>
    </div>
  )
} 