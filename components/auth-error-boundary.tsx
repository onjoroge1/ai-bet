"use client"

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { logger } from '@/lib/logger'

interface AuthErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface AuthErrorBoundaryProps {
  children: React.ReactNode
}

/**
 * AuthErrorBoundary - Catches and handles authentication errors
 * 
 * Prevents app crashes from auth-related errors and provides
 * graceful error recovery with user-friendly messages.
 */
export class AuthErrorBoundary extends React.Component<
  AuthErrorBoundaryProps,
  AuthErrorBoundaryState
> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Auth Error Boundary caught an error', {
      tags: ['auth', 'error-boundary', 'critical'],
      error,
      data: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'AuthErrorBoundary',
      },
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/signin'
  }

  handleRefresh = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
          <Card className="max-w-md w-full bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
              <h2 className="text-xl font-bold text-white">Authentication Error</h2>
            </div>
            <p className="text-slate-300 mb-4">
              An error occurred during authentication. Please try refreshing the page or signing in again.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 p-3 bg-slate-900 rounded text-xs text-slate-400">
                <summary className="cursor-pointer mb-2">Error Details (Development Only)</summary>
                <pre className="whitespace-pre-wrap overflow-auto">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex space-x-3">
              <Button
                onClick={this.handleReset}
                className="flex-1"
              >
                Go to Sign In
              </Button>
              <Button
                variant="outline"
                onClick={this.handleRefresh}
                className="flex-1"
              >
                Refresh Page
              </Button>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

