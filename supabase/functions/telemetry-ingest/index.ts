import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

// ---------- Types (mirroring packages/domain) ----------

interface TelemetrySample {
  eventId: string
  deviceId: string
  machineId?: string | null
  observedAt: string
  receivedAt: string
  phaseL1CurrentA: number | null
  phaseL2CurrentA: number | null
  phaseL3CurrentA: number | null
  ctModelL1?: string | null
  ctModelL2?: string | null
  ctModelL3?: string | null
  rawPayloadHex: string
  rssi?: number | null
  repeaterCount?: number | null
  parserVersion: string
  source: 'enocean-usb400j'
}

interface IngestRequest {
  gatewayId: string
  sentAt: string
  samples: TelemetrySample[]
}

interface IngestResult {
  eventId: string
  status: 'inserted' | 'duplicated' | 'rejected'
  reason?: string | null
}

// ---------- Auth ----------

function parseGatewayTokenMap(): Map<string, string> {
  const raw = Deno.env.get('INGEST_GATEWAY_TOKEN_MAP') ?? ''
  // Format: "gatewayId1:token1,gatewayId2:token2"
  const map = new Map<string, string>()
  for (const pair of raw.split(',')) {
    const [gw, token] = pair.split(':')
    if (gw && token) map.set(gw.trim(), token.trim())
  }
  return map
}

function authenticateGateway(
  authHeader: string | null,
  gatewayId: string,
  tokenMap: Map<string, string>,
): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const expected = tokenMap.get(gatewayId)
  if (!expected) return false
  // Constant-time comparison to avoid timing attacks
  if (token.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

// ---------- Validation ----------

function validateRequest(body: unknown): { ok: true; data: IngestRequest } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Request body must be a JSON object' }
  }

  const req = body as Record<string, unknown>

  if (typeof req.gatewayId !== 'string' || req.gatewayId.length < 1 || req.gatewayId.length > 100) {
    return { ok: false, message: 'gatewayId must be a string (1-100 chars)' }
  }
  if (typeof req.sentAt !== 'string') {
    return { ok: false, message: 'sentAt must be a datetime string' }
  }
  if (!Array.isArray(req.samples) || req.samples.length < 1 || req.samples.length > 500) {
    return { ok: false, message: 'samples must be an array with 1-500 items' }
  }

  for (let i = 0; i < req.samples.length; i++) {
    const s = req.samples[i]
    if (!s || typeof s !== 'object') {
      return { ok: false, message: `samples[${i}] must be an object` }
    }
    if (typeof s.eventId !== 'string' || s.eventId.length < 16) {
      return { ok: false, message: `samples[${i}].eventId is invalid` }
    }
    if (typeof s.deviceId !== 'string' || s.deviceId.length < 1) {
      return { ok: false, message: `samples[${i}].deviceId is required` }
    }
    if (typeof s.observedAt !== 'string') {
      return { ok: false, message: `samples[${i}].observedAt is required` }
    }
    if (typeof s.receivedAt !== 'string') {
      return { ok: false, message: `samples[${i}].receivedAt is required` }
    }
    if (typeof s.rawPayloadHex !== 'string' || !/^[0-9a-fA-F]+$/.test(s.rawPayloadHex)) {
      return { ok: false, message: `samples[${i}].rawPayloadHex is invalid` }
    }
    if (typeof s.parserVersion !== 'string') {
      return { ok: false, message: `samples[${i}].parserVersion is required` }
    }
    if (s.source !== 'enocean-usb400j') {
      return { ok: false, message: `samples[${i}].source must be 'enocean-usb400j'` }
    }
  }

  return { ok: true, data: body as IngestRequest }
}

// ---------- Upsert unknown device ----------

async function upsertUnknownDevice(
  supabase: ReturnType<typeof createClient>,
  deviceId: string,
  gatewayId: string,
  rawPayloadHex: string,
): Promise<void> {
  // Check if device is registered
  const { data: device } = await supabase
    .from('devices')
    .select('id')
    .eq('enocean_device_id', deviceId)
    .maybeSingle()

  if (device) return // Already registered

  // Upsert into unknown_devices
  const { error } = await supabase.rpc('upsert_unknown_device', {
    p_device_id: deviceId,
    p_gateway_id: gatewayId,
    p_raw_payload_hex: rawPayloadHex,
  })

  if (error) {
    // Fallback: direct upsert if RPC not available
    await supabase
      .from('unknown_devices')
      .upsert(
        {
          device_id: deviceId,
          gateway_id: gatewayId,
          last_seen_at: new Date().toISOString(),
          seen_count: 1,
          last_raw_payload_hex: rawPayloadHex,
        },
        { onConflict: 'device_id' },
      )
  }
}

// ---------- Handler ----------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return Response.json(
      { error: 'method_not_allowed', message: 'Only POST is accepted' },
      { status: 405 },
    )
  }

  const tokenMap = parseGatewayTokenMap()

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json(
      { error: 'invalid_json', message: 'Request body is not valid JSON' },
      { status: 400 },
    )
  }

  // Validate
  const validation = validateRequest(body)
  if (!validation.ok) {
    return Response.json(
      { error: 'validation_error', message: validation.message },
      { status: 400 },
    )
  }

  const { gatewayId, samples } = validation.data

  // Authenticate
  const authHeader = req.headers.get('Authorization')
  if (!authenticateGateway(authHeader, gatewayId, tokenMap)) {
    return Response.json(
      { error: 'unauthorized', message: 'Invalid or missing gateway token' },
      { status: 401 },
    )
  }

  // Supabase client with service_role
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const results: IngestResult[] = []
  let inserted = 0
  let duplicated = 0
  let rejected = 0

  for (const sample of samples) {
    try {
      const row = {
        event_id: sample.eventId,
        gateway_id: gatewayId,
        device_id: sample.deviceId,
        machine_id: sample.machineId ?? null,
        observed_at: sample.observedAt,
        received_at: sample.receivedAt,
        phase_l1_current_a: sample.phaseL1CurrentA,
        phase_l2_current_a: sample.phaseL2CurrentA,
        phase_l3_current_a: sample.phaseL3CurrentA,
        ct_model_l1: sample.ctModelL1 ?? null,
        ct_model_l2: sample.ctModelL2 ?? null,
        ct_model_l3: sample.ctModelL3 ?? null,
        raw_payload_hex: sample.rawPayloadHex,
        parser_version: sample.parserVersion,
        rssi: sample.rssi ?? null,
        repeater_count: sample.repeaterCount ?? null,
        source: sample.source,
      }

      const { error } = await supabase.from('telemetry_events').insert(row)

      if (error) {
        if (error.code === '23505') {
          // Unique violation on event_id → duplicate
          duplicated++
          results.push({ eventId: sample.eventId, status: 'duplicated' })
        } else {
          rejected++
          results.push({
            eventId: sample.eventId,
            status: 'rejected',
            reason: error.message,
          })
        }
      } else {
        inserted++
        results.push({ eventId: sample.eventId, status: 'inserted' })

        // Track unknown devices in background (non-blocking)
        upsertUnknownDevice(supabase, sample.deviceId, gatewayId, sample.rawPayloadHex).catch(
          () => {
            // Swallow error — unknown device tracking is best-effort
          },
        )
      }
    } catch (err) {
      rejected++
      results.push({
        eventId: sample.eventId,
        status: 'rejected',
        reason: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  // Update gateway last_seen_at (best-effort)
  supabase
    .from('gateways')
    .update({ last_seen_at: new Date().toISOString(), status: 'online' })
    .eq('name', gatewayId)
    .then(() => {})
    .catch(() => {})

  const response = {
    gatewayId,
    accepted: inserted + duplicated,
    inserted,
    duplicated,
    rejected,
    processedAt: new Date().toISOString(),
    results,
  }

  return Response.json(response, { status: 200 })
})
