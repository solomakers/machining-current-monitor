import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatJST, formatCurrent, formatRelative } from '@/lib/format'
import { calcTotalPowerKw, formatPower } from '@/lib/power'
import { isCurrentIdle, isBelowSensorThreshold, STATUS_CONFIG } from '@/lib/connection-status'
import type { ConnectionStatus } from '@/lib/connection-status'
import { DeviceDetailChart } from '@/components/device-detail-chart'
import { CsvExportButton } from '@/components/csv-export-button'
import { PowerSettingsPanel } from '@/components/power-settings-panel'
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
  const { data: chartRawDesc } = await supabase
    .from('telemetry_events')
    .select('observed_at, phase_l1_current_a, phase_l2_current_a, phase_l3_current_a')
    .eq('device_id', device.enocean_device_id)
    .gte('observed_at', oneDayAgo)
    .order('observed_at', { ascending: false })
    .limit(5000)
  const chartRaw = chartRawDesc?.reverse() ?? []

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const isOnline = latest && latest.observed_at >= tenMinAgo

  // ゲートウェイのheartbeat情報を取得
  const { data: latestHeartbeat } = await supabase
    .from('gateway_heartbeats')
    .select('*')
    .eq('gateway_id', latest?.gateway_id ?? 'gw-001')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const gwHeartbeatRecent = latestHeartbeat && latestHeartbeat.sent_at >= tenMinAgo

  // 5状態の判定
  let connectionStatus: ConnectionStatus = 'no-data'
  if (latest == null) {
    connectionStatus = 'no-data'
  } else if (isOnline) {
    connectionStatus = isCurrentIdle(latest.phase_l1_current_a, latest.phase_l2_current_a, latest.phase_l3_current_a)
      ? 'idle'
      : 'online'
  } else if (gwHeartbeatRecent) {
    // GWは生きているがデータが来ない → 最後の電流値がセンサ下限未満なら停止中
    connectionStatus = isBelowSensorThreshold(latest.phase_l1_current_a, latest.phase_l2_current_a, latest.phase_l3_current_a)
      ? 'idle'
      : 'sensor-down'
  } else {
    connectionStatus = 'wifi-down'
  }

  // Power settings from device
  const powerSettings = {
    phaseType: (device.phase_type ?? '3phase') as '3phase' | '1phase3w',
    voltageV: Number(device.voltage_v ?? 200),
    powerFactor: Number(device.power_factor ?? 0.80),
  }

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

  // Power calculation
  const totalPowerKw = latest
    ? calcTotalPowerKw(
        latest.phase_l1_current_a,
        latest.phase_l2_current_a,
        latest.phase_l3_current_a,
        powerSettings,
      )
    : null

  return (
    <div>
      <div className="mb-6">
        <Link href="/devices" className="text-sm text-[var(--color-primary-dim)] hover:text-[var(--color-primary)] transition-colors font-mono">
          ← 設備一覧
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">
          {device.machine_name ?? device.enocean_device_id}
        </h2>
        <span className={`badge ${STATUS_CONFIG[connectionStatus].badge}`}>
          {STATUS_CONFIG[connectionStatus].label}
        </span>
        <span className="badge badge-neutral font-mono">
          {powerSettings.phaseType === '3phase' ? '三相' : '単相'} {powerSettings.voltageV}V
        </span>
      </div>

      {/* Current & Power values */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="card-hmi p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1.5">L1 電流</p>
          <p className="text-xl font-bold font-[JetBrains_Mono,monospace] text-[var(--color-line-l1)] glow-cyan">
            {formatCurrent(latest?.phase_l1_current_a)}
          </p>
        </div>
        <div className="card-hmi p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1.5">L2 電流</p>
          <p className="text-xl font-bold font-[JetBrains_Mono,monospace] text-[var(--color-line-l2)] glow-green">
            {formatCurrent(latest?.phase_l2_current_a)}
          </p>
        </div>
        <div className="card-hmi p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1.5">L3 電流</p>
          <p className="text-xl font-bold font-[JetBrains_Mono,monospace] text-[var(--color-line-l3)] glow-amber">
            {formatCurrent(latest?.phase_l3_current_a)}
          </p>
        </div>
        <div className="card-hmi p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1.5">推定電力</p>
          <p className="text-xl font-bold font-[JetBrains_Mono,monospace] text-[var(--color-power)] glow-purple">
            {formatPower(totalPowerKw)}
          </p>
          <p className="text-[10px] text-[var(--color-text-dim)] mt-0.5 font-mono">
            cosφ={powerSettings.powerFactor}
          </p>
        </div>
        <div className="card-hmi p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1.5">相アンバランス</p>
          <p className="text-xl font-bold font-[JetBrains_Mono,monospace] text-[var(--color-text)]">
            {imbalance ?? '---'}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="card-hmi p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium">
            電流推移
          </h3>
          <CsvExportButton deviceId={device.enocean_device_id} deviceName={device.machine_name ?? device.enocean_device_id} />
        </div>
        <DeviceDetailChart deviceId={device.enocean_device_id} initialData={chartRaw ?? []} powerSettings={powerSettings} />
      </div>

      {/* Power settings */}
      <div className="card-hmi p-5 mb-6">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium mb-4">
          電力設定
        </h3>
        <PowerSettingsPanel
          deviceId={device.id}
          phaseType={powerSettings.phaseType}
          voltageV={powerSettings.voltageV}
          powerFactor={powerSettings.powerFactor}
        />
      </div>

      {/* Device info */}
      <div className="card-hmi p-5">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium mb-4">
          デバイス情報
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
            <dt className="text-[var(--color-text-muted)]">設備ID</dt>
            <dd className="text-[var(--color-text)] font-[JetBrains_Mono,monospace] text-xs">{device.machine_id ?? '---'}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
            <dt className="text-[var(--color-text-muted)]">EnOcean ID</dt>
            <dd className="text-[var(--color-text)] font-[JetBrains_Mono,monospace] text-xs">{device.enocean_device_id}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
            <dt className="text-[var(--color-text-muted)]">サイトコード</dt>
            <dd className="text-[var(--color-text)]">{device.site_code ?? '---'}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
            <dt className="text-[var(--color-text-muted)]">最終受信</dt>
            <dd className="text-[var(--color-text)] font-mono text-xs">
              {latest ? `${formatJST(latest.observed_at)} (${formatRelative(latest.observed_at)})` : '---'}
            </dd>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
            <dt className="text-[var(--color-text-muted)]">ゲートウェイ</dt>
            <dd className="text-[var(--color-text)] font-[JetBrains_Mono,monospace] text-xs">{latest?.gateway_id ?? '---'}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
            <dt className="text-[var(--color-text-muted)]">設置日</dt>
            <dd className="text-[var(--color-text)]">
              {device.installed_at ? formatJST(device.installed_at, 'yyyy/MM/dd') : '---'}
            </dd>
          </div>
        </dl>
      </div>

      {/* 通信診断パネル（障害時のみ表示） */}
      {(connectionStatus === 'sensor-down' || connectionStatus === 'wifi-down') && (
        <div className="card-hmi p-5 mt-4 border-l-2 border-[var(--color-warning)]">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium mb-3">
            通信診断
          </h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between py-1">
              <dt className="text-[var(--color-text-muted)]">ゲートウェイ</dt>
              <dd className="font-[JetBrains_Mono,monospace] text-xs text-[var(--color-text)]">{latest?.gateway_id ?? '---'}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-[var(--color-text-muted)]">GW最終通信</dt>
              <dd className="font-mono text-xs text-[var(--color-text)]">
                {latestHeartbeat ? `${formatJST(latestHeartbeat.sent_at)} (${formatRelative(latestHeartbeat.sent_at)})` : '---'}
              </dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-[var(--color-text-muted)]">GW状態</dt>
              <dd className="text-[var(--color-text)]">{latestHeartbeat?.status ?? '---'}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-[var(--color-text-muted)]">スプール件数</dt>
              <dd className="font-mono text-xs text-[var(--color-text)]">{latestHeartbeat?.spool_depth ?? '---'}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-[var(--color-text-muted)]">GW最終受信</dt>
              <dd className="font-mono text-xs text-[var(--color-text)]">
                {latestHeartbeat?.last_received_at ? `${formatJST(latestHeartbeat.last_received_at)} (${formatRelative(latestHeartbeat.last_received_at)})` : '---'}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
