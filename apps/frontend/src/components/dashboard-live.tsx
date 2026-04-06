'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/stat-card'
import { CurrentTrendChart } from '@/components/current-trend-chart'
import { formatJST, formatRelative } from '@/lib/format'
import { calcTotalPowerKw, formatPower } from '@/lib/power'
import type { PowerSettings } from '@/lib/power'
import { isCurrentIdle } from '@/lib/connection-status'

interface Props {
  devices: {
    enocean_device_id: string
    phase_type: string | null
    voltage_v: number | null
    power_factor: number | null
  }[]
  gatewayCount: number
  onlineGateways: number
}

const REFRESH_MS = 30_000

export function DashboardLive({ devices, gatewayCount, onlineGateways }: Props) {
  const [latestTime, setLatestTime] = useState<string | null>(null)
  const [dataCount, setDataCount] = useState(0)
  const [runningCount, setRunningCount] = useState(0)
  const [idleCount, setIdleCount] = useState(0)
  const [totalPower, setTotalPower] = useState<number | null>(null)
  const [powerDevices, setPowerDevices] = useState(0)
  const [chartData, setChartData] = useState<{ observed_at: string; avg_l1: number | null; avg_l2: number | null; avg_l3: number | null }[]>([])

  const powerSettingsMap = new Map<string, PowerSettings>()
  for (const d of devices) {
    powerSettingsMap.set(d.enocean_device_id, {
      phaseType: (d.phase_type ?? '3phase') as '3phase' | '1phase3w',
      voltageV: Number(d.voltage_v ?? 200),
      powerFactor: Number(d.power_factor ?? 0.80),
    })
  }

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    const { data: raw } = await supabase
      .from('telemetry_events')
      .select('observed_at, device_id, phase_l1_current_a, phase_l2_current_a, phase_l3_current_a')
      .gte('observed_at', oneDayAgo)
      .order('observed_at', { ascending: false })
      .limit(5000)

    if (!raw) return
    const telemetry = raw.reverse()

    // Chart data
    setChartData(telemetry.map((t) => ({
      observed_at: t.observed_at,
      avg_l1: t.phase_l1_current_a,
      avg_l2: t.phase_l2_current_a,
      avg_l3: t.phase_l3_current_a,
    })))

    // Data count
    setDataCount(telemetry.length)

    // Latest time
    if (telemetry.length > 0) {
      setLatestTime(telemetry[telemetry.length - 1].observed_at)
    }

    // Power calculation & status classification
    const latestByDevice = new Map<string, typeof telemetry[0]>()
    for (const t of telemetry) {
      latestByDevice.set(t.device_id, t)
    }

    // Active devices (last 10 min) split into running / idle
    let running = 0
    let idle = 0
    for (const [, t] of latestByDevice) {
      if (t.observed_at >= tenMinAgo) {
        if (isCurrentIdle(t.phase_l1_current_a, t.phase_l2_current_a, t.phase_l3_current_a)) {
          idle++
        } else {
          running++
        }
      }
    }
    setRunningCount(running)
    setIdleCount(idle)

    let pw = 0
    let pwCount = 0
    for (const [deviceId, t] of latestByDevice) {
      const settings = powerSettingsMap.get(deviceId)
      if (!settings) continue
      const p = calcTotalPowerKw(t.phase_l1_current_a, t.phase_l2_current_a, t.phase_l3_current_a, settings)
      if (p != null) {
        pw += p
        pwCount++
      }
    }
    setTotalPower(pwCount > 0 ? pw : null)
    setPowerDevices(pwCount)
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="稼働中"
          value={runningCount}
          sub={`停止 ${idleCount} / 全 ${devices.length} 台`}
          color={runningCount > 0 ? 'success' : 'default'}
        />
        <StatCard
          label="オンラインGW"
          value={onlineGateways}
          sub={`/ ${gatewayCount} 台`}
          color={onlineGateways > 0 ? 'success' : 'danger'}
        />
        <StatCard
          label="推定総電力"
          value={formatPower(totalPower)}
          sub={powerDevices > 0 ? `${powerDevices} 台分` : '---'}
          color="default"
        />
        <StatCard
          label="最新受信"
          value={latestTime ? formatJST(latestTime, 'HH:mm:ss') : '---'}
          sub={latestTime ? formatRelative(latestTime) : '受信なし'}
        />
        <StatCard
          label="24h データ件数"
          value={dataCount}
          sub="件"
        />
      </div>

      <div className="card-hmi p-5">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium mb-4">
          直近24時間 電流推移（全設備合算）
        </h3>
        <CurrentTrendChart data={chartData} />
      </div>
    </div>
  )
}
