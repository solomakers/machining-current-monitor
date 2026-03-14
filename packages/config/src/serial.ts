import { z } from 'zod'

const serialConfigSchema = z.object({
  port: z.string().min(1),
  baudRate: z.coerce.number().int().positive().default(57600),
  dataBits: z.coerce.number().int().refine((v) => [5, 6, 7, 8].includes(v)).default(8),
  stopBits: z.coerce.number().refine((v) => [1, 1.5, 2].includes(v)).default(1),
  parity: z.enum(['none', 'even', 'odd', 'mark', 'space']).default('none'),
})

export type SerialConfig = z.infer<typeof serialConfigSchema>

export function loadSerialConfig(): SerialConfig {
  return serialConfigSchema.parse({
    port: process.env.SERIAL_PORT,
    baudRate: process.env.SERIAL_BAUD_RATE,
    dataBits: process.env.SERIAL_DATA_BITS,
    stopBits: process.env.SERIAL_STOP_BITS,
    parity: process.env.SERIAL_PARITY,
  })
}
