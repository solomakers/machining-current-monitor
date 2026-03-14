import { describe, it, expect } from 'vitest'
import { decodeCwd3 } from '../src/enocean/cwd3-decoder.js'
import type { RadioErp1 } from '../src/enocean/esp3-types.js'

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
