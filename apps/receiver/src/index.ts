import pino from 'pino'
import { loadSerialConfig, loadApiConfig } from '@mcm/config'
import type { IngestRequest } from '@mcm/domain'
import { ManagedSerialPort } from './serial/serial-port.js'
import { Esp3Parser, parseRadioErp1 } from './enocean/esp3-parser.js'
import { decodeCwd3 } from './enocean/cwd3-decoder.js'
import { toTelemetry } from './transform/to-telemetry.js'
import { HttpSender } from './sender/http-sender.js'
import { Spool } from './spool/spool.js'
import { HealthTracker } from './health/health.js'

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })

async function main(): Promise<void> {
  logger.info('Starting receiver...')

  const serialConfig = loadSerialConfig()
  const apiConfig = loadApiConfig()

  const health = new HealthTracker(logger)
  const spool = new Spool(apiConfig.spoolDir, logger)
  const sender = new HttpSender(apiConfig, logger)
  const esp3Parser = new Esp3Parser()
  const serial = new ManagedSerialPort(serialConfig, logger)

  // ESP3 パケット受信時の処理
  esp3Parser.on('packet', (packet) => {
    const radio = parseRadioErp1(packet)
    if (!radio) return

    const decoded = decodeCwd3(radio)
    if (!decoded) {
      logger.debug({ rorg: radio.rorg, senderId: radio.senderId }, 'Non-CWD3 packet, skipping')
      return
    }

    health.recordReceived()

    const sample = toTelemetry(decoded, apiConfig.gatewayId, new Date())
    logger.info(
      {
        deviceId: sample.deviceId,
        l1: sample.phaseL1CurrentA,
        l2: sample.phaseL2CurrentA,
        l3: sample.phaseL3CurrentA,
      },
      'Telemetry sample',
    )

    // 即座に送信を試みる
    const request: IngestRequest = {
      gatewayId: apiConfig.gatewayId,
      sentAt: new Date().toISOString(),
      samples: [sample],
    }

    sender.send(request).then((result) => {
      if (result) {
        health.recordSendSuccess()
      } else {
        health.recordSendFail()
        spool.enqueue(sample)
      }
      health.updateSpoolDepth(spool.depth())
    })
  })

  esp3Parser.on('error', (err) => {
    logger.warn({ err: err.message }, 'ESP3 parse error')
  })

  // シリアルデータをパーサに流す
  serial.on('data', (chunk: Buffer) => {
    esp3Parser.push(chunk)
  })

  // スプール再送タイマー
  const RESEND_INTERVAL_MS = 30_000
  const RESEND_BATCH_SIZE = 50

  setInterval(async () => {
    const entries = spool.peek(RESEND_BATCH_SIZE)
    if (entries.length === 0) return

    logger.info({ count: entries.length }, 'Resending spooled entries')

    const request: IngestRequest = {
      gatewayId: apiConfig.gatewayId,
      sentAt: new Date().toISOString(),
      samples: entries,
    }

    const result = await sender.send(request)
    if (result?.results) {
      const successIds = result.results
        .filter((r) => r.status === 'inserted' || r.status === 'duplicated')
        .map((r) => r.eventId)
      spool.dequeue(successIds)
    }
    health.updateSpoolDepth(spool.depth())
  }, RESEND_INTERVAL_MS)

  // ヘルスチェック定期出力
  setInterval(() => {
    health.logStatus()
  }, apiConfig.heartbeatIntervalSec * 1000)

  // シリアルポートを開く
  await serial.open()

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...')
    await serial.close()
    spool.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  logger.info('Receiver started')
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error')
  process.exit(1)
})
