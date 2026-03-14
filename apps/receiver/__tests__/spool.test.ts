import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import pino from 'pino'
import { Spool } from '../src/spool/spool.js'

const logger = pino({ level: 'silent' })

describe('Spool', () => {
  let tmpDir: string
  let spool: Spool

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'spool-test-'))
    spool = new Spool(tmpDir, logger)
  })

  afterEach(() => {
    spool.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  const makeSample = (eventId: string) => ({
    eventId,
    gatewayId: 'gw-001',
    deviceId: '01-02-03-04',
    observedAt: '2026-03-15T09:30:00Z',
    receivedAt: '2026-03-15T09:30:03Z',
    phaseL1CurrentA: 10.0,
    phaseL2CurrentA: 9.5,
    phaseL3CurrentA: 9.3,
    rawPayloadHex: 'deadbeef',
    parserVersion: '1.0.0',
    source: 'enocean-usb400j' as const,
  })

  it('enqueue / peek / dequeue が動作する', () => {
    spool.enqueue(makeSample('evt-001'))
    spool.enqueue(makeSample('evt-002'))

    expect(spool.depth()).toBe(2)

    const entries = spool.peek(10)
    expect(entries).toHaveLength(2)
    expect(entries[0].eventId).toBe('evt-001')

    spool.dequeue(['evt-001'])
    expect(spool.depth()).toBe(1)

    const remaining = spool.peek(10)
    expect(remaining[0].eventId).toBe('evt-002')
  })

  it('同一eventIdの重複挿入は無視される', () => {
    spool.enqueue(makeSample('evt-001'))
    spool.enqueue(makeSample('evt-001'))
    expect(spool.depth()).toBe(1)
  })

  it('空のスプールからpeekすると空配列', () => {
    expect(spool.peek(10)).toHaveLength(0)
    expect(spool.depth()).toBe(0)
  })

  it('永続化後に再ロードできる', () => {
    spool.enqueue(makeSample('evt-001'))
    spool.enqueue(makeSample('evt-002'))

    // 新しい Spool インスタンスで同じディレクトリを開く
    const spool2 = new Spool(tmpDir, logger)
    expect(spool2.depth()).toBe(2)
    expect(spool2.peek(1)[0].eventId).toBe('evt-001')
    spool2.close()
  })
})
