"use client"

import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
  current?: boolean
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Breadcrumbs component for navigation and SEO
 * Implements structured data for better search engine understanding
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.label,
      "item": item.href ? `${process.env.NEXTAUTH_URL || "https://www.snapbet.bet"}${item.href}` : undefined,
    })),
  }

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      {/* Visual Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}
      >
        <Link
          href="/"
          className="flex items-center hover:text-foreground transition-colors"
          aria-label="Home"
        >
          <Home className="h-4 w-4" />
        </Link>
        
        {items.map((item, index) => (
          <div key={index} className="flex items-center space-x-1">
            <ChevronRight className="h-4 w-4" />
            {item.current ? (
              <span className="font-medium text-foreground" aria-current="page">
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </div>
        ))}
      </nav>
    </>
  )
}

/**
 * Generate breadcrumbs for different page types
 */
export function generateBreadcrumbs(
  pageType: "home" | "blog" | "blog-post" | "country" | "dashboard" | "tips" | "matches",
  params?: {
    countryName?: string
    countryCode?: string
    blogTitle?: string
    blogSlug?: string
    category?: string
  }
): BreadcrumbItem[] {
  const baseItems: BreadcrumbItem[] = []

  switch (pageType) {
    case "home":
      return [{ label: "Home", current: true }]

    case "blog":
      return [
        { label: "Home", href: "/" },
        { label: "Blog", current: true },
      ]

    case "blog-post":
      return [
        { label: "Home", href: "/" },
        { label: "Blog", href: "/blog" },
        { label: params?.blogTitle || "Post", current: true },
      ]

    case "country":
      return [
        { label: "Home", href: "/" },
        { label: params?.countryName || "Country", current: true },
      ]

    case "dashboard":
      return [
        { label: "Home", href: "/" },
        { label: "Dashboard", current: true },
      ]

    case "tips":
      return [
        { label: "Home", href: "/" },
        { label: "Daily Tips", current: true },
      ]

    case "matches":
      return [
        { label: "Home", href: "/" },
        { label: "Live Matches", current: true },
      ]

    default:
      return baseItems
  }
}
