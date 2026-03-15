'use client'

import { useState } from 'react'
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

type Range = '1h' | '24h' | '7d'

interface Props {
  deviceId: string
  initialData: {
    observed_at: string
    phase_l1_current_a: number | null
    phase_l2_current_a: number | null
    phase_l3_current_a: number | null
  }[]
}

export function DeviceDetailChart({ deviceId, initialData }: Props) {
  const [range, setRange] = useState<Range>('24h')
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  async function switchRange(newRange: Range) {
    setRange(newRange)
    setLoading(true)

    const hours = newRange === '1h' ? 1 : newRange === '24h' ? 24 : 168
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    const supabase = createSupabaseBrowserClient()
    const { data: result } = await supabase
      .from('telemetry_events')
      .select('observed_at, phase_l1_current_a, phase_l2_current_a, phase_l3_current_a')
      .eq('device_id', deviceId)
      .gte('observed_at', since)
      .order('observed_at', { ascending: true })
      .limit(5000)

    setData(result ?? [])
    setLoading(false)
  }

  const timeFmt = range === '1h' ? 'HH:mm:ss' : range === '24h' ? 'HH:mm' : 'MM/dd HH:mm'

  const chartData = data.map((d) => ({
    time: formatJST(d.observed_at, timeFmt),
    L1: d.phase_l1_current_a,
    L2: d.phase_l2_current_a,
    L3: d.phase_l3_current_a,
  }))

  return (
    <div>
      <div className="flex gap-2 mb-4">
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
        {loading && (
          <span className="text-xs text-[var(--color-text-dim)] self-center ml-2 font-mono animate-pulse">
            LOADING...
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-[var(--color-text-dim)] text-sm font-mono">
          NO DATA
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: 'var(--color-text-dim)', fontFamily: 'JetBrains Mono, monospace' }}
              stroke="var(--color-border-accent)"
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
            <Legend
              wrapperStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
            />
            <Line type="monotone" dataKey="L1" stroke="var(--color-line-l1)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="L2" stroke="var(--color-line-l2)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="L3" stroke="var(--color-line-l3)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
