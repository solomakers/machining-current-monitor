import { z } from 'zod'

export const deviceSchema = z.object({
  id: z.string().uuid(),
  enoceanDeviceId: z.string().min(1).max(64),
  machineId: z.string().min(1).max(64).nullish(),
  machineName: z.string().min(1).max(200).nullish(),
  siteCode: z.string().min(1).max(50).nullish(),
  installedAt: z.string().datetime().nullish(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Device = z.infer<typeof deviceSchema>

export const unknownDeviceSchema = z.object({
  deviceId: z.string(),
  gatewayId: z.string().nullish(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  seenCount: z.number().int().min(1),
  lastRawPayloadHex: z.string().nullish(),
})

export type UnknownDevice = z.infer<typeof unknownDeviceSchema>
