import type { Logger } from 'pino'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'

/** ヘルスチェック状態指標 */
export interface HealthStatus {
  processUptime: number
  lastReceivedAt: string | null
  lastSentSuccessAt: string | null
  lastRssi: number | null
  lastDeviceId: string | null
  spoolDepth: number
  recentReceivedCount: number
  recentSendFailCount: number
  recentCrcErrorCount: number
  usbDeviceFound: boolean
}

/**
 * 受信プロセスの健全性を追跡するトラッカー
 */
export class HealthTracker {
  private lastReceivedAt: Date | null = null
  private lastSentSuccessAt: Date | null = null
  private lastRssi: number | null = null
  private lastDeviceId: string | null = null
  private spoolDepth = 0
  private recentReceived: Date[] = []
  private recentSendFails: Date[] = []
  private recentCrcErrors: Date[] = []
  private readonly windowMs = 5 * 60 * 1000 // 5分
  private usbDevicePath: string

  constructor(
    private readonly logger: Logger,
    usbDevicePath?: string,
  ) {
    this.usbDevicePath = usbDevicePath ?? '/dev/enocean-usb400j'
  }

  recordReceived(deviceId?: string, rssi?: number): void {
    this.lastReceivedAt = new Date()
    this.recentReceived.push(this.lastReceivedAt)
    if (deviceId) this.lastDeviceId = deviceId
    if (rssi != null) this.lastRssi = rssi
  }

  recordSendSuccess(): void {
    this.lastSentSuccessAt = new Date()
  }

  recordSendFail(): void {
    this.recentSendFails.push(new Date())
  }

  recordCrcError(): void {
    this.recentCrcErrors.push(new Date())
  }

  updateSpoolDepth(depth: number): void {
    this.spoolDepth = depth
  }

  getStatus(): HealthStatus {
    const now = Date.now()
    const cutoff = now - this.windowMs

    this.recentReceived = this.recentReceived.filter((d) => d.getTime() > cutoff)
    this.recentSendFails = this.recentSendFails.filter((d) => d.getTime() > cutoff)
    this.recentCrcErrors = this.recentCrcErrors.filter((d) => d.getTime() > cutoff)

    return {
      processUptime: process.uptime(),
      lastReceivedAt: this.lastReceivedAt?.toISOString() ?? null,
      lastSentSuccessAt: this.lastSentSuccessAt?.toISOString() ?? null,
      lastRssi: this.lastRssi,
      lastDeviceId: this.lastDeviceId,
      spoolDepth: this.spoolDepth,
      recentReceivedCount: this.recentReceived.length,
      recentSendFailCount: this.recentSendFails.length,
      recentCrcErrorCount: this.recentCrcErrors.length,
      usbDeviceFound: existsSync(this.usbDevicePath),
    }
  }

  logStatus(): void {
    this.logger.info(this.getStatus(), 'Health status')
  }

  /** HTTPヘルスチェックサーバーを起動 (ポート3001) */
  startHttpServer(port = 3001): void {
    const server = createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        const status = this.getStatus()
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        })
        res.end(JSON.stringify(status, null, 2))
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    server.listen(port, () => {
      this.logger.info({ port }, 'Health HTTP server started')
    })
  }
}
