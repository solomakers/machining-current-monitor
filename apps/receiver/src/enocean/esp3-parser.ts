import { EventEmitter } from 'node:events'
import {
  ESP3_SYNC_BYTE,
  PacketType,
  crc8,
  type Esp3Packet,
  type RadioErp1,
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
        this.emit('error', new Error('ESP3 header CRC mismatch'))
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
        this.emit('error', new Error('ESP3 data CRC mismatch'))
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
