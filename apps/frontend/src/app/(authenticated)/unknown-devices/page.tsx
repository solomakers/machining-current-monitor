'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { formatJST } from '@/lib/format'
import { ApproveDeviceForm } from '@/components/approve-device-form'

interface UnknownDevice {
  id: string
  device_id: string
  gateway_id: string | null
  first_seen_at: string
  last_seen_at: string
  seen_count: number
}

export default function UnknownDevicesPage() {
  const [unknowns, setUnknowns] = useState<UnknownDevice[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const fetchData = useCallback(async () => {
    const { data } = await supabase
      .from('unknown_devices')
      .select('*')
      .order('last_seen_at', { ascending: false })
    setUnknowns(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-6">未登録デバイス</h2>
        <div className="card-hmi p-8 text-center text-[var(--color-text-dim)] font-mono text-sm animate-pulse">
          LOADING...
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-6">未登録デバイス</h2>

      {unknowns.length === 0 ? (
        <div className="card-hmi p-8 text-center text-[var(--color-text-dim)] font-mono text-sm">
          未登録デバイスはありません
        </div>
      ) : (
        <div className="card-hmi overflow-hidden">
          <table className="w-full text-sm table-hmi">
            <thead>
              <tr>
                <th className="text-left px-4 py-3">デバイスID</th>
                <th className="text-left px-4 py-3">ゲートウェイ</th>
                <th className="text-left px-4 py-3">初回検知</th>
                <th className="text-left px-4 py-3">最終検知</th>
                <th className="text-right px-4 py-3">検知回数</th>
                <th className="text-center px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {unknowns.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-[JetBrains_Mono,monospace] text-xs text-[var(--color-primary)]">
                    {d.device_id}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{d.gateway_id ?? '---'}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs font-mono">
                    {formatJST(d.first_seen_at)}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs font-mono">
                    {formatJST(d.last_seen_at)}
                  </td>
                  <td className="px-4 py-3 text-right font-[JetBrains_Mono,monospace] text-[var(--color-text)]">
                    {d.seen_count}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ApproveDeviceForm
                      deviceId={d.device_id}
                      gatewayId={d.gateway_id}
                      onApproved={fetchData}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
