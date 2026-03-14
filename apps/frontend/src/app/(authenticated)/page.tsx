import { createSupabaseServerClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/stat-card'
import { CurrentTrendChart } from '@/components/current-trend-chart'
import { formatJST, formatRelative } from '@/lib/format'

export const revalidate = 30 // ISR: refresh every 30s

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  // Active devices: devices that sent data in the last 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: recentDevices } = await supabase
    .from('telemetry_events')
    .select('device_id')
    .gte('observed_at', tenMinAgo)

  const activeDeviceIds = new Set(recentDevices?.map((r) => r.device_id) ?? [])

  // Total registered devices
  const { count: totalDevices } = await supabase
    .from('devices')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // Latest telemetry timestamp
  const { data: latestEvent } = await supabase
    .from('telemetry_events')
    .select('observed_at')
    .order('observed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Gateways status
  const { data: gateways } = await supabase.from('gateways').select('status')
  const onlineGateways = gateways?.filter((g) => g.status === 'online').length ?? 0

  // 24h hourly average for chart (using raw query via RPC would be better,
  // but for now we fetch recent data and aggregate client-side)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentTelemetry } = await supabase
    .from('telemetry_events')
    .select('observed_at, phase_l1_current_a, phase_l2_current_a, phase_l3_current_a')
    .gte('observed_at', oneDayAgo)
    .order('observed_at', { ascending: true })
    .limit(2000)

  // Aggregate into hourly buckets
  const hourlyBuckets = new Map<
    string,
    { sumL1: number; sumL2: number; sumL3: number; count: number }
  >()
  for (const t of recentTelemetry ?? []) {
    const hour = t.observed_at.slice(0, 13) + ':00:00Z'
    const bucket = hourlyBuckets.get(hour) ?? { sumL1: 0, sumL2: 0, sumL3: 0, count: 0 }
    bucket.sumL1 += t.phase_l1_current_a ?? 0
    bucket.sumL2 += t.phase_l2_current_a ?? 0
    bucket.sumL3 += t.phase_l3_current_a ?? 0
    bucket.count++
    hourlyBuckets.set(hour, bucket)
  }

  const chartData = Array.from(hourlyBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, b]) => ({
      observed_at: hour,
      avg_l1: b.count > 0 ? b.sumL1 / b.count : null,
      avg_l2: b.count > 0 ? b.sumL2 / b.count : null,
      avg_l3: b.count > 0 ? b.sumL3 / b.count : null,
    }))

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">ダッシュボード</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="通信中の設備"
          value={activeDeviceIds.size}
          sub={`/ ${totalDevices ?? 0} 台`}
          color={activeDeviceIds.size > 0 ? 'success' : 'warning'}
        />
        <StatCard
          label="オンラインGW"
          value={onlineGateways}
          sub={`/ ${gateways?.length ?? 0} 台`}
          color={onlineGateways > 0 ? 'success' : 'danger'}
        />
        <StatCard
          label="最新受信"
          value={latestEvent ? formatJST(latestEvent.observed_at, 'HH:mm:ss') : '---'}
          sub={latestEvent ? formatRelative(latestEvent.observed_at) : '受信なし'}
        />
        <StatCard
          label="24h データ件数"
          value={recentTelemetry?.length ?? 0}
          sub="件"
        />
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          直近24時間 平均電流推移（全設備合算）
        </h3>
        <CurrentTrendChart data={chartData} />
      </div>
    </div>
  )
}
