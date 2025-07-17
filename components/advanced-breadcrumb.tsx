"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Home, BookOpen, Shield, User, Target, HelpCircle } from "lucide-react"
import { BreadcrumbListSchema } from "@/components/schema-markup"

interface BreadcrumbItem {
  name: string
  href: string
  current?: boolean
  icon?: React.ComponentType<{ className?: string }>
}

interface PageContext {
  title?: string
  category?: string
  type?: string
}

interface AdvancedBreadcrumbProps {
  context?: PageContext
  customItems?: BreadcrumbItem[]
}

export function AdvancedBreadcrumb({ context, customItems }: AdvancedBreadcrumbProps) {
  const pathname = usePathname()

  // Generate breadcrumb items based on current path and context
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    // If custom items provided, use those
    if (customItems) {
      return customItems
    }

    const segments = pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = [
      { name: 'Home', href: '/', icon: Home }
    ]

    let currentPath = ''
    
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      
      const breadcrumbItem = getBreadcrumbItem(segment, segments, index, context)
      
      breadcrumbs.push({
        ...breadcrumbItem,
        href: currentPath,
        current: index === segments.length - 1
      })
    })

    return breadcrumbs
  }

  // Get breadcrumb item with icon and proper naming
  const getBreadcrumbItem = (
    segment: string, 
    allSegments: string[], 
    index: number, 
    context?: PageContext
  ): Omit<BreadcrumbItem, 'href' | 'current'> => {
    
    // Handle special cases with icons and context-aware naming
    switch (segment) {
      case 'dashboard':
        return { name: 'Dashboard', icon: Target }
      case 'admin':
        return { name: 'Admin', icon: Shield }
      case 'blogs':
        return { name: 'Blog Management', icon: BookOpen }
      case 'blog':
        return { name: 'Blog', icon: BookOpen }
      case 'faq':
        return { name: 'FAQ', icon: HelpCircle }
      case 'daily-tips':
        return { name: 'Daily Tips', icon: Target }
      case 'weekly-specials':
        return { name: 'Weekly Specials', icon: Target }
      case 'live-predictions':
        return { name: 'Live Predictions', icon: Target }
      case 'support':
        return { name: 'Support', icon: HelpCircle }
      case 'signin':
        return { name: 'Sign In', icon: User }
      case 'signup':
        return { name: 'Sign Up', icon: User }
      case 'create':
        return { name: 'Create', icon: BookOpen }
      case 'edit':
        return { name: 'Edit', icon: BookOpen }
      case 'profile':
        return { name: 'Profile', icon: User }
      case 'settings':
        return { name: 'Settings', icon: Shield }
      case 'analytics':
        return { name: 'Analytics', icon: Target }
      case 'notifications':
        return { name: 'Notifications', icon: HelpCircle }
      default:
        // Handle dynamic segments with context
        if (context?.title && index === allSegments.length - 1) {
          return { name: context.title }
        }
        
        if (context?.category && segment === context.category) {
          return { name: context.category }
        }
        
        // Handle long slugs (likely blog posts or IDs)
        if (segment.length > 20) {
          return { name: context?.title || 'Details' }
        }
        
        // Capitalize and format segment
        const formattedName = segment
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        
        return { name: formattedName }
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
                  className="text-emerald-400 font-medium flex items-center"
                  aria-current="page"
                >
                  {item.icon && <item.icon className="w-4 h-4 mr-1" />}
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-slate-400 hover:text-emerald-400 transition-colors flex items-center"
                >
                  {item.icon && <item.icon className="w-4 h-4 mr-1" />}
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