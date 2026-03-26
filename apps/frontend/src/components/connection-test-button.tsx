'use client'

import { useState } from 'react'
import { runConnectionTest } from './connection-test-action'

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

    const testResult = await runConnectionTest()
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
