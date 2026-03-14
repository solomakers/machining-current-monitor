import { generateEventId, type TelemetrySample } from '@mcm/domain'
import type { Cwd3DecodedData } from '../enocean/cwd3-decoder.js'

const PARSER_VERSION = '1.0.0'

/**
 * CWD-3-1 デコード結果を TelemetrySample に正規化する
 */
export function toTelemetry(
  decoded: Cwd3DecodedData,
  gatewayId: string,
  observedAt: Date,
): TelemetrySample & { eventId: string } {
  const observedAtIso = observedAt.toISOString()
  const receivedAtIso = new Date().toISOString()

  const eventId = generateEventId(decoded.deviceId, observedAtIso, decoded.rawPayloadHex)

  return {
    eventId,
    gatewayId,
    deviceId: decoded.deviceId,
    observedAt: observedAtIso,
    receivedAt: receivedAtIso,
    phaseL1CurrentA: decoded.phaseL1CurrentA,
    phaseL2CurrentA: decoded.phaseL2CurrentA,
    phaseL3CurrentA: decoded.phaseL3CurrentA,
    rawPayloadHex: decoded.rawPayloadHex,
    rssi: decoded.rssi,
    repeaterCount: decoded.repeaterCount,
    parserVersion: PARSER_VERSION,
    source: 'enocean-usb400j',
  }
}
