import { describe, it, expect } from 'vitest'
import { decodeCwd3, decodeCwd3Erp2 } from '../src/enocean/cwd3-decoder.js'
import type { RadioErp1, RadioErp2 } from '../src/enocean/esp3-types.js'

function makeRadio(rorg: number, payload: Buffer): RadioErp1 {
  return {
    rorg,
    senderId: '01-02-03-04',
    payload,
    status: 0,
    rssi: -60,
    repeaterCount: 0,
  }
}

describe('decodeCwd3', () => {
  it('VLD(D2) パケットの3相電流をデコードする', () => {
    // L1=10.0A, L2=9.6A, L3=9.4A (0.1A単位)
    const payload = Buffer.alloc(6)
    payload.writeUInt16BE(100, 0) // 100 = 10.0A
    payload.writeUInt16BE(96, 2) // 96 = 9.6A
    payload.writeUInt16BE(94, 4) // 94 = 9.4A

    const radio = makeRadio(0xd2, payload)
    const result = decodeCwd3(radio)

    expect(result).not.toBeNull()
    expect(result!.phaseL1CurrentA).toBeCloseTo(10.0)
    expect(result!.phaseL2CurrentA).toBeCloseTo(9.6)
    expect(result!.phaseL3CurrentA).toBeCloseTo(9.4)
    expect(result!.deviceId).toBe('01-02-03-04')
  })

  it('0xFFFF は null として扱う', () => {
    const payload = Buffer.alloc(6)
    payload.writeUInt16BE(0xffff, 0)
    payload.writeUInt16BE(100, 2)
    payload.writeUInt16BE(0xffff, 4)

    const radio = makeRadio(0xd2, payload)
    const result = decodeCwd3(radio)

    expect(result!.phaseL1CurrentA).toBeNull()
    expect(result!.phaseL2CurrentA).toBeCloseTo(10.0)
    expect(result!.phaseL3CurrentA).toBeNull()
  })

  it('VLD以外のRORGは null を返す', () => {
    const payload = Buffer.alloc(6)
    const radio = makeRadio(0xf6, payload) // RPS
    expect(decodeCwd3(radio)).toBeNull()
  })

  it('ペイロードが短すぎる場合は電流値がnull', () => {
    const payload = Buffer.alloc(3) // 6バイト未満
    const radio = makeRadio(0xd2, payload)
    const result = decodeCwd3(radio)

    expect(result).not.toBeNull()
    expect(result!.phaseL1CurrentA).toBeNull()
    expect(result!.phaseL2CurrentA).toBeNull()
    expect(result!.phaseL3CurrentA).toBeNull()
  })
})

function makeErp2Radio(telegramType: number, payload: Buffer): RadioErp2 {
  return {
    telegramType,
    senderId: '05-9F-F0-D0',
    payload,
    rssi: -46,
    subTelNum: 0,
  }
}

describe('decodeCwd3Erp2 (GP Complete Data)', () => {
  it('18バイトGPペイロードから3相電流をデコードする（非稼働時=0A）', () => {
    // 実機データ: 非稼働時、全チャンネル 0A
    const payload = Buffer.from('01604198001282419800128241980012826c', 'hex')
    const radio = makeErp2Radio(5, payload)
    const result = decodeCwd3Erp2(radio)

    expect(result).not.toBeNull()
    // bit 29, 69, 109 = 0x000 = 0A
    expect(result!.phaseL1CurrentA).toBe(0)
    expect(result!.phaseL2CurrentA).toBe(0)
    expect(result!.phaseL3CurrentA).toBe(0)
  })

  it('データシート例: 037=55 → 5.37A', () => {
    // ch1=0x037(55), ch2=0x037(55), ch3=0x06C(108)
    // GP Complete Data: ヘッダ16bit + (2bit flag + 12bit current + 26bit meta) × 3 + 8bit trailing
    // bits 18-29: 000000110111 = 0x037 = 55
    // bits 58-69: 000000110111 = 0x037 = 55
    // bits 98-109: 000001101100 = 0x06C = 108
    //
    // ビット構築:
    // Header (16bit): 0000000000000000
    // CT1: flag(01) + current(000000110111) + meta(00000000000000000000000000)
    // CT2: flag(01) + current(000000110111) + meta(00000000000000000000000000)
    // CT3: flag(01) + current(000001101100) + meta(00000000000000000000000000)
    // Trailing: 00000000
    //
    // Full bits: 0000000000000000 01 000000110111 00000000000000000000000000
    //            01 000000110111 00000000000000000000000000
    //            01 000001101100 00000000000000000000000000
    //            00000000
    // = 00000000 00000000 01000000 11011100 00000000 00000000 00000001 00000011 01110000 00000000 00000000 00000100 00011011 00000000 00000000 00000000 00000000 00000000
    // This manual bit construction is complex, so let's build it programmatically

    const bits = new Uint8Array(18)
    // Helper: set 12 bits at a given bit offset
    const set12bits = (buf: Uint8Array, bitOff: number, val: number) => {
      for (let i = 0; i < 12; i++) {
        const bit = (val >> (11 - i)) & 1
        const byteIdx = Math.floor((bitOff + i) / 8)
        const bitIdx = 7 - ((bitOff + i) % 8)
        if (bit) buf[byteIdx] |= (1 << bitIdx)
      }
    }
    set12bits(bits, 29, 0x037)  // CT1 = 55
    set12bits(bits, 69, 0x037)  // CT2 = 55
    set12bits(bits, 109, 0x06c)  // CT3 = 108

    const payload = Buffer.from(bits)
    const radio = makeErp2Radio(5, payload)
    const result = decodeCwd3Erp2(radio)

    expect(result!.phaseL1CurrentA).toBeCloseTo(5.37, 1)
    expect(result!.phaseL2CurrentA).toBeCloseTo(5.37, 1)
    expect(result!.phaseL3CurrentA).toBeCloseTo(10.54, 1)
  })

  it('0xFFF は null (未接続) として扱う', () => {
    const bits = new Uint8Array(18)
    const set12bits = (buf: Uint8Array, bitOff: number, val: number) => {
      for (let i = 0; i < 12; i++) {
        const bit = (val >> (11 - i)) & 1
        const byteIdx = Math.floor((bitOff + i) / 8)
        const bitIdx = 7 - ((bitOff + i) % 8)
        if (bit) buf[byteIdx] |= (1 << bitIdx)
      }
    }
    set12bits(bits, 29, 0xfff)  // CT1 = 未接続
    set12bits(bits, 69, 0x037)  // CT2 = 55
    set12bits(bits, 109, 0xfff)  // CT3 = 未接続

    const payload = Buffer.from(bits)
    const radio = makeErp2Radio(5, payload)
    const result = decodeCwd3Erp2(radio)

    expect(result!.phaseL1CurrentA).toBeNull()
    expect(result!.phaseL2CurrentA).toBeCloseTo(5.37, 1)
    expect(result!.phaseL3CurrentA).toBeNull()
  })
})
