/**
 * Email Logger Utility
 * Provides consistent logging format for all email operations
 */

export interface EmailLogEntry {
  service: string;
  action: string;
  status: 'started' | 'success' | 'failed' | 'warning';
  recipients?: string | string[];
  subject?: string;
  messageId?: string;
  meetingId?: string;
  meetingTitle?: string;
  stakeAmount?: number;
  duration?: string;
  error?: {
    message: string;
    name?: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
  timestamp: string;
}

export class EmailLogger {
  private static formatLog(entry: EmailLogEntry): string {
    const statusIcon = {
      started: '🚀',
      success: '✅',
      failed: '❌',
      warning: '⚠️'
    }[entry.status];

    const prefix = `[${entry.service}] ${statusIcon} ${entry.action}`;
    return prefix;
  }

  static logStart(service: string, action: string, metadata?: Record<string, any>): void {
    const entry: EmailLogEntry = {
      service,
      action,
      status: 'started',
      metadata,
      timestamp: new Date().toISOString()
    };
    console.log(this.formatLog(entry), entry);
  }

  static logSuccess(
    service: string,
    action: string,
    data: {
      recipients?: string | string[];
      subject?: string;
      messageId?: string;
      meetingId?: string;
      meetingTitle?: string;
      stakeAmount?: number;
      duration?: number;
      metadata?: Record<string, any>;
    }
  ): void {
    const entry: EmailLogEntry = {
      service,
      action,
      status: 'success',
      ...data,
      duration: data.duration ? `${data.duration}ms` : undefined,
      timestamp: new Date().toISOString()
    };
    console.log(this.formatLog(entry), entry);
  }

  static logError(
    service: string,
    action: string,
    error: unknown,
    data?: {
      recipients?: string | string[];
      subject?: string;
      meetingId?: string;
      meetingTitle?: string;
      duration?: number;
      metadata?: Record<string, any>;
    }
  ): void {
    const errorDetails = error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        }
      : { message: String(error) };

    const entry: EmailLogEntry = {
      service,
      action,
      status: 'failed',
      ...data,
      duration: data?.duration ? `${data.duration}ms` : undefined,
      error: errorDetails,
      timestamp: new Date().toISOString()
    };
    console.error(this.formatLog(entry), entry);
  }

  static logWarning(
    service: string,
    action: string,
    message: string,
    metadata?: Record<string, any>
  ): void {
    const entry: EmailLogEntry = {
      service,
      action,
      status: 'warning',
      error: { message },
      metadata,
      timestamp: new Date().toISOString()
    };
    console.warn(this.formatLog(entry), entry);
  }

  /**
   * Create a batch email summary log
   */
  static logBatchSummary(
    service: string,
    results: Array<{ email: string; success: boolean; error?: string }>
  ): void {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`[${service}] 📊 Batch Email Summary`, {
      totalAttempted: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: `${((successful.length / results.length) * 100).toFixed(1)}%`,
      successfulEmails: successful.map(r => r.email),
      failedEmails: failed.map(r => ({ email: r.email, error: r.error })),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Format email list for logging (truncate if too many)
   */
  static formatRecipients(recipients: string | string[]): string {
    const list = Array.isArray(recipients) ? recipients : [recipients];
    if (list.length <= 3) {
      return list.join(', ');
    }
    return `${list.slice(0, 3).join(', ')} and ${list.length - 3} others`;
  }
}