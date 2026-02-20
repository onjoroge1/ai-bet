"use client"

import { usePathname } from "next/navigation"
import { Footer } from "@/components/footer"

/**
 * ConditionalFooter - Renders Footer only on non-dashboard routes.
 * The dashboard has its own sidebar layout and doesn't need the global footer.
 */
export function ConditionalFooter() {
  const pathname = usePathname()

  if (pathname.startsWith("/dashboard")) {
    return null
  }

  return <Footer />
}

