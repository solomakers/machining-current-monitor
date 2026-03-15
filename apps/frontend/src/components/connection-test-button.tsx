'use client'

import { useState } from 'react'

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface TestResult {
  supabase: { ok: boolean; latencyMs: number; error?: string }
  ingest: { ok: boolean; latencyMs: number; error?: string }
}

export function ConnectionTestButton() {
  const [status, setStatus] = useState<TestStatus>('idle')
  const [result, setResult] = useState<TestResult | null>(null)

  const runTest = async () => {
    setStatus('testing')
    setResult(null)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    // Test 1: Supabase REST API
    let supabaseResult: TestResult['supabase']
    try {
      const start = performance.now()
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      })
      const latencyMs = Math.round(performance.now() - start)
      supabaseResult = { ok: res.ok, latencyMs }
    } catch (err) {
      supabaseResult = { ok: false, latencyMs: 0, error: (err as Error).message }
    }

    // Test 2: Ingest Edge Function (health check with empty body)
    let ingestResult: TestResult['ingest']
    try {
      const start = performance.now()
      const res = await fetch(`${supabaseUrl}/functions/v1/telemetry-ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const latencyMs = Math.round(performance.now() - start)
      // 401 is expected (no auth token), but means the function is reachable
      ingestResult = { ok: res.status === 401 || res.ok, latencyMs }
    } catch (err) {
      ingestResult = { ok: false, latencyMs: 0, error: (err as Error).message }
    }

    const testResult = { supabase: supabaseResult, ingest: ingestResult }
    setResult(testResult)
    setStatus(testResult.supabase.ok && testResult.ingest.ok ? 'success' : 'error')
  }

  return (
    <div>
      <button
        onClick={runTest}
        disabled={status === 'testing'}
        className="btn-ghost text-xs"
      >
        {status === 'testing' ? 'テスト中...' : '通信テスト'}
      </button>

      {result && (
        <div className="mt-3 card-hmi p-3 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${result.supabase.ok ? 'bg-[var(--color-success)] pulse-live' : 'bg-[var(--color-danger)]'}`} />
            <span className="text-[var(--color-text-muted)]">Supabase API</span>
            <span className="ml-auto font-[JetBrains_Mono,monospace] text-[var(--color-text-dim)]">{result.supabase.latencyMs}ms</span>
          </div>
          {result.supabase.error && (
            <p className="text-[var(--color-danger)] pl-4">{result.supabase.error}</p>
          )}
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${result.ingest.ok ? 'bg-[var(--color-success)] pulse-live' : 'bg-[var(--color-danger)]'}`} />
            <span className="text-[var(--color-text-muted)]">Ingest Function</span>
            <span className="ml-auto font-[JetBrains_Mono,monospace] text-[var(--color-text-dim)]">{result.ingest.latencyMs}ms</span>
          </div>
          {result.ingest.error && (
            <p className="text-[var(--color-danger)] pl-4">{result.ingest.error}</p>
          )}
          <p className={`font-medium ${status === 'success' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
            {status === 'success' ? '全て正常' : '接続に問題があります'}
          </p>
        </div>
      )}
    </div>
  )
}
