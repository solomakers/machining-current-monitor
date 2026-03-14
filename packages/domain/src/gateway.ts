import { z } from 'zod'

export const gatewayStatusSchema = z.enum(['online', 'degraded', 'offline'])
export type GatewayStatus = z.infer<typeof gatewayStatusSchema>

export const gatewaySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  siteCode: z.string().min(1).max(50).nullish(),
  status: gatewayStatusSchema,
  lastSeenAt: z.string().datetime().nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Gateway = z.infer<typeof gatewaySchema>

export const heartbeatRequestSchema = z.object({
  gatewayId: z.string().min(1).max(100),
  sentAt: z.string().datetime(),
  status: gatewayStatusSchema,
  spoolDepth: z.number().int().min(0),
  serialPort: z.string().nullish(),
  appVersion: z.string().nullish(),
  uptimeSec: z.number().int().min(0).nullish(),
  lastReceivedAt: z.string().datetime().nullish(),
  lastSentSuccessAt: z.string().datetime().nullish(),
  meta: z.record(z.unknown()).nullish(),
})

export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>

export const heartbeatResponseSchema = z.object({
  gatewayId: z.string(),
  accepted: z.boolean(),
  processedAt: z.string().datetime(),
})

export type HeartbeatResponse = z.infer<typeof heartbeatResponseSchema>
