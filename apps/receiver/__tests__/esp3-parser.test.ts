import { describe, it, expect } from 'vitest'
import { crc8 } from '../src/enocean/esp3-types.js'
import { Esp3Parser } from '../src/enocean/esp3-parser.js'
import type { Esp3Packet } from '../src/enocean/esp3-types.js'

/** テスト用にESP3パケットバイナリを組み立てる */
function buildEsp3Packet(
  packetType: number,
  data: Buffer,
  optionalData: Buffer = Buffer.alloc(0),
): Buffer {
  const header = Buffer.alloc(4)
  header.writeUInt16BE(data.length, 0)
  header[2] = optionalData.length
  header[3] = packetType
  const headerCrc = crc8(header)

  const dataBlock = Buffer.concat([data, optionalData])
  const dataCrc = crc8(dataBlock)

  return Buffer.concat([
    Buffer.from([0x55]),
    header,
    Buffer.from([headerCrc]),
    dataBlock,
    Buffer.from([dataCrc]),
  ])
}

describe('Esp3Parser', () => {
  it('正常なパケットをパースできる', () => {
    const parser = new Esp3Parser()
    const packets: Esp3Packet[] = []
    parser.on('packet', (p) => packets.push(p))

    const data = Buffer.from([0x01, 0x02, 0x03])
    const raw = buildEsp3Packet(0x01, data)

    parser.push(raw)

    expect(packets).toHaveLength(1)
    expect(packets[0].packetType).toBe(0x01)
    expect(packets[0].data).toEqual(data)
  })

  it('分割されたデータでも正しくパースする', () => {
    const parser = new Esp3Parser()
    const packets: Esp3Packet[] = []
    parser.on('packet', (p) => packets.push(p))

    const data = Buffer.from([0xd2, 0x00, 0x64, 0x00, 0x60, 0x00, 0x5e])
    const raw = buildEsp3Packet(0x01, data)

    // 3バイトずつ分割して送る
    for (let i = 0; i < raw.length; i += 3) {
      parser.push(raw.subarray(i, Math.min(i + 3, raw.length)))
    }

    expect(packets).toHaveLength(1)
    expect(packets[0].dataLength).toBe(data.length)
  })

  it('CRCエラー時はエラーイベントを発火する', () => {
    const parser = new Esp3Parser()
    const errors: Error[] = []
    parser.on('error', (e) => errors.push(e))

    // ヘッダCRCを壊す
    const data = Buffer.from([0x01, 0x02, 0x03])
    const raw = buildEsp3Packet(0x01, data)
    raw[5] = 0xff // ヘッダCRCを不正値に

    parser.push(raw)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain('CRC')
  })

  it('連続パケットを正しくパースする', () => {
    const parser = new Esp3Parser()
    const packets: Esp3Packet[] = []
    parser.on('packet', (p) => packets.push(p))

    const data1 = Buffer.from([0x01, 0x02])
    const data2 = Buffer.from([0x03, 0x04, 0x05])
    const raw = Buffer.concat([buildEsp3Packet(0x01, data1), buildEsp3Packet(0x02, data2)])

    parser.push(raw)

    expect(packets).toHaveLength(2)
    expect(packets[0].packetType).toBe(0x01)
    expect(packets[1].packetType).toBe(0x02)
  })
})
