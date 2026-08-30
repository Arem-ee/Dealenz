"use client"

import React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div className="text-center">
            <p className="text-sm font-medium">Something went wrong</p>
            <p className="text-xs text-muted-foreground mt-1">
              {this.state.error?.message ?? "An unexpected error occurred"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
