import type { RadioErp1 } from './esp3-types.js'

/** CWD-3-1 の EEP RORG (VLD: D2) */
const RORG_VLD = 0xd2

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
 * CWD-3-1 のペイロードをデコードする。
 *
 * CWD-3-1 は VLD (D2) プロファイルで 3相の電流値を送信する。
 * ペイロード構造は EnOcean Equipment Profile (EEP) に従う。
 *
 * 注意: 実データのマッピング詳細は未確定事項 (CLAUDE.md §16)。
 * 現時点ではバイト配列から3相分の電流を 0.1A 単位で読み出す想定。
 * 実機テストで確定後に調整する。
 */
export function decodeCwd3(radio: RadioErp1): Cwd3DecodedData | null {
  if (radio.rorg !== RORG_VLD) return null

  const payload = radio.payload
  const rawPayloadHex = payload.toString('hex')

  // CWD-3-1 ペイロード解析
  // 暫定マッピング: 各相 2バイト (big-endian), 0.1A 単位
  // 最低6バイト必要 (3相 × 2バイト)
  let phaseL1CurrentA: number | null = null
  let phaseL2CurrentA: number | null = null
  let phaseL3CurrentA: number | null = null

  if (payload.length >= 6) {
    const rawL1 = payload.readUInt16BE(0)
    const rawL2 = payload.readUInt16BE(2)
    const rawL3 = payload.readUInt16BE(4)

    // 0xFFFF は無効値とする
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
