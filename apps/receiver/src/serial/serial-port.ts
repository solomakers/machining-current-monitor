import { EventEmitter } from 'node:events'
import { createReadStream, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import type { ReadStream } from 'node:fs'
import type { SerialConfig } from '@mcm/config'
import type { Logger } from 'pino'

const RECONNECT_INTERVAL_MS = 5000

/**
 * USB 400J 仮想COMポートへの接続を管理する。
 * Linux では stty + fs.createReadStream で直接デバイスファイルを読む。
 * serialport ライブラリ不要。切断時は自動再接続する。
 */
export class ManagedSerialPort extends EventEmitter {
  private stream: ReadStream | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private closing = false

  constructor(
    private readonly config: SerialConfig,
    private readonly logger: Logger,
  ) {
    super()
  }

  async open(): Promise<void> {
    this.connect()
  }

  private connect(): void {
    if (this.closing) return

    const devicePath = this.config.port

    // デバイスファイルの存在確認
    if (!existsSync(devicePath)) {
      this.logger.warn({ port: devicePath }, 'Serial device not found, retrying...')
      this.scheduleReconnect()
      return
    }

    // stty でシリアルポートを設定
    try {
      const sttyCmd = `stty -F ${devicePath} ${this.config.baudRate} raw -echo -echoe -echok -echoctl -echoke cs${this.config.dataBits} -cstopb -parenb -crtscts -ixon -ixoff -hupcl cread clocal`
      this.logger.info({ port: devicePath, baudRate: this.config.baudRate, cmd: sttyCmd }, 'Configuring serial port with stty')
      execSync(sttyCmd, { stdio: 'pipe' })
    } catch (err) {
      this.logger.error({ err }, 'Failed to configure serial port with stty')
      this.scheduleReconnect()
      return
    }

    // createReadStream でデバイスファイルを読む
    try {
      this.stream = createReadStream(devicePath, {
        highWaterMark: 1024,
      })

      this.stream.on('data', (chunk: string | Buffer) => {
        this.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })

      this.stream.on('error', (err: Error) => {
        this.logger.error({ err: err.message }, 'Serial stream error')
        this.cleanup()
        this.scheduleReconnect()
      })

      this.stream.on('close', () => {
        this.logger.warn('Serial stream closed')
        this.emit('close')
        if (!this.closing) {
          this.cleanup()
          this.scheduleReconnect()
        }
      })

      this.logger.info({ port: devicePath, baudRate: this.config.baudRate }, 'Serial port opened (stty + ReadStream)')
      this.emit('open')
    } catch (err) {
      this.logger.error({ err }, 'Failed to open serial stream')
      this.scheduleReconnect()
    }
  }

  private cleanup(): void {
    if (this.stream) {
      try {
        this.stream.destroy()
      } catch {
        // ignore
      }
      this.stream = null
    }
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) return

    this.logger.info(
      { intervalMs: RECONNECT_INTERVAL_MS },
      'Scheduling serial port reconnection',
    )

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, RECONNECT_INTERVAL_MS)
  }

  async close(): Promise<void> {
    this.closing = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.cleanup()
  }
}
