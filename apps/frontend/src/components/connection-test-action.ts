'use server'

interface TestResult {
  supabase: { ok: boolean; latencyMs: number; error?: string }
  ingest: { ok: boolean; latencyMs: number; error?: string }
}

export async function runConnectionTest(): Promise<TestResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Test 1: Supabase REST API
  let supabaseResult: TestResult['supabase']
  try {
    const start = performance.now()
    const res = await fetch(`${supabaseUrl}/rest/v1/gateways?select=id&limit=1`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    })
    const latencyMs = Math.round(performance.now() - start)
    supabaseResult = { ok: res.ok, latencyMs }
  } catch (err) {
    supabaseResult = { ok: false, latencyMs: 0, error: (err as Error).message }
  }

  // Test 2: Ingest Edge Function
  let ingestResult: TestResult['ingest']
  try {
    const start = performance.now()
    const res = await fetch(`${supabaseUrl}/functions/v1/telemetry-ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: '{}',
    })
    const latencyMs = Math.round(performance.now() - start)
    // 400 = validation error (reached the function, working correctly)
    // 401 = auth error (function reachable)
    ingestResult = { ok: res.status === 400 || res.status === 401 || res.ok, latencyMs }
  } catch (err) {
    ingestResult = { ok: false, latencyMs: 0, error: (err as Error).message }
  }

  return { supabase: supabaseResult, ingest: ingestResult }
}
