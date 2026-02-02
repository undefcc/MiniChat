/**
 * 日志管理工具
 * 根据环境和日志级别控制输出，避免生产环境过多磁盘 I/O
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class Logger {
  private level: LogLevel
  private enabledInProduction: boolean

  constructor() {
    // 生产环境默认只输出 WARN 和 ERROR
    this.level = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG
    
    // 可通过环境变量覆盖
    const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL
    if (envLevel) {
      this.level = LogLevel[envLevel as keyof typeof LogLevel] ?? this.level
    }

    // 生产环境是否启用日志（默认禁用 DEBUG 和 INFO）
    this.enabledInProduction = process.env.NEXT_PUBLIC_ENABLE_LOGS === 'true'
  }

  private shouldLog(level: LogLevel): boolean {
    // 检查日志级别
    if (level < this.level) {
      return false
    }

    // 生产环境额外检查
    if (process.env.NODE_ENV === 'production' && !this.enabledInProduction) {
      // 只允许 WARN 和 ERROR
      return level >= LogLevel.WARN
    }

    return true
  }

  private formatMessage(prefix: string, messages: any[]): any[] {
    return [prefix, ...messages]
  }

  debug(...messages: any[]) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(...this.formatMessage('🐛', messages))
    }
  }

  info(...messages: any[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(...this.formatMessage('ℹ️', messages))
    }
  }

  warn(...messages: any[]) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...this.formatMessage('⚠️', messages))
    }
  }

  error(...messages: any[]) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(...this.formatMessage('❌', messages))
    }
  }

  // 带标签的日志方法
  tagged(tag: string) {
    return {
      debug: (...messages: any[]) => this.debug(`[${tag}]`, ...messages),
      info: (...messages: any[]) => this.info(`[${tag}]`, ...messages),
      warn: (...messages: any[]) => this.warn(`[${tag}]`, ...messages),
      error: (...messages: any[]) => this.error(`[${tag}]`, ...messages),
    }
  }
}

// 单例导出
export const logger = new Logger()

// 便捷方法
export const createLogger = (tag: string) => logger.tagged(tag)
