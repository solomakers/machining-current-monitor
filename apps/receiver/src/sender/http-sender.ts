import type { IngestRequest, IngestResponse } from '@mcm/domain'
import type { ApiConfig } from '@mcm/config'
import type { Logger } from 'pino'

const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

/**
 * HTTPS POST で ingestion API にデータを送信する。
 * 指数バックオフによるリトライ付き。
 */
export class HttpSender {
  constructor(
    private readonly config: ApiConfig,
    private readonly logger: Logger,
  ) {}

  async send(request: IngestRequest): Promise<IngestResponse | null> {
    const url = `${this.config.baseUrl}/telemetry/ingest`

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.token}`,
          },
          body: JSON.stringify(request),
        })

        if (response.ok) {
          const body = (await response.json()) as IngestResponse
          this.logger.info(
            { inserted: body.inserted, duplicated: body.duplicated },
            'Ingest successful',
          )
          return body
        }

        // 4xx はリトライしない（400: validation, 401: auth, 409: conflict）
        if (response.status >= 400 && response.status < 500) {
          const errorBody = await response.text()
          this.logger.error(
            { status: response.status, body: errorBody },
            'Ingest rejected (client error)',
          )
          return null
        }

        // 5xx はリトライ対象
        this.logger.warn(
          { status: response.status, attempt },
          'Ingest server error, will retry',
        )
      } catch (err) {
        this.logger.warn({ err, attempt }, 'Ingest request failed, will retry')
      }

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    this.logger.error('Ingest failed after all retries')
    return null
  }
}
