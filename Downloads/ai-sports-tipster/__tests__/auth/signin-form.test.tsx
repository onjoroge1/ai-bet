import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignInForm } from '@/components/auth/signin-form'
import { logger } from '@/lib/logger'

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('SignInForm', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
  })

  it('renders the sign in form', () => {
    render(<SignInForm />)
    
    // Check for main elements
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('handles form submission with valid credentials', async () => {
    const mockRouter = {
      push: jest.fn(),
    }
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue(mockRouter)

    // Mock successful API response
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Successfully signed in' }),
    })

    render(<SignInForm />)

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    })

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    // Wait for the form submission to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          remember: false,
        }),
      })
    })

    // Check that the router was called with the correct path
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
  })

  it('handles rate limiting error', async () => {
    // Mock rate limit error response
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Too many login attempts' }),
    })

    render(<SignInForm />)

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    })

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    // Wait for the error message
    await waitFor(() => {
      expect(screen.getByText(/too many login attempts/i)).toBeInTheDocument()
    })

    // Check that the logger was called with the correct parameters
    expect(logger.warn).toHaveBeenCalledWith(
      'Rate limit exceeded for sign in attempt',
      expect.objectContaining({
        tags: ['auth', 'signin', 'rate-limit'],
        data: { email: 'test@example.com' },
      })
    )
  })

  it('handles invalid credentials error', async () => {
    // Mock invalid credentials error response
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid email or password' }),
    })

    render(<SignInForm />)

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    })

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    // Wait for the error message
    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })

    // Check that the logger was called with the correct parameters
    expect(logger.error).toHaveBeenCalledWith(
      'Sign in failed',
      expect.objectContaining({
        tags: ['auth', 'signin'],
        data: { email: 'test@example.com', status: 401 },
      })
    )
  })

  it('toggles password visibility', () => {
    render(<SignInForm />)
    
    const passwordInput = screen.getByLabelText(/password/i)
    const toggleButton = screen.getByRole('button', { name: /show password/i })

    // Password should be hidden by default
    expect(passwordInput).toHaveAttribute('type', 'password')

    // Click the toggle button
    fireEvent.click(toggleButton)

    // Password should be visible
    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(toggleButton).toHaveAttribute('aria-label', 'Hide password')

    // Click the toggle button again
    fireEvent.click(toggleButton)

    // Password should be hidden again
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(toggleButton).toHaveAttribute('aria-label', 'Show password')
  })
}) 