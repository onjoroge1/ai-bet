import { SignInForm } from "@/components/auth/signin-form"
import { Suspense } from "react"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <SignInForm />
      </Suspense>
    </div>
  )
}
