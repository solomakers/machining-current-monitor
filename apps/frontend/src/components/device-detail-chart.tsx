'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatJST } from '@/lib/format'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { calcTotalPowerKw } from '@/lib/power'
import type { PowerSettings } from '@/lib/power'

type Range = '1h' | '24h' | '7d'
type ViewMode = 'current' | 'power'

interface TelemetryRow {
  observed_at: string
  phase_l1_current_a: number | null
  phase_l2_current_a: number | null
  phase_l3_current_a: number | null
}

interface Props {
  deviceId: string
  initialData: TelemetryRow[]
  powerSettings?: PowerSettings
}

const REFRESH_MS = 30_000

export function DeviceDetailChart({ deviceId, initialData, powerSettings }: Props) {
  const [range, setRange] = useState<Range>('24h')
  const [viewMode, setViewMode] = useState<ViewMode>('current')
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (r: Range) => {
    const hours = r === '1h' ? 1 : r === '24h' ? 24 : 168
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const pageSize = 1000

    const supabase = createSupabaseBrowserClient()

    // ページネーションで全件取得
    const allRows: TelemetryRow[] = []
    let from = 0
    const maxRows = r === '7d' ? 30000 : 5000
    while (from < maxRows) {
      const { data: page } = await supabase
        .from('telemetry_events')
        .select('observed_at, phase_l1_current_a, phase_l2_current_a, phase_l3_current_a')
        .eq('device_id', deviceId)
        .gte('observed_at', since)
        .order('observed_at', { ascending: false })
        .range(from, from + pageSize - 1)

      if (!page || page.length === 0) break
      allRows.push(...page)
      if (page.length < pageSize) break
      from += pageSize
    }

    if (allRows.length === 0) return

    const reversed = allRows.reverse()

    // 7日間はデータを間引いて描画負荷を軽減（約2000点に）
    if (reversed.length > 2000) {
      const step = Math.ceil(reversed.length / 2000)
      setData(reversed.filter((_, i) => i % step === 0))
    } else {
      setData(reversed)
    }
  }, [deviceId])

  // 初回マウント時に最新データを取得
  useEffect(() => {
    fetchData(range)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 30秒ごとに自動更新
  useEffect(() => {
    const timer = setInterval(() => fetchData(range), REFRESH_MS)
    return () => clearInterval(timer)
  }, [range, fetchData])

  async function switchRange(newRange: Range) {
    setRange(newRange)
    setLoading(true)
    await fetchData(newRange)
    setLoading(false)
  }

  const timeFmt = range === '1h' ? 'HH:mm:ss' : range === '24h' ? 'HH:mm' : 'MM/dd HH:mm'

  const chartData = data.map((d) => {
    const pw = powerSettings
      ? calcTotalPowerKw(d.phase_l1_current_a, d.phase_l2_current_a, d.phase_l3_current_a, powerSettings)
      : null
    return {
      time: formatJST(d.observed_at, timeFmt),
      L1: d.phase_l1_current_a,
      L2: d.phase_l2_current_a,
      L3: d.phase_l3_current_a,
      power: pw != null ? Math.round(pw * 1000) / 1000 : null,
    }
  })

  const xInterval = Math.max(0, Math.floor(chartData.length / 10) - 1)

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-2">
          {(['1h', '24h', '7d'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => switchRange(r)}
              disabled={loading}
              className={`tab-hmi ${range === r ? 'tab-hmi-active' : 'tab-hmi-inactive'} text-xs px-3 py-1.5`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setViewMode('current')}
            className={`tab-hmi ${viewMode === 'current' ? 'tab-hmi-active' : 'tab-hmi-inactive'} text-xs px-3 py-1.5`}
          >
            電流 (A)
          </button>
          <button
            onClick={() => setViewMode('power')}
            className={`tab-hmi ${viewMode === 'power' ? 'tab-hmi-active' : 'tab-hmi-inactive'} text-xs px-3 py-1.5`}
          >
            電力 (kW)
          </button>
        </div>
        {loading && (
          <span className="text-xs text-[var(--color-text-dim)] font-mono animate-pulse">
            LOADING...
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-[var(--color-text-dim)] text-sm font-mono">
          NO DATA
        </div>
      ) : viewMode === 'current' ? (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'var(--color-text-dim)', fontFamily: 'JetBrains Mono, monospace' }}
              stroke="var(--color-border-accent)"
              interval={xInterval}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-dim)', fontFamily: 'JetBrains Mono, monospace' }}
              unit=" A"
              stroke="var(--color-border-accent)"
            />
            <Tooltip
              contentStyle={{
                fontSize: 13,
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-accent)',
                borderRadius: 8,
                color: 'var(--color-text)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
              formatter={(value: unknown) => {
                const n = typeof value === 'number' ? value : null
                return n != null ? `${n.toFixed(1)} A` : '---'
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} />
            <Line type="monotone" dataKey="L1" stroke="var(--color-line-l1)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="L2" stroke="var(--color-line-l2)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="L3" stroke="var(--color-line-l3)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'var(--color-text-dim)', fontFamily: 'JetBrains Mono, monospace' }}
              stroke="var(--color-border-accent)"
              interval={xInterval}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-dim)', fontFamily: 'JetBrains Mono, monospace' }}
              unit=" kW"
              stroke="var(--color-border-accent)"
            />
            <Tooltip
              contentStyle={{
                fontSize: 13,
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-accent)',
                borderRadius: 8,
                color: 'var(--color-text)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
              formatter={(value: unknown) => {
                const n = typeof value === 'number' ? value : null
                return n != null ? `${n.toFixed(3)} kW` : '---'
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} />
            <Line type="monotone" dataKey="power" name="電力" stroke="var(--color-power)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
