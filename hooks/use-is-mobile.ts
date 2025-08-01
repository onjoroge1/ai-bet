import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Handle SSR
    if (typeof window === 'undefined') {
      return
    }

    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    }

    // Initial check
    checkIsMobile()

    // Add event listener
    window.addEventListener('resize', checkIsMobile)

    // Cleanup
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  return isMobile
} 