import { z } from 'zod'

const apiConfigSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().min(1),
  gatewayId: z.string().min(1).max(100),
  heartbeatIntervalSec: z.coerce.number().int().positive().default(60),
  spoolDir: z.string().min(1).default('./spool'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

export type ApiConfig = z.infer<typeof apiConfigSchema>

export function loadApiConfig(): ApiConfig {
  return apiConfigSchema.parse({
    baseUrl: process.env.INGEST_API_BASE_URL,
    token: process.env.INGEST_API_TOKEN,
    gatewayId: process.env.GATEWAY_ID,
    heartbeatIntervalSec: process.env.HEARTBEAT_INTERVAL_SEC,
    spoolDir: process.env.SPOOL_DIR,
    logLevel: process.env.LOG_LEVEL,
  })
}
