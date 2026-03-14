import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

// ---------- Types (mirroring packages/domain/gateway) ----------

type GatewayStatus = 'online' | 'degraded' | 'offline'

interface HeartbeatRequest {
  gatewayId: string
  sentAt: string
  status: GatewayStatus
  spoolDepth: number
  serialPort?: string | null
  appVersion?: string | null
  uptimeSec?: number | null
  lastReceivedAt?: string | null
  lastSentSuccessAt?: string | null
  meta?: Record<string, unknown> | null
}

// ---------- Auth ----------

function parseGatewayTokenMap(): Map<string, string> {
  const raw = Deno.env.get('INGEST_GATEWAY_TOKEN_MAP') ?? ''
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
  if (token.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

// ---------- Validation ----------

const VALID_STATUSES: GatewayStatus[] = ['online', 'degraded', 'offline']

function validateRequest(body: unknown): { ok: true; data: HeartbeatRequest } | { ok: false; message: string } {
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
  if (typeof req.status !== 'string' || !VALID_STATUSES.includes(req.status as GatewayStatus)) {
    return { ok: false, message: 'status must be one of: online, degraded, offline' }
  }
  if (typeof req.spoolDepth !== 'number' || req.spoolDepth < 0 || !Number.isInteger(req.spoolDepth)) {
    return { ok: false, message: 'spoolDepth must be a non-negative integer' }
  }

  return { ok: true, data: body as HeartbeatRequest }
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json(
      { error: 'invalid_json', message: 'Request body is not valid JSON' },
      { status: 400 },
    )
  }

  const validation = validateRequest(body)
  if (!validation.ok) {
    return Response.json(
      { error: 'validation_error', message: validation.message },
      { status: 400 },
    )
  }

  const data = validation.data

  // Authenticate
  const authHeader = req.headers.get('Authorization')
  if (!authenticateGateway(authHeader, data.gatewayId, tokenMap)) {
    return Response.json(
      { error: 'unauthorized', message: 'Invalid or missing gateway token' },
      { status: 401 },
    )
  }

  // Supabase client with service_role
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Insert heartbeat record
  const { error: insertError } = await supabase.from('gateway_heartbeats').insert({
    gateway_id: data.gatewayId,
    status: data.status,
    sent_at: data.sentAt,
    spool_depth: data.spoolDepth,
    serial_port: data.serialPort ?? null,
    app_version: data.appVersion ?? null,
    uptime_sec: data.uptimeSec ?? null,
    last_received_at: data.lastReceivedAt ?? null,
    last_sent_success_at: data.lastSentSuccessAt ?? null,
    meta_json: data.meta ?? null,
  })

  if (insertError) {
    console.error('Failed to insert heartbeat:', insertError)
    return Response.json(
      { error: 'server_error', message: 'Failed to store heartbeat' },
      { status: 500 },
    )
  }

  // Update gateway status and last_seen_at (best-effort)
  await supabase
    .from('gateways')
    .update({
      status: data.status,
      last_seen_at: data.sentAt,
    })
    .eq('name', data.gatewayId)
    .then(() => {})
    .catch(() => {})

  return Response.json(
    {
      gatewayId: data.gatewayId,
      accepted: true,
      processedAt: new Date().toISOString(),
    },
    { status: 200 },
  )
})
