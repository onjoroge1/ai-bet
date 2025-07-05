import React from 'react'

/**
 * Accessibility utilities and components for the AI Sports Tipster application
 */

// Skip to main content link for keyboard navigation
export function SkipToMainContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-emerald-600 text-white px-4 py-2 rounded-md z-50"
    >
      Skip to main content
    </a>
  )
}

// Screen reader only text
export function SrOnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>
}

// Loading state with proper ARIA attributes
export function LoadingSpinner({ 
  size = "md", 
  label = "Loading...",
  className = "" 
}: { 
  size?: "sm" | "md" | "lg"
  label?: string
  className?: string 
}) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8"
  }

  return (
    <div 
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-label={label}
    >
      <div 
        className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600`}
        aria-hidden="true"
      />
      <SrOnly>{label}</SrOnly>
    </div>
  )
}

// Error boundary with accessibility
export function ErrorMessage({ 
  message, 
  onRetry 
}: { 
  message: string
  onRetry?: () => void 
}) {
  return (
    <div 
      className="bg-red-900/20 border border-red-700 rounded-lg p-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center space-x-2">
        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">!</span>
        </div>
        <p className="text-red-300 font-medium">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-sm text-red-300 hover:text-white underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
        >
          Try again
        </button>
      )}
    </div>
  )
}

// Focus trap for modals
export function useFocusTrap(enabled: boolean = true) {
  React.useEffect(() => {
    if (!enabled) return

    const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const firstFocusableElement = document.querySelector(focusableElements) as HTMLElement
    const focusableContent = document.querySelectorAll(focusableElements)
    const lastFocusableElement = focusableContent[focusableContent.length - 1] as HTMLElement

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus()
            e.preventDefault()
          }
        } else {
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus()
            e.preventDefault()
          }
        }
      }
    }

    document.addEventListener('keydown', handleTabKey)
    return () => document.removeEventListener('keydown', handleTabKey)
  }, [enabled])
}

// Announce changes to screen readers
export function useAnnouncement() {
  const [announcement, setAnnouncement] = React.useState('')
  
  React.useEffect(() => {
    if (announcement) {
      const timeout = setTimeout(() => setAnnouncement(''), 1000)
      return () => clearTimeout(timeout)
    }
  }, [announcement])

  return {
    announcement,
    announce: setAnnouncement
  }
}

// Announcement component
export function LiveRegion({ announcement }: { announcement: string }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  )
}

// Keyboard navigation hook
export function useKeyboardNavigation() {
  const handleKeyDown = React.useCallback((event: KeyboardEvent, handlers: {
    onEnter?: () => void
    onEscape?: () => void
    onArrowUp?: () => void
    onArrowDown?: () => void
    onArrowLeft?: () => void
    onArrowRight?: () => void
  }) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        handlers.onEnter?.()
        break
      case 'Escape':
        handlers.onEscape?.()
        break
      case 'ArrowUp':
        handlers.onArrowUp?.()
        break
      case 'ArrowDown':
        handlers.onArrowDown?.()
        break
      case 'ArrowLeft':
        handlers.onArrowLeft?.()
        break
      case 'ArrowRight':
        handlers.onArrowRight?.()
        break
    }
  }, [])

  return { handleKeyDown }
} 