import pino from 'pino'
import { loadSerialConfig, loadApiConfig } from '@mcm/config'
import type { IngestRequest } from '@mcm/domain'
import { ManagedSerialPort } from './serial/serial-port.js'
import { Esp3Parser, parseRadioErp1, parseRadioErp2 } from './enocean/esp3-parser.js'
import { decodeCwd3, decodeCwd3Erp2 } from './enocean/cwd3-decoder.js'
import { toTelemetry } from './transform/to-telemetry.js'
import { HttpSender } from './sender/http-sender.js'
import { Spool } from './spool/spool.js'
import { HealthTracker } from './health/health.js'

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })

async function main(): Promise<void> {
  logger.info('Starting receiver...')

  const serialConfig = loadSerialConfig()
  const apiConfig = loadApiConfig()

  const health = new HealthTracker(logger, serialConfig.port)
  const spool = new Spool(apiConfig.spoolDir, logger)
  const sender = new HttpSender(apiConfig, logger)
  const esp3Parser = new Esp3Parser()
  const serial = new ManagedSerialPort(serialConfig, logger)

  // テレメトリサンプルの送信処理（ERP1/ERP2共通）
  const handleDecoded = (decoded: ReturnType<typeof decodeCwd3>) => {
    if (!decoded) return

    health.recordReceived(decoded.deviceId, decoded.rssi)

    const sample = toTelemetry(decoded, apiConfig.gatewayId, new Date())
    logger.info(
      {
        deviceId: sample.deviceId,
        l1: sample.phaseL1CurrentA,
        l2: sample.phaseL2CurrentA,
        l3: sample.phaseL3CurrentA,
        rssi: decoded.rssi,
      },
      'Telemetry sample',
    )

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
  }

  // ESP3 パケット受信時の処理
  esp3Parser.on('packet', (packet) => {
    // ERP1 パケット
    const radioErp1 = parseRadioErp1(packet)
    if (radioErp1) {
      const decoded = decodeCwd3(radioErp1)
      if (!decoded) {
        logger.debug({ rorg: radioErp1.rorg, senderId: radioErp1.senderId }, 'Non-CWD3 ERP1 packet, skipping')
        return
      }
      handleDecoded(decoded)
      return
    }

    // ERP2 パケット
    const radioErp2 = parseRadioErp2(packet)
    if (radioErp2) {
      logger.info(
        { senderId: radioErp2.senderId, telegramType: radioErp2.telegramType, payloadHex: radioErp2.payload.toString('hex'), rssi: radioErp2.rssi },
        'ERP2 packet received',
      )
      const decoded = decodeCwd3Erp2(radioErp2)
      handleDecoded(decoded)
      return
    }

    logger.debug({ packetType: packet.packetType }, 'Unknown packet type, skipping')
  })

  esp3Parser.on('error', (err, detail) => {
    logger.warn({ err: err.message, ...detail }, 'ESP3 parse error')
    if (err.message.includes('CRC')) {
      health.recordCrcError()
    }
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

  // ヘルスチェックHTTPサーバー起動
  health.startHttpServer(3001)

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
