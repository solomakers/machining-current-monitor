import { EventEmitter } from 'node:events'
import {
  ESP3_SYNC_BYTE,
  PacketType,
  crc8,
  type Esp3Packet,
  type RadioErp1,
  type RadioErp2,
} from './esp3-types.js'

/**
 * ESP3 フレームパーサ
 *
 * ストリームデータからESP3パケットを切り出す。
 * CRCエラー時はパケットを破棄し 'error' イベントを発火する。
 */
export class Esp3Parser extends EventEmitter {
  private buffer = Buffer.alloc(0)

  /** バイト列を流し込む */
  push(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    this.parse()
  }

  private parse(): void {
    while (this.buffer.length > 0) {
      // Sync byte を探す
      const syncIndex = this.buffer.indexOf(ESP3_SYNC_BYTE)
      if (syncIndex < 0) {
        this.buffer = Buffer.alloc(0)
        return
      }
      if (syncIndex > 0) {
        this.buffer = this.buffer.subarray(syncIndex)
      }

      // ヘッダ (6 bytes: sync + dataLen(2) + optLen(1) + packetType(1) + headerCRC(1))
      if (this.buffer.length < 6) return

      const dataLength = this.buffer.readUInt16BE(1)
      const optionalLength = this.buffer[3]
      const packetType = this.buffer[4]
      const headerCrc = this.buffer[5]

      // ヘッダ CRC 検証
      const headerBytes = this.buffer.subarray(1, 5)
      if (crc8(headerBytes) !== headerCrc) {
        const rawHex = this.buffer.subarray(0, Math.min(this.buffer.length, 32)).toString('hex')
        this.emit('error', new Error('ESP3 header CRC mismatch'), { rawHex, dataLength, optionalLength, packetType })
        this.buffer = this.buffer.subarray(1) // sync byte をスキップして再探索
        continue
      }

      // フル パケット長
      const totalLength = 6 + dataLength + optionalLength + 1 // +1 for data CRC
      if (this.buffer.length < totalLength) return

      const dataStart = 6
      const dataEnd = dataStart + dataLength
      const optEnd = dataEnd + optionalLength
      const dataCrc = this.buffer[optEnd]

      // データ CRC 検証
      const dataBlock = this.buffer.subarray(dataStart, optEnd)
      if (crc8(dataBlock) !== dataCrc) {
        const rawHex = this.buffer.subarray(0, totalLength).toString('hex')
        const dataHex = this.buffer.subarray(dataStart, dataEnd).toString('hex')
        this.emit('error', new Error('ESP3 data CRC mismatch'), { rawHex, dataHex, dataLength, optionalLength, packetType, expectedCrc: crc8(dataBlock), actualCrc: dataCrc })
        this.buffer = this.buffer.subarray(1)
        continue
      }

      const packet: Esp3Packet = {
        dataLength,
        optionalLength,
        packetType,
        data: Buffer.from(this.buffer.subarray(dataStart, dataEnd)),
        optionalData: Buffer.from(this.buffer.subarray(dataEnd, optEnd)),
      }

      this.buffer = this.buffer.subarray(totalLength)
      this.emit('packet', packet)
    }
  }
}

/**
 * ESP3 Radio ERP1 パケットからフィールドを抽出する
 */
export function parseRadioErp1(packet: Esp3Packet): RadioErp1 | null {
  if (packet.packetType !== PacketType.RADIO_ERP1) return null
  if (packet.data.length < 7) return null

  const rorg = packet.data[0]
  // data: RORG(1) + payload(N) + senderId(4) + status(1)
  const payloadLength = packet.dataLength - 6 // 1 (rorg) + 4 (senderId) + 1 (status)
  const payload = packet.data.subarray(1, 1 + payloadLength)
  const senderIdOffset = 1 + payloadLength
  const senderId = packet.data
    .subarray(senderIdOffset, senderIdOffset + 4)
    .toString('hex')
    .toUpperCase()
    .match(/.{2}/g)!
    .join('-')
  const status = packet.data[senderIdOffset + 4]

  // Optional data: SubTelNum(1) + destinationId(4) + dBm(1) + securityLevel(1)
  let rssi = 0
  let repeaterCount = 0
  if (packet.optionalData.length >= 7) {
    repeaterCount = packet.optionalData[0]
    rssi = -packet.optionalData[5] // dBm は負値
  }

  return { rorg, senderId, payload: Buffer.from(payload), status, rssi, repeaterCount }
}

/**
 * ESP3 Radio ERP2 パケットからフィールドを抽出する
 *
 * ERP2 ヘッダバイト:
 *   bits 7-5: Address Control (送信元IDの長さ)
 *   bit 4:    Extended Header の有無
 *   bits 3-0: Telegram Type (0xF = 拡張型、次バイトに実際の型)
 */
export function parseRadioErp2(packet: Esp3Packet): RadioErp2 | null {
  if (packet.packetType !== PacketType.RADIO_ERP2) return null
  if (packet.data.length < 3) return null

  const header = packet.data[0]
  const addressControl = (header >> 5) & 0x07
  const hasExtHeader = ((header >> 4) & 0x01) === 1
  const telegramType = header & 0x0f

  let offset = 1

  // Extended Header (存在する場合スキップ)
  if (hasExtHeader) {
    offset += 1
  }

  // Telegram Type が 0xF の場合、次バイトに拡張型
  let actualTelegramType = telegramType
  if (telegramType === 0x0f) {
    actualTelegramType = packet.data[offset]
    offset += 1
  }

  // Address Control に基づく送信元IDの長さ
  let originatorIdLength: number
  switch (addressControl) {
    case 0: originatorIdLength = 3; break // 24-bit
    case 1: originatorIdLength = 4; break // 32-bit
    case 2: originatorIdLength = 4; break // 32-bit (+ destination)
    case 3: originatorIdLength = 6; break // 48-bit
    default: return null
  }

  if (packet.data.length < offset + originatorIdLength) return null

  const senderId = packet.data
    .subarray(offset, offset + originatorIdLength)
    .toString('hex')
    .toUpperCase()
    .match(/.{2}/g)!
    .join('-')
  offset += originatorIdLength

  // Address Control 2 の場合、Destination ID (4バイト) をスキップ
  if (addressControl === 2) {
    offset += 4
  }

  // 残りがペイロード
  const payload = Buffer.from(packet.data.subarray(offset))

  // ERP2 Optional data: SubTelNum(1) + dBm(1)
  let rssi = 0
  let subTelNum = 0
  if (packet.optionalData.length >= 2) {
    subTelNum = packet.optionalData[0]
    rssi = -packet.optionalData[1]
  }

  return { telegramType: actualTelegramType, senderId, payload, rssi, subTelNum }
}
