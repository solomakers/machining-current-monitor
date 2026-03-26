/** ESP3 パケットタイプ */
export const ESP3_SYNC_BYTE = 0x55

export const PacketType = {
  RADIO_ERP1: 0x01,
  RESPONSE: 0x02,
  RADIO_SUB_TEL: 0x03,
  EVENT: 0x04,
  COMMON_COMMAND: 0x05,
  SMART_ACK_COMMAND: 0x06,
  REMOTE_MAN_COMMAND: 0x07,
  RADIO_MESSAGE: 0x09,
  RADIO_ERP2: 0x0a,
} as const

export type PacketType = (typeof PacketType)[keyof typeof PacketType]

/** ESP3 パケット構造 */
export interface Esp3Packet {
  dataLength: number
  optionalLength: number
  packetType: number
  data: Buffer
  optionalData: Buffer
}

/** Radio ERP1 パケットの解析結果 */
export interface RadioErp1 {
  rorg: number
  senderId: string
  payload: Buffer
  status: number
  rssi: number
  repeaterCount: number
}

/** Radio ERP2 パケットの解析結果 */
export interface RadioErp2 {
  telegramType: number
  senderId: string
  payload: Buffer
  rssi: number
  subTelNum: number
}

/** CRC8 テーブル (ITU-T) */
const CRC8_TABLE = new Uint8Array(256)
;(() => {
  for (let i = 0; i < 256; i++) {
    let crc = i
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x80 ? (crc << 1) ^ 0x07 : crc << 1
    }
    CRC8_TABLE[i] = crc & 0xff
  }
})()

export function crc8(data: Uint8Array): number {
  let crc = 0
  for (const byte of data) {
    crc = CRC8_TABLE[(crc ^ byte) & 0xff]
  }
  return crc
}
