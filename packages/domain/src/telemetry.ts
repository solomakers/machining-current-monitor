import { z } from 'zod'

export const telemetrySampleSchema = z.object({
  gatewayId: z.string().min(1).max(100),
  deviceId: z.string().min(1).max(64),
  machineId: z.string().min(1).max(64).nullish(),
  observedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  phaseL1CurrentA: z.number().min(0).nullable(),
  phaseL2CurrentA: z.number().min(0).nullable(),
  phaseL3CurrentA: z.number().min(0).nullable(),
  ctModelL1: z.string().nullish(),
  ctModelL2: z.string().nullish(),
  ctModelL3: z.string().nullish(),
  rawPayloadHex: z.string().regex(/^[0-9a-fA-F]+$/),
  rssi: z.number().int().min(-150).max(20).nullish(),
  repeaterCount: z.number().int().min(0).max(3).nullish(),
  parserVersion: z.string().min(1).max(32),
  source: z.literal('enocean-usb400j'),
})

export type TelemetrySample = z.infer<typeof telemetrySampleSchema>

export const ingestRequestSchema = z.object({
  gatewayId: z.string().min(1).max(100),
  sentAt: z.string().datetime(),
  samples: z
    .array(
      telemetrySampleSchema.extend({
        eventId: z.string().min(16).max(128),
      }),
    )
    .min(1)
    .max(500),
})

export type IngestRequest = z.infer<typeof ingestRequestSchema>

export const ingestResultSchema = z.object({
  eventId: z.string(),
  status: z.enum(['inserted', 'duplicated', 'rejected']),
  reason: z.string().nullish(),
})

export type IngestResult = z.infer<typeof ingestResultSchema>

export const ingestResponseSchema = z.object({
  gatewayId: z.string(),
  accepted: z.number().int().min(0),
  inserted: z.number().int().min(0),
  duplicated: z.number().int().min(0),
  rejected: z.number().int().min(0),
  processedAt: z.string().datetime(),
  results: z.array(ingestResultSchema).optional(),
})

export type IngestResponse = z.infer<typeof ingestResponseSchema>
