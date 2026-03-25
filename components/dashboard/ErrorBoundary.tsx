"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Section name shown in the error message */
  section?: string
  /** Compact mode for smaller widgets */
  compact?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class DashboardErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[Dashboard Error] ${this.props.section || "Unknown section"}:`, error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const { section, compact } = this.props

      if (compact) {
        return (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{section || "Section"} failed to load</span>
            <button onClick={this.handleRetry} className="ml-auto text-red-300 hover:text-white underline">
              Retry
            </button>
          </div>
        )
      }

      return (
        <Card className="bg-slate-800/50 border-red-500/20">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">
              {section ? `${section} failed to load` : "Something went wrong"}
            </h3>
            <p className="text-xs text-slate-400 mb-4 max-w-sm">
              This section encountered an error. Your other dashboard features are unaffected.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="border-slate-600 text-slate-300 hover:text-white"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
