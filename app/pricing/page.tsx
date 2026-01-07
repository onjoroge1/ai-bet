import { Suspense } from "react"
import { PricingContent } from "./pricing-content"
import { PricingSkeleton } from "./pricing-skeleton"

/**
 * Pricing Page - Wrapper component with Suspense boundary
 * 
 * This page uses Suspense to wrap PricingContent which uses useSearchParams().
 * This allows Next.js to statically generate the page while deferring the
 * dynamic search params handling to client-side rendering.
 */
export default function PricingPage() {
  return (
    <Suspense fallback={<PricingSkeleton />}>
      <PricingContent />
    </Suspense>
  )
}

