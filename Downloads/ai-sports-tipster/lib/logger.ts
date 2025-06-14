type LogLevel = "info" | "warn" | "error" | "debug"

type LogOptions = {
  tags?: string[]
  data?: Record<string, any>
  error?: Error
}

class Logger {
  private isDev = process.env.NODE_ENV !== "production"

  log(level: LogLevel, message: string, options: LogOptions = {}) {
    // In production, only log warnings and errors
    if (!this.isDev && level !== "warn" && level !== "error") {
      return
    }

    const { tags = [], data = {}, error } = options
    const timestamp = new Date().toISOString()
    const tagString = tags.length ? `[${tags.join(", ")}]` : ""

    // Format the log message
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message} ${tagString}`

    // Log to console with appropriate level
    switch (level) {
      case "info":
        console.info(logMessage, data)
        break
      case "warn":
        console.warn(logMessage, data)
        break
      case "error":
        console.error(logMessage, error || data)
        break
      case "debug":
        if (this.isDev) {
          console.debug(logMessage, data)
        }
        break
    }
  }

  info(message: string, options?: LogOptions) {
    this.log("info", message, options)
  }

  warn(message: string, options?: LogOptions) {
    this.log("warn", message, options)
  }

  error(message: string, options?: LogOptions) {
    this.log("error", message, options)
  }

  debug(message: string, options?: LogOptions) {
    this.log("debug", message, options)
  }
}

export const logger = new Logger()
