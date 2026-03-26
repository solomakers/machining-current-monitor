'use client'

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

interface DataPoint {
  observed_at: string
  avg_l1: number | null
  avg_l2: number | null
  avg_l3: number | null
}

export function CurrentTrendChart({ data }: { data: DataPoint[] }) {
  const chartData = data.map((d) => ({
    time: formatJST(d.observed_at, 'HH:mm'),
    L1: d.avg_l1,
    L2: d.avg_l2,
    L3: d.avg_l3,
  }))

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[var(--color-text-dim)] text-sm font-mono">
        NO DATA
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: 'var(--color-text-dim)', fontFamily: 'JetBrains Mono, monospace' }}
          stroke="var(--color-border-accent)"
          interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
          angle={-35}
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
        <Legend
          wrapperStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
        />
        <Line type="monotone" dataKey="L1" stroke="var(--color-line-l1)" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="L2" stroke="var(--color-line-l2)" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="L3" stroke="var(--color-line-l3)" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}
