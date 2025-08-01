import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '@/hooks/use-is-mobile'
import React from 'react'

// Mock window.matchMedia
const mockMatchMedia = jest.fn()
const mockAddListener = jest.fn()
const mockRemoveListener = jest.fn()

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia.mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: mockAddListener,
    removeListener: mockRemoveListener,
    addEventListener: mockAddListener,
    removeEventListener: mockRemoveListener,
    dispatchEvent: jest.fn(),
  })),
})

describe('Custom Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
  })

  describe('useIsMobile', () => {
    it('should return true for mobile viewport', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(true)
    })

    it('should return false for desktop viewport', () => {
      // Set desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(false)
    })

    it('should handle SSR environment', () => {
      // Mock window as undefined for SSR
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(false)

      // Restore window
      global.window = originalWindow
    })

    it('should handle matchMedia not being available', () => {
      // Mock matchMedia as undefined
      const originalMatchMedia = window.matchMedia
      // @ts-ignore
      delete window.matchMedia

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(false)

      // Restore matchMedia
      window.matchMedia = originalMatchMedia
    })

    it('should handle viewport changes', () => {
      // Set initial desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(false)

      // Simulate viewport change to mobile
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 375,
        })
        // Trigger resize event
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current).toBe(true)
    })
  })

  describe('useLocalStorage', () => {
    const mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }

    beforeEach(() => {
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })
      jest.clearAllMocks()
    })

    // Local implementation for testing
    const useLocalStorage = (key: string, defaultValue: any) => {
      const [value, setValue] = React.useState(() => {
        try {
          const item = window.localStorage.getItem(key)
          return item ? JSON.parse(item) : defaultValue
        } catch (error) {
          return defaultValue
        }
      })

      const setStoredValue = (newValue: any) => {
        try {
          setValue(newValue)
          window.localStorage.setItem(key, JSON.stringify(newValue))
        } catch (error) {
          console.error('Error setting localStorage value:', error)
        }
      }

      return [value, setStoredValue]
    }

    it('should get value from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('"test-value"')

      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
      expect(result.current[0]).toBe('test-value')
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key')
    })

    it('should return default value when key not found', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
      expect(result.current[0]).toBe('default')
    })

    it('should set value in localStorage', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))

      act(() => {
        result.current[1]('new-value')
      })

      expect(result.current[0]).toBe('new-value')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('test-key', '"new-value"')
    })

    it('should handle JSON parsing errors', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json')

      const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
      expect(result.current[0]).toBe('default')
    })
  })

  describe('useDebounce', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    // Local implementation for testing
    const useDebounce = (value: any, delay: number) => {
      const [debouncedValue, setDebouncedValue] = React.useState(value)

      React.useEffect(() => {
        const handler = setTimeout(() => {
          setDebouncedValue(value)
        }, delay)

        return () => {
          clearTimeout(handler)
        }
      }, [value, delay])

      return debouncedValue
    }

    it('should debounce value changes', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        { initialProps: { value: 'initial' } }
      )

      expect(result.current).toBe('initial')

      rerender({ value: 'changed' })
      expect(result.current).toBe('initial') // Still initial because of debounce

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('changed')
    })

    it('should cancel previous timeout on new value', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        { initialProps: { value: 'initial' } }
      )

      rerender({ value: 'changed1' })
      rerender({ value: 'changed2' })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('changed2') // Should be the last value
    })
  })
}) 