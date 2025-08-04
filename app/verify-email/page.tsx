import { EmailVerificationForm } from "@/components/auth/email-verification-form"
import { Suspense } from "react"

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <EmailVerificationForm />
      </Suspense>
    </div>
  )
} 