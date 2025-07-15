import { prisma } from './prisma';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum WhatsAppEventType {
  CONNECTION_ESTABLISHED = 'connection_established',
  CONNECTION_LOST = 'connection_lost',
  QR_CODE_GENERATED = 'qr_code_generated',
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_FAILED = 'message_failed',
  MESSAGE_QUEUED = 'message_queued',
  RATE_LIMIT_HIT = 'rate_limit_hit',
  SERVICE_RESTART = 'service_restart',
  SERVICE_ERROR = 'service_error'
}

export interface WhatsAppLogEntry {
  level: LogLevel;
  eventType: WhatsAppEventType;
  message: string;
  metadata?: Record<string, any>;
  error?: Error;
  userId?: string;
  phoneNumber?: string;
  messageId?: string;
}

export class WhatsAppLogger {
  private static instance: WhatsAppLogger;

  private constructor() {}

  static getInstance(): WhatsAppLogger {
    if (!WhatsAppLogger.instance) {
      WhatsAppLogger.instance = new WhatsAppLogger();
    }
    return WhatsAppLogger.instance;
  }

  /**
   * Log a WhatsApp event
   */
  async log(entry: WhatsAppLogEntry): Promise<void> {
    try {
      // Console logging with appropriate level
      this.logToConsole(entry);

      // Database logging
      await this.logToDatabase(entry);

      // Critical events should also create security events
      if (entry.level === LogLevel.CRITICAL || entry.level === LogLevel.ERROR) {
        await this.createSecurityEvent(entry);
      }

    } catch (error) {
      console.error('❌ Failed to log WhatsApp event:', error);
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: WhatsAppLogEntry): void {
    const timestamp = new Date().toISOString();
    const prefix = this.getLogPrefix(entry.level);
    const message = `${prefix} [${timestamp}] [WhatsApp] ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.metadata);
        break;
      case LogLevel.INFO:
        console.info(message, entry.metadata);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.metadata);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message, entry.error || entry.metadata);
        break;
    }
  }

  /**
   * Get log prefix based on level
   */
  private getLogPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍';
      case LogLevel.INFO:
        return 'ℹ️';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.ERROR:
        return '❌';
      case LogLevel.CRITICAL:
        return '🚨';
      default:
        return '📝';
    }
  }

  /**
   * Log to database
   */
  private async logToDatabase(entry: WhatsAppLogEntry): Promise<void> {
    try {
      await prisma.whatsAppLog.create({
        data: {
          level: entry.level,
          eventType: entry.eventType,
          message: entry.message,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          errorMessage: entry.error?.message,
          errorStack: entry.error?.stack,
          userId: entry.userId,
          phoneNumber: entry.phoneNumber,
          messageId: entry.messageId,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('❌ Failed to log to database:', error);
    }
  }

  /**
   * Create security event for critical issues
   */
  private async createSecurityEvent(entry: WhatsAppLogEntry): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          userId: entry.userId || 'system',
          eventType: `whatsapp_${entry.eventType}`,
          severity: entry.level === LogLevel.CRITICAL ? 'high' : 'medium',
          description: entry.message,
          metadata: JSON.stringify({
            eventType: entry.eventType,
            phoneNumber: entry.phoneNumber,
            messageId: entry.messageId,
            error: entry.error?.message,
            ...entry.metadata
          }),
          ipAddress: 'system',
          userAgent: 'WhatsApp Service'
        }
      });
    } catch (error) {
      console.error('❌ Failed to create security event:', error);
    }
  }

  /**
   * Log connection events
   */
  async logConnection(isConnected: boolean, phoneNumber?: string, metadata?: Record<string, any>): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      eventType: isConnected ? WhatsAppEventType.CONNECTION_ESTABLISHED : WhatsAppEventType.CONNECTION_LOST,
      message: isConnected 
        ? `WhatsApp connection established${phoneNumber ? ` for ${phoneNumber}` : ''}`
        : 'WhatsApp connection lost',
      phoneNumber,
      metadata
    });
  }

  /**
   * Log authentication events
   */
  async logAuthentication(success: boolean, phoneNumber?: string, error?: Error): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      eventType: success ? WhatsAppEventType.AUTHENTICATION_SUCCESS : WhatsAppEventType.AUTHENTICATION_FAILURE,
      message: success 
        ? `WhatsApp authentication successful${phoneNumber ? ` for ${phoneNumber}` : ''}`
        : 'WhatsApp authentication failed',
      phoneNumber,
      error
    });
  }

  /**
   * Log QR code generation
   */
  async logQRCode(qrCode: string): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      eventType: WhatsAppEventType.QR_CODE_GENERATED,
      message: 'WhatsApp QR code generated',
      metadata: { qrCodeLength: qrCode.length }
    });
  }

  /**
   * Log message events
   */
  async logMessage(
    success: boolean, 
    phoneNumber: string, 
    messageId?: string, 
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      eventType: success ? WhatsAppEventType.MESSAGE_SENT : WhatsAppEventType.MESSAGE_FAILED,
      message: success 
        ? `Message sent successfully to ${phoneNumber}`
        : `Failed to send message to ${phoneNumber}: ${error}`,
      phoneNumber,
      messageId,
      error: error ? new Error(error) : undefined,
      metadata
    });
  }

  /**
   * Log rate limiting events
   */
  async logRateLimit(phoneNumber: string, remainingTime: number): Promise<void> {
    await this.log({
      level: LogLevel.WARN,
      eventType: WhatsAppEventType.RATE_LIMIT_HIT,
      message: `Rate limit hit for ${phoneNumber}, ${Math.ceil(remainingTime / 1000)}s remaining`,
      phoneNumber,
      metadata: { remainingTimeMs: remainingTime }
    });
  }

  /**
   * Log service events
   */
  async logServiceEvent(eventType: 'restart' | 'error', message: string, error?: Error): Promise<void> {
    await this.log({
      level: eventType === 'error' ? LogLevel.ERROR : LogLevel.INFO,
      eventType: eventType === 'restart' ? WhatsAppEventType.SERVICE_RESTART : WhatsAppEventType.SERVICE_ERROR,
      message,
      error
    });
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(limit: number = 100, level?: LogLevel): Promise<any[]> {
    try {
      const whereClause = level ? { level } : {};
      
      return await prisma.whatsAppLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          id: true,
          level: true,
          eventType: true,
          message: true,
          metadata: true,
          errorMessage: true,
          phoneNumber: true,
          messageId: true,
          timestamp: true
        }
      });
    } catch (error) {
      console.error('❌ Failed to get recent logs:', error);
      return [];
    }
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(hours: number = 24): Promise<{
    total: number;
    byLevel: Record<LogLevel, number>;
    byEventType: Record<string, number>;
    errorRate: number;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const logs = await prisma.whatsAppLog.findMany({
        where: {
          timestamp: { gte: since }
        },
        select: {
          level: true,
          eventType: true
        }
      });

      const total = logs.length;
      const byLevel: Record<LogLevel, number> = {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.ERROR]: 0,
        [LogLevel.CRITICAL]: 0
      };
      const byEventType: Record<string, number> = {};

      logs.forEach(log => {
        byLevel[log.level as LogLevel]++;
        byEventType[log.eventType] = (byEventType[log.eventType] || 0) + 1;
      });

      const errorCount = byLevel[LogLevel.ERROR] + byLevel[LogLevel.CRITICAL];
      const errorRate = total > 0 ? (errorCount / total) * 100 : 0;

      return {
        total,
        byLevel,
        byEventType,
        errorRate
      };
    } catch (error) {
      console.error('❌ Failed to get log statistics:', error);
      return {
        total: 0,
        byLevel: {
          [LogLevel.DEBUG]: 0,
          [LogLevel.INFO]: 0,
          [LogLevel.WARN]: 0,
          [LogLevel.ERROR]: 0,
          [LogLevel.CRITICAL]: 0
        },
        byEventType: {},
        errorRate: 0
      };
    }
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.whatsAppLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      });

      console.log(`🧹 Cleaned up ${result.count} old WhatsApp logs`);
      return result.count;
    } catch (error) {
      console.error('❌ Failed to cleanup old logs:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const whatsAppLogger = WhatsAppLogger.getInstance();
