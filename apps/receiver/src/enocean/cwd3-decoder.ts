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
 * ビットストリームから指定オフセットの12ビット値を抽出する
 */
function extract12bits(payload: Buffer, bitOffset: number): number {
  const byteOffset = Math.floor(bitOffset / 8)
  const bitShift = bitOffset % 8

  // 3バイトにまたがる可能性があるため、3バイト読んで12ビットを抽出
  const raw24 =
    (payload[byteOffset] << 16) |
    (payload[byteOffset + 1] << 8) |
    (payload[byteOffset + 2] ?? 0)

  return (raw24 >> (24 - bitShift - 12)) & 0xfff
}

/**
 * CWD-3-1 ERP2 ペイロードをデコードする
 *
 * EnOcean GP (Generic Profiles) Complete Data 形式:
 *   telegramType=5 (GP_CD), 18バイトペイロード
 *   CWD-3-1 は各チャンネルデータをビットストリームとして連結送信する。
 *
 *   ペイロード構造 (144ビット):
 *     bits  0-15:  ヘッダ (CTタイプ/ステータス情報)
 *     bits 16-17:  CT1フラグ (2bit)
 *     bits 18-29:  CT1電流値 (12bit) ← raw × 400 / 4095
 *     bits 30-55:  CT1メタデータ (26bit)
 *     bits 56-57:  CT2フラグ (2bit)
 *     bits 58-69:  CT2電流値 (12bit)
 *     bits 70-95:  CT2メタデータ (26bit)
 *     bits 96-97:  CT3フラグ (2bit)
 *     bits 98-109: CT3電流値 (12bit)
 *     bits110-135: CT3メタデータ (26bit)
 *     bits136-143: トレーリング (8bit)
 *
 *   変換: raw × 400 / 4095 (φ10-24 CT)
 *   0xFFF = 未接続チャンネル
 */
export function decodeCwd3Erp2(radio: RadioErp2): Cwd3DecodedData | null {
  const payload = radio.payload
  const rawPayloadHex = payload.toString('hex')

  let phaseL1CurrentA: number | null = null
  let phaseL2CurrentA: number | null = null
  let phaseL3CurrentA: number | null = null

  if (payload.length >= 18 && radio.telegramType === 5) {
    // GP Complete Data: 18バイトペイロード
    // 構造: [header 16bit] + [ch block 40bit] × 3 + [trailing 8bit]
    // 各チャンネルブロック(40bit): [メタ 13bit] [電流値 12bit] [メタ 15bit]
    const CT_BLOCK_BITS = 40
    const HEADER_BITS = 16
    const META_PREFIX_BITS = 13

    const rawCh1 = extract12bits(payload, HEADER_BITS + META_PREFIX_BITS)                          // bit 29
    const rawCh2 = extract12bits(payload, HEADER_BITS + CT_BLOCK_BITS + META_PREFIX_BITS)           // bit 69
    const rawCh3 = extract12bits(payload, HEADER_BITS + CT_BLOCK_BITS * 2 + META_PREFIX_BITS)       // bit 109

    phaseL1CurrentA = rawToCurrent(rawCh1)
    phaseL2CurrentA = rawToCurrent(rawCh2)
    phaseL3CurrentA = rawToCurrent(rawCh3)
  } else if (payload.length === 6) {
    // パックド12ビット形式 (6バイト、フォールバック)
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
