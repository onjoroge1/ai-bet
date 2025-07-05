interface LogLevel {
  ERROR: 'error'
  WARN: 'warn'
  INFO: 'info'
  DEBUG: 'debug'
}

const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
}

const isDevelopment = process.env.NODE_ENV === 'development'

class Logger {
  private log(level: string, message: string, data?: any) {
    if (!isDevelopment && level === 'debug') {
      return // Don't log debug messages in production
    }

    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`

    switch (level) {
      case 'error':
        console.error(logMessage, data || '')
        break
      case 'warn':
        console.warn(logMessage, data || '')
        break
      case 'info':
        if (isDevelopment) {
          console.info(logMessage, data || '')
        }
        break
      case 'debug':
        if (isDevelopment) {
          console.debug(logMessage, data || '')
        }
        break
      default:
        if (isDevelopment) {
          console.log(logMessage, data || '')
        }
    }
  }

  error(message: string, data?: any) {
    this.log(LOG_LEVELS.ERROR, message, data)
  }

  warn(message: string, data?: any) {
    this.log(LOG_LEVELS.WARN, message, data)
  }

  info(message: string, data?: any) {
    this.log(LOG_LEVELS.INFO, message, data)
  }

  debug(message: string, data?: any) {
    this.log(LOG_LEVELS.DEBUG, message, data)
  }
}

export const logger = new Logger()
