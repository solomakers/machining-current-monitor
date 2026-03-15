'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface Props {
  deviceId: string
  deviceName: string
}

export function CsvExportButton({ deviceId, deviceName }: Props) {
  const [exporting, setExporting] = useState(false)
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const handleExport = async () => {
    setExporting(true)

    const rangeMs = { '24h': 24 * 3600_000, '7d': 7 * 24 * 3600_000, '30d': 30 * 24 * 3600_000 }
    const since = new Date(Date.now() - rangeMs[range]).toISOString()

    const { data } = await supabase
      .from('telemetry_events')
      .select('observed_at, phase_l1_current_a, phase_l2_current_a, phase_l3_current_a, rssi, gateway_id')
      .eq('device_id', deviceId)
      .gte('observed_at', since)
      .order('observed_at', { ascending: true })
      .limit(50000)

    if (!data || data.length === 0) {
      alert('エクスポートするデータがありません')
      setExporting(false)
      return
    }

    const header = '観測日時,L1電流(A),L2電流(A),L3電流(A),RSSI,ゲートウェイ'
    const rows = data.map((r) =>
      [
        r.observed_at,
        r.phase_l1_current_a ?? '',
        r.phase_l2_current_a ?? '',
        r.phase_l3_current_a ?? '',
        r.rssi ?? '',
        r.gateway_id ?? '',
      ].join(','),
    )

    const bom = '\uFEFF'
    const csv = bom + header + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `${deviceName}_${range}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)

    setExporting(false)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={range}
        onChange={(e) => setRange(e.target.value as '24h' | '7d' | '30d')}
        className="input-hmi text-xs py-1"
      >
        <option value="24h">24時間</option>
        <option value="7d">7日間</option>
        <option value="30d">30日間</option>
      </select>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="btn-ghost text-xs"
      >
        {exporting ? 'エクスポート中...' : 'CSV出力'}
      </button>
    </div>
  )
}
