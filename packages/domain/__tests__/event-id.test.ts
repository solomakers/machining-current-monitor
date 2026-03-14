import { describe, it, expect } from 'vitest'
import { generateEventId } from '../src/event-id.js'

describe('generateEventId', () => {
  it('同じ入力には同じIDを返す', () => {
    const id1 = generateEventId('01-02-03-04', '2026-03-15T09:30:00Z', 'deadbeef01')
    const id2 = generateEventId('01-02-03-04', '2026-03-15T09:30:00Z', 'deadbeef01')
    expect(id1).toBe(id2)
  })

  it('32文字の16進文字列を返す', () => {
    const id = generateEventId('01-02-03-04', '2026-03-15T09:30:00Z', 'deadbeef01')
    expect(id).toHaveLength(32)
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('入力が異なればIDも異なる', () => {
    const id1 = generateEventId('01-02-03-04', '2026-03-15T09:30:00Z', 'deadbeef01')
    const id2 = generateEventId('01-02-03-05', '2026-03-15T09:30:00Z', 'deadbeef01')
    expect(id1).not.toBe(id2)
  })
})
