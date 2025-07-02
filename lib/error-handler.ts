import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export interface AppError extends Error {
  statusCode?: number
  code?: string
  isOperational?: boolean
}

export class CustomError extends Error implements AppError {
  public statusCode: number
  public code: string
  public isOperational: boolean

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

export function createErrorResponse(error: AppError | Error, context?: string) {
  const appError = error as AppError
  const statusCode = appError.statusCode || 500
  const errorCode = appError.code || 'INTERNAL_ERROR'
  
  // Log the error with context
  logger.error('API Error', {
    tags: ['error', 'api'],
    error: error instanceof Error ? error : undefined,
    data: {
      statusCode,
      errorCode,
      context,
      message: error.message,
      stack: error.stack
    }
  })

  // Don't expose internal errors to clients in production
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : error.message

  return NextResponse.json(
    {
      error: message,
      code: errorCode,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    },
    { status: statusCode }
  )
}

export function handleAsyncError(fn: Function) {
  return async (req: Request, ...args: any[]) => {
    try {
      return await fn(req, ...args)
    } catch (error) {
      return createErrorResponse(error as Error)
    }
  }
}

// Common error types
export const Errors = {
  ValidationError: (message: string) => new CustomError(message, 400, 'VALIDATION_ERROR'),
  UnauthorizedError: (message: string = 'Unauthorized') => new CustomError(message, 401, 'UNAUTHORIZED'),
  ForbiddenError: (message: string = 'Forbidden') => new CustomError(message, 403, 'FORBIDDEN'),
  NotFoundError: (message: string = 'Resource not found') => new CustomError(message, 404, 'NOT_FOUND'),
  ConflictError: (message: string = 'Resource conflict') => new CustomError(message, 409, 'CONFLICT'),
  RateLimitError: (message: string = 'Rate limit exceeded') => new CustomError(message, 429, 'RATE_LIMIT'),
  DatabaseError: (message: string = 'Database operation failed') => new CustomError(message, 500, 'DATABASE_ERROR'),
  ExternalApiError: (message: string = 'External API error') => new CustomError(message, 502, 'EXTERNAL_API_ERROR')
} 