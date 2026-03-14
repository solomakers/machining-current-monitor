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
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
        データがありません
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="time" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} unit=" A" />
        <Tooltip
          contentStyle={{ fontSize: 13 }}
          formatter={(value: unknown) => {
            const n = typeof value === 'number' ? value : null
            return n != null ? `${n.toFixed(1)} A` : '---'
          }}
        />
        <Legend />
        <Line type="monotone" dataKey="L1" stroke="#2563eb" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="L2" stroke="#16a34a" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="L3" stroke="#f59e0b" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}
