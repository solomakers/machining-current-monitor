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
        <h2 className="text-xl font-bold text-gray-800 mb-6">未登録デバイス</h2>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center text-gray-500">
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">未登録デバイス</h2>

      {unknowns.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center text-gray-500">
          未登録デバイスはありません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">デバイスID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ゲートウェイ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">初回検知</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">最終検知</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">検知回数</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {unknowns.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-xs">{d.device_id}</td>
                  <td className="px-4 py-3 text-gray-500">{d.gateway_id ?? '---'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatJST(d.first_seen_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatJST(d.last_seen_at)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{d.seen_count}</td>
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
