type LogLevel = 'error' | 'info' | 'debug' | 'warn'

interface LogOptions {
  level?: LogLevel
  error?: Error
  data?: any
  tags?: string[]
}

class Logger {
  private static instance: Logger
  private isDevelopment = process.env.NODE_ENV === 'development'

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private formatMessage(message: string, options: LogOptions): string {
    const timestamp = new Date().toISOString()
    const level = options.level?.toUpperCase() || 'INFO'
    const tags = options.tags?.length ? `[${options.tags.join(', ')}]` : ''
    return `[${timestamp}] ${level} ${tags} ${message}`
  }

  private log(level: LogLevel, message: string, options: LogOptions = {}) {
    const formattedMessage = this.formatMessage(message, { ...options, level })
    
    switch (level) {
      case 'error':
        console.error(formattedMessage, options.error || options.data)
        // Add your error reporting service here (e.g., Sentry)
        break
      case 'warn':
        console.warn(formattedMessage, options.data)
        break
      case 'info':
        console.info(formattedMessage, options.data)
        break
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedMessage, options.data)
        }
        break
    }
  }

  error(message: string, options: LogOptions = {}) {
    this.log('error', message, options)
  }

  warn(message: string, options: LogOptions = {}) {
    this.log('warn', message, options)
  }

  info(message: string, options: LogOptions = {}) {
    this.log('info', message, options)
  }

  debug(message: string, options: LogOptions = {}) {
    this.log('debug', message, options)
  }
}

export const logger = Logger.getInstance() 