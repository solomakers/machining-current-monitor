import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { execSync, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import type { SerialConfig } from '@mcm/config'
import type { Logger } from 'pino'

const RECONNECT_INTERVAL_MS = 5000

/**
 * USB 400J 仮想COMポートへの接続を管理する。
 * Linux では stty でシリアル設定後、cat コマンドの子プロセスで読み取る。
 * serialport ライブラリ不要。切断時は自動再接続する。
 */
export class ManagedSerialPort extends EventEmitter {
  private proc: ChildProcess | null = null
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
      this.logger.info({ port: devicePath, baudRate: this.config.baudRate }, 'Configuring serial port with stty')
      execSync(sttyCmd, { stdio: 'pipe' })
    } catch (err) {
      this.logger.error({ err }, 'Failed to configure serial port with stty')
      this.scheduleReconnect()
      return
    }

    // cat コマンドでデバイスファイルを読む
    try {
      this.proc = spawn('cat', [devicePath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const proc = this.proc

      proc.stdout?.on('data', (chunk: Buffer) => {
        this.emit('data', chunk)
      })

      proc.stderr?.on('data', (data: Buffer) => {
        this.logger.warn({ stderr: data.toString().trim() }, 'cat stderr')
      })

      proc.on('error', (err: Error) => {
        this.logger.error({ err: err.message }, 'cat process error')
        this.cleanup()
        this.scheduleReconnect()
      })

      proc.on('exit', (code, signal) => {
        this.logger.warn({ code, signal }, 'cat process exited')
        this.emit('close')
        this.cleanup()
        if (!this.closing) {
          this.scheduleReconnect()
        }
      })

      this.logger.info({ port: devicePath, baudRate: this.config.baudRate, pid: proc.pid }, 'Serial port opened (stty + cat)')
      this.emit('open')
    } catch (err) {
      this.logger.error({ err }, 'Failed to spawn cat process')
      this.scheduleReconnect()
    }
  }

  private cleanup(): void {
    if (this.proc) {
      try {
        this.proc.kill('SIGTERM')
      } catch {
        // ignore
      }
      this.proc = null
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
