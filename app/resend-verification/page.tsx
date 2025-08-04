import { ResendVerificationForm } from "@/components/auth/resend-verification-form"
import { Suspense } from "react"

export default function ResendVerificationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <ResendVerificationForm />
      </Suspense>
    </div>
  )
} 