import { EventEmitter } from 'node:events'
import type { SerialConfig } from '@mcm/config'
import type { Logger } from 'pino'

const RECONNECT_INTERVAL_MS = 5000

// serialport の型定義 (動的 import 用)
interface SerialPortLike {
  on(event: string, cb: (...args: unknown[]) => void): void
  open(cb: (err: Error | null) => void): void
  close(cb: () => void): void
  isOpen: boolean
}

interface SerialPortStatic {
  new (options: Record<string, unknown>): SerialPortLike
  list(): Promise<{ path: string }[]>
}

/**
 * USB 400J 仮想COMポートへの接続を管理する。
 * serialport パッケージは動的にロードし、未インストール時はエラーをログ出力する。
 * 切断時は自動再接続する。
 */
export class ManagedSerialPort extends EventEmitter {
  private port: SerialPortLike | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private closing = false
  private SerialPortClass: SerialPortStatic | null = null

  constructor(
    private readonly config: SerialConfig,
    private readonly logger: Logger,
  ) {
    super()
  }

  async open(): Promise<void> {
    try {
      // TypeScript の静的解析を回避するため文字列変数経由で動的 import
      const moduleName = 'serialport'
      const mod = await import(/* webpackIgnore: true */ moduleName)
      this.SerialPortClass = mod.SerialPort as unknown as SerialPortStatic
    } catch {
      this.logger.error(
        'serialport パッケージが見つかりません。Raspberry Pi にデプロイ時にインストールしてください。',
      )
      return
    }

    const ports = await this.SerialPortClass.list()
    this.logger.info(
      { availablePorts: ports.map((p: { path: string }) => p.path) },
      'Available serial ports',
    )

    this.connect()
  }

  private connect(): void {
    if (this.closing || !this.SerialPortClass) return

    this.logger.info(
      { port: this.config.port, baudRate: this.config.baudRate },
      'Opening serial port',
    )

    this.port = new this.SerialPortClass({
      path: this.config.port,
      baudRate: this.config.baudRate,
      dataBits: this.config.dataBits,
      stopBits: this.config.stopBits,
      parity: this.config.parity,
      autoOpen: false,
    })

    this.port.on('open', () => {
      this.logger.info('Serial port opened')
      this.emit('open')
    })

    this.port.on('data', (chunk: unknown) => {
      this.emit('data', chunk)
    })

    this.port.on('error', (err: unknown) => {
      this.logger.error({ err }, 'Serial port error')
      this.emit('error', err)
      this.scheduleReconnect()
    })

    this.port.on('close', () => {
      this.logger.warn('Serial port closed')
      this.emit('close')
      if (!this.closing) {
        this.scheduleReconnect()
      }
    })

    this.port.open((err: Error | null) => {
      if (err) {
        this.logger.error({ err }, 'Failed to open serial port')
        this.scheduleReconnect()
      }
    })
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
    return new Promise<void>((resolve) => {
      if (this.port?.isOpen) {
        this.port.close(() => resolve())
      } else {
        resolve()
      }
    })
  }
}
