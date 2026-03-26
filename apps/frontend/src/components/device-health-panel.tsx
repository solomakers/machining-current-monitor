'use client'

import { useState } from 'react'

interface HealthStatus {
  processUptime: number
  lastReceivedAt: string | null
  lastSentSuccessAt: string | null
  lastRssi: number | null
  lastDeviceId: string | null
  spoolDepth: number
  recentReceivedCount: number
  recentSendFailCount: number
  recentCrcErrorCount: number
  usbDeviceFound: boolean
}

type CheckStatus = 'idle' | 'checking' | 'done' | 'error'

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

function rssiLevel(rssi: number | null): { label: string; color: string } {
  if (rssi == null) return { label: '---', color: 'var(--color-text-dim)' }
  if (rssi >= -60) return { label: `${rssi} dBm (良好)`, color: 'var(--color-success)' }
  if (rssi >= -80) return { label: `${rssi} dBm (普通)`, color: 'var(--color-warning)' }
  return { label: `${rssi} dBm (弱い)`, color: 'var(--color-danger)' }
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-[var(--color-success)] pulse-live' : 'bg-[var(--color-danger)]'}`}
    />
  )
}

export function DeviceHealthPanel() {
  const [status, setStatus] = useState<CheckStatus>('idle')
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runCheck = async () => {
    setStatus('checking')
    setHealth(null)
    setError(null)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const res = await fetch('http://wsse-01.local:3001/health', {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setHealth(data)
      setStatus('done')
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'タイムアウト: RPiに接続できません（同じネットワーク上にいるか確認してください）'
          : 'RPiに接続できません（同じネットワーク上にいるか確認してください）',
      )
      setStatus('error')
    }
  }

  return (
    <div className="card-hmi p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium">
          デバイス診断（ローカルネットワーク）
        </h3>
        <button
          onClick={runCheck}
          disabled={status === 'checking'}
          className="btn-ghost text-xs"
        >
          {status === 'checking' ? '診断中...' : '診断実行'}
        </button>
      </div>

      {status === 'error' && error && (
        <p className="text-[var(--color-danger)] text-sm mb-3">{error}</p>
      )}

      {health && (
        <div className="space-y-3 text-sm">
          {/* Receiver Process */}
          <div className="flex items-center gap-3">
            <StatusDot ok />
            <span className="text-[var(--color-text-muted)]">Receiverプロセス</span>
            <span className="ml-auto font-[JetBrains_Mono,monospace] text-[var(--color-text-dim)] text-xs">
              稼働 {formatUptime(health.processUptime)}
            </span>
          </div>

          {/* USB 400J */}
          <div className="flex items-center gap-3">
            <StatusDot ok={health.usbDeviceFound} />
            <span className="text-[var(--color-text-muted)]">USB 400J</span>
            <span className="ml-auto font-[JetBrains_Mono,monospace] text-xs" style={{ color: health.usbDeviceFound ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {health.usbDeviceFound ? '認識済み' : '未検出'}
            </span>
          </div>

          {/* Sensor Reception */}
          <div className="flex items-center gap-3">
            <StatusDot ok={health.lastReceivedAt != null} />
            <span className="text-[var(--color-text-muted)]">センサー受信</span>
            <span className="ml-auto font-[JetBrains_Mono,monospace] text-xs" style={{ color: health.lastReceivedAt ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {health.lastReceivedAt
                ? new Date(health.lastReceivedAt).toLocaleTimeString('ja-JP')
                : '未受信'}
            </span>
          </div>

          {/* Device ID */}
          {health.lastDeviceId && (
            <div className="flex items-center gap-3">
              <span className="inline-block w-2.5" />
              <span className="text-[var(--color-text-muted)]">デバイスID</span>
              <span className="ml-auto font-[JetBrains_Mono,monospace] text-[var(--color-primary)] text-xs">
                {health.lastDeviceId}
              </span>
            </div>
          )}

          {/* RSSI */}
          <div className="flex items-center gap-3">
            <span className="inline-block w-2.5" />
            <span className="text-[var(--color-text-muted)]">電波強度</span>
            {(() => {
              const r = rssiLevel(health.lastRssi)
              return (
                <span className="ml-auto font-[JetBrains_Mono,monospace] text-xs" style={{ color: r.color }}>
                  {r.label}
                </span>
              )
            })()}
          </div>

          {/* Recent Stats */}
          <div className="border-t border-[var(--color-border)] pt-3 mt-3 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] text-[var(--color-text-dim)] uppercase">5分間 受信</p>
              <p className="text-lg font-bold font-[JetBrains_Mono,monospace] text-[var(--color-success)]">
                {health.recentReceivedCount}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-dim)] uppercase">CRCエラー</p>
              <p className={`text-lg font-bold font-[JetBrains_Mono,monospace] ${health.recentCrcErrorCount > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}`}>
                {health.recentCrcErrorCount}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-dim)] uppercase">送信失敗</p>
              <p className={`text-lg font-bold font-[JetBrains_Mono,monospace] ${health.recentSendFailCount > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                {health.recentSendFailCount}
              </p>
            </div>
          </div>

          {/* Spool */}
          {health.spoolDepth > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <StatusDot ok={false} />
              <span className="text-[var(--color-text-muted)]">未送信スプール</span>
              <span className="ml-auto font-[JetBrains_Mono,monospace] text-[var(--color-warning)] text-xs">
                {health.spoolDepth} 件
              </span>
            </div>
          )}

          {/* Supabase送信 */}
          <div className="flex items-center gap-3">
            <StatusDot ok={health.lastSentSuccessAt != null} />
            <span className="text-[var(--color-text-muted)]">Supabase送信</span>
            <span className="ml-auto font-[JetBrains_Mono,monospace] text-xs" style={{ color: health.lastSentSuccessAt ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {health.lastSentSuccessAt
                ? new Date(health.lastSentSuccessAt).toLocaleTimeString('ja-JP')
                : '未送信'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
