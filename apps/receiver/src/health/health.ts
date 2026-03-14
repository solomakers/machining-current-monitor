import type { Logger } from 'pino'

/** ヘルスチェック状態指標 */
export interface HealthStatus {
  processUptime: number
  lastReceivedAt: string | null
  lastSentSuccessAt: string | null
  spoolDepth: number
  recentReceivedCount: number
  recentSendFailCount: number
}

/**
 * 受信プロセスの健全性を追跡するトラッカー
 */
export class HealthTracker {
  private lastReceivedAt: Date | null = null
  private lastSentSuccessAt: Date | null = null
  private spoolDepth = 0
  private recentReceived: Date[] = []
  private recentSendFails: Date[] = []
  private readonly windowMs = 5 * 60 * 1000 // 5分

  constructor(private readonly logger: Logger) {}

  recordReceived(): void {
    this.lastReceivedAt = new Date()
    this.recentReceived.push(this.lastReceivedAt)
  }

  recordSendSuccess(): void {
    this.lastSentSuccessAt = new Date()
  }

  recordSendFail(): void {
    this.recentSendFails.push(new Date())
  }

  updateSpoolDepth(depth: number): void {
    this.spoolDepth = depth
  }

  getStatus(): HealthStatus {
    const now = Date.now()
    const cutoff = now - this.windowMs

    // 古いエントリを削除
    this.recentReceived = this.recentReceived.filter((d) => d.getTime() > cutoff)
    this.recentSendFails = this.recentSendFails.filter((d) => d.getTime() > cutoff)

    return {
      processUptime: process.uptime(),
      lastReceivedAt: this.lastReceivedAt?.toISOString() ?? null,
      lastSentSuccessAt: this.lastSentSuccessAt?.toISOString() ?? null,
      spoolDepth: this.spoolDepth,
      recentReceivedCount: this.recentReceived.length,
      recentSendFailCount: this.recentSendFails.length,
    }
  }

  logStatus(): void {
    this.logger.info(this.getStatus(), 'Health status')
  }
}
