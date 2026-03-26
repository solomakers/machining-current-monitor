import type { RadioErp1, RadioErp2 } from './esp3-types.js'

/** CWD-3-1 の EEP RORG (VLD: D2) */
const RORG_VLD = 0xd2

/** CT レンジ (φ10-24mm) の最大値 (A) */
const CT_RANGE_PHI10_24 = 400
/** 12ビット最大値 */
const RAW_MAX = 4095
/** 未接続チャンネルの値 */
const NO_DATA_VALUE = 0xfff

/** CWD-3-1 デコード結果 */
export interface Cwd3DecodedData {
  deviceId: string
  /** L1相 電流 (A) - null はデータなし */
  phaseL1CurrentA: number | null
  /** L2相 電流 (A) */
  phaseL2CurrentA: number | null
  /** L3相 電流 (A) */
  phaseL3CurrentA: number | null
  rawPayloadHex: string
  rssi: number
  repeaterCount: number
}

/**
 * 12ビット生値を電流値 (A) に変換する
 * φ10-24 CT: raw × 400 / 4095
 */
function rawToCurrent(raw12bit: number): number | null {
  if (raw12bit === NO_DATA_VALUE || raw12bit < 0) return null
  return Math.round((raw12bit * CT_RANGE_PHI10_24 / RAW_MAX) * 100) / 100
}

/**
 * CWD-3-1 ERP1 ペイロードをデコードする (従来形式)
 */
export function decodeCwd3(radio: RadioErp1): Cwd3DecodedData | null {
  if (radio.rorg !== RORG_VLD) return null

  const payload = radio.payload
  const rawPayloadHex = payload.toString('hex')

  let phaseL1CurrentA: number | null = null
  let phaseL2CurrentA: number | null = null
  let phaseL3CurrentA: number | null = null

  if (payload.length >= 6) {
    const rawL1 = payload.readUInt16BE(0)
    const rawL2 = payload.readUInt16BE(2)
    const rawL3 = payload.readUInt16BE(4)

    phaseL1CurrentA = rawL1 !== 0xffff ? rawL1 / 10 : null
    phaseL2CurrentA = rawL2 !== 0xffff ? rawL2 / 10 : null
    phaseL3CurrentA = rawL3 !== 0xffff ? rawL3 / 10 : null
  }

  return {
    deviceId: radio.senderId,
    phaseL1CurrentA,
    phaseL2CurrentA,
    phaseL3CurrentA,
    rawPayloadHex,
    rssi: radio.rssi,
    repeaterCount: radio.repeaterCount,
  }
}

/**
 * CWD-3-1 ERP2 ペイロードをデコードする
 *
 * 6バイトペイロード (telegramType=7): パックド12ビット形式
 *   4.5バイト (36ビット) = 3チャンネル × 12ビット + 残りはステータス/CRC
 *   ch1: bits[0:11], ch2: bits[12:23], ch3: bits[24:35]
 *   変換: raw × 400 / 4095 (φ10-24 CT)
 *   0xFFF = 未接続チャンネル
 *
 * 18バイトペイロード (telegramType=5): 5バイト/チャンネル形式
 *   [cmd 2B] + [5B × 3ch] + [trailing 1B]
 *   各チャンネル先頭12ビットが生値
 */
export function decodeCwd3Erp2(radio: RadioErp2): Cwd3DecodedData | null {
  const payload = radio.payload
  const rawPayloadHex = payload.toString('hex')

  let phaseL1CurrentA: number | null = null
  let phaseL2CurrentA: number | null = null
  let phaseL3CurrentA: number | null = null

  if (payload.length === 6) {
    // telegramType=7: パックド12ビット形式 (6バイト)
    // byte0[7:0] + byte1[7:4] = ch1 (12bit)
    // byte1[3:0] + byte2[7:0] = ch2 (12bit)
    // byte3[7:0] + byte4[7:4] = ch3 (12bit)
    const rawCh1 = (payload[0] << 4) | (payload[1] >> 4)
    const rawCh2 = ((payload[1] & 0x0f) << 8) | payload[2]
    const rawCh3 = (payload[3] << 4) | (payload[4] >> 4)

    phaseL1CurrentA = rawToCurrent(rawCh1)
    phaseL2CurrentA = rawToCurrent(rawCh2)
    phaseL3CurrentA = rawToCurrent(rawCh3)
  }

  return {
    deviceId: radio.senderId,
    phaseL1CurrentA,
    phaseL2CurrentA,
    phaseL3CurrentA,
    rawPayloadHex,
    rssi: radio.rssi,
    repeaterCount: 0,
  }
}
