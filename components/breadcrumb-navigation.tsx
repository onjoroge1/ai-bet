"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import { BreadcrumbListSchema } from "@/components/schema-markup"

interface BreadcrumbItem {
  name: string
  href: string
  current?: boolean
}

export function BreadcrumbNavigation() {
  const pathname = usePathname()

  // Generate breadcrumb items based on current path
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = [
      { name: 'Home', href: '/' }
    ]

    let currentPath = ''
    
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      
      // Convert segment to readable name
      const name = getBreadcrumbName(segment, segments, index)
      
      breadcrumbs.push({
        name,
        href: currentPath,
        current: index === segments.length - 1
      })
    })

    return breadcrumbs
  }

  // Get human-readable name for breadcrumb segment
  const getBreadcrumbName = (segment: string, allSegments: string[], index: number): string => {
    // Handle special cases
    switch (segment) {
      case 'dashboard':
        return 'Dashboard'
      case 'admin':
        return 'Admin'
      case 'blogs':
        return 'Blog'
      case 'blog':
        return 'Blog'
      case 'faq':
        return 'FAQ'
      case 'daily-tips':
        return 'Daily Tips'
      case 'weekly-specials':
        return 'Weekly Specials'
      case 'live-predictions':
        return 'Live Predictions'
      case 'support':
        return 'Support'
      case 'signin':
        return 'Sign In'
      case 'signup':
        return 'Sign Up'
      case 'create':
        return 'Create'
      case 'edit':
        return 'Edit'
      default:
        // Handle dynamic segments (like blog slugs, user IDs, etc.)
        if (segment.length > 20) {
          return 'Details' // For long slugs or IDs
        }
        // Capitalize and format segment
        return segment
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
    }
  }

  const breadcrumbs = generateBreadcrumbs()

  // Don't show breadcrumbs on homepage
  if (breadcrumbs.length <= 1) {
    return null
  }

  return (
    <>
      {/* Schema Markup for SEO */}
      <BreadcrumbListSchema 
        items={breadcrumbs.map(item => ({
          name: item.name,
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://snapbet.ai'}${item.href}`
        }))} 
      />

      {/* Visual Breadcrumb Navigation */}
      <nav className="mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2 text-sm">
          {breadcrumbs.map((item, index) => (
            <li key={item.href} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 text-slate-500 mx-2" />
              )}
              
              {item.current ? (
                <span 
                  className="text-emerald-400 font-medium"
                  aria-current="page"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-slate-400 hover:text-emerald-400 transition-colors flex items-center"
                >
                  {index === 0 && <Home className="w-4 h-4 mr-1" />}
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
} 