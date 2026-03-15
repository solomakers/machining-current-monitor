import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TelemetrySample } from '@mcm/domain'
import type { Logger } from 'pino'

type SpoolEntry = TelemetrySample & { eventId: string }

interface SpoolRecord {
  eventId: string
  payload: SpoolEntry
  createdAt: string
}

/**
 * JSONL ベースのローカルスプール。
 * 送信失敗時にデータを保持し、復旧後に古い順で再送する。
 */
export class Spool {
  private readonly filePath: string
  private records: SpoolRecord[] = []

  constructor(
    spoolDir: string,
    private readonly logger: Logger,
  ) {
    mkdirSync(spoolDir, { recursive: true })
    this.filePath = join(spoolDir, 'spool.jsonl')
    this.load()
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      this.records = []
      return
    }
    try {
      const content = readFileSync(this.filePath, 'utf-8')
      this.records = content
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as SpoolRecord)
    } catch {
      this.logger.warn('Failed to load spool file, starting fresh')
      this.records = []
    }
  }

  private persist(): void {
    const content = this.records.map((r) => JSON.stringify(r)).join('\n') + '\n'
    writeFileSync(this.filePath, content, 'utf-8')
  }

  enqueue(entry: SpoolEntry): void {
    if (this.records.some((r) => r.eventId === entry.eventId)) return
    this.records.push({
      eventId: entry.eventId,
      payload: entry,
      createdAt: new Date().toISOString(),
    })
    this.persist()
    this.logger.debug({ eventId: entry.eventId }, 'Spooled entry')
  }

  peek(limit: number): SpoolEntry[] {
    return this.records.slice(0, limit).map((r) => r.payload)
  }

  dequeue(eventIds: string[]): void {
    if (eventIds.length === 0) return
    const idSet = new Set(eventIds)
    this.records = this.records.filter((r) => !idSet.has(r.eventId))
    this.persist()
    this.logger.debug({ count: eventIds.length }, 'Dequeued entries')
  }

  depth(): number {
    return this.records.length
  }

  close(): void {
    // JSONL は明示的クローズ不要
  }
}
