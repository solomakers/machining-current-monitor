import { createHash } from 'node:crypto'

/**
 * eventId を生成する。
 * sha256(deviceId + observedAt + rawPayloadHex) の先頭32文字。
 */
export function generateEventId(
  deviceId: string,
  observedAt: string,
  rawPayloadHex: string,
): string {
  const input = `${deviceId}${observedAt}${rawPayloadHex}`
  return createHash('sha256').update(input).digest('hex').slice(0, 32)
}
