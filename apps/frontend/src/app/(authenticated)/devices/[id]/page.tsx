import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatJST, formatCurrent, formatRelative } from '@/lib/format'
import { DeviceDetailChart } from '@/components/device-detail-chart'
import { CsvExportButton } from '@/components/csv-export-button'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const revalidate = 15

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: device } = await supabase.from('devices').select('*').eq('id', id).maybeSingle()
  if (!device) notFound()

  // Latest telemetry
  const { data: latest } = await supabase
    .from('telemetry_events')
    .select('*')
    .eq('device_id', device.enocean_device_id)
    .order('observed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 24h data for chart
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: chartRaw } = await supabase
    .from('telemetry_events')
    .select('observed_at, phase_l1_current_a, phase_l2_current_a, phase_l3_current_a')
    .eq('device_id', device.enocean_device_id)
    .gte('observed_at', oneDayAgo)
    .order('observed_at', { ascending: true })
    .limit(5000)

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const isOnline = latest && latest.observed_at >= tenMinAgo

  // Phase imbalance (max-min / avg * 100)
  let imbalance: string | null = null
  if (latest) {
    const vals = [latest.phase_l1_current_a, latest.phase_l2_current_a, latest.phase_l3_current_a].filter(
      (v): v is number => v != null,
    )
    if (vals.length === 3) {
      const max = Math.max(...vals)
      const min = Math.min(...vals)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      if (avg > 0) {
        imbalance = (((max - min) / avg) * 100).toFixed(1) + '%'
      }
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/devices" className="text-sm text-blue-600 hover:underline">
          ← 設備一覧
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          {device.machine_name ?? device.enocean_device_id}
        </h2>
        {latest == null ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            データ未受信
          </span>
        ) : isOnline ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            通信中
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">通信断</span>
        )}
      </div>

      {/* Current values */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-gray-500 mb-1">L1 電流</p>
          <p className="text-xl font-bold text-blue-600 font-mono">
            {formatCurrent(latest?.phase_l1_current_a)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-gray-500 mb-1">L2 電流</p>
          <p className="text-xl font-bold text-green-600 font-mono">
            {formatCurrent(latest?.phase_l2_current_a)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-gray-500 mb-1">L3 電流</p>
          <p className="text-xl font-bold text-amber-500 font-mono">
            {formatCurrent(latest?.phase_l3_current_a)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-gray-500 mb-1">相アンバランス</p>
          <p className="text-xl font-bold text-gray-800 font-mono">{imbalance ?? '---'}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">電流推移</h3>
          <CsvExportButton deviceId={device.enocean_device_id} deviceName={device.machine_name ?? device.enocean_device_id} />
        </div>
        <DeviceDetailChart deviceId={device.enocean_device_id} initialData={chartRaw ?? []} />
      </div>

      {/* Device info */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">デバイス情報</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-100">
            <dt className="text-gray-500">設備ID</dt>
            <dd className="text-gray-800 font-mono">{device.machine_id ?? '---'}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <dt className="text-gray-500">EnOcean ID</dt>
            <dd className="text-gray-800 font-mono">{device.enocean_device_id}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <dt className="text-gray-500">サイトコード</dt>
            <dd className="text-gray-800">{device.site_code ?? '---'}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <dt className="text-gray-500">最終受信</dt>
            <dd className="text-gray-800">
              {latest ? `${formatJST(latest.observed_at)} (${formatRelative(latest.observed_at)})` : '---'}
            </dd>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <dt className="text-gray-500">ゲートウェイ</dt>
            <dd className="text-gray-800 font-mono">{latest?.gateway_id ?? '---'}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <dt className="text-gray-500">設置日</dt>
            <dd className="text-gray-800">
              {device.installed_at ? formatJST(device.installed_at, 'yyyy/MM/dd') : '---'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
