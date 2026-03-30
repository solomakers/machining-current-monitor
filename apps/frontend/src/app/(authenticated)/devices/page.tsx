import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatJST, formatCurrent } from '@/lib/format'
import { calcTotalPowerKw, formatPower } from '@/lib/power'
import type { PowerSettings } from '@/lib/power'
import Link from 'next/link'

export const revalidate = 30

export default async function DevicesPage() {
  const supabase = await createSupabaseServerClient()

  const { data: devices } = await supabase
    .from('devices')
    .select('*')
    .eq('is_active', true)
    .order('machine_name', { ascending: true })

  // Get latest telemetry for each device
  const deviceIds = devices?.map((d) => d.enocean_device_id) ?? []
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  // Fetch latest telemetry per device
  const latestByDevice = new Map<
    string,
    {
      observed_at: string
      phase_l1_current_a: number | null
      phase_l2_current_a: number | null
      phase_l3_current_a: number | null
    }
  >()

  if (deviceIds.length > 0) {
    const { data: telemetry } = await supabase
      .from('telemetry_events')
      .select('device_id, observed_at, phase_l1_current_a, phase_l2_current_a, phase_l3_current_a')
      .in('device_id', deviceIds)
      .order('observed_at', { ascending: false })
      .limit(deviceIds.length * 2)

    for (const t of telemetry ?? []) {
      if (!latestByDevice.has(t.device_id)) {
        latestByDevice.set(t.device_id, t)
      }
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-6">設備一覧</h2>

      {!devices || devices.length === 0 ? (
        <div className="card-hmi p-8 text-center text-[var(--color-text-dim)] font-mono text-sm">
          登録済み設備がありません
        </div>
      ) : (
        <div className="card-hmi overflow-hidden">
          <table className="w-full text-sm table-hmi">
            <thead>
              <tr>
                <th className="text-left px-4 py-3">設備名</th>
                <th className="text-left px-4 py-3">種別</th>
                <th className="text-right px-4 py-3">L1</th>
                <th className="text-right px-4 py-3">L2</th>
                <th className="text-right px-4 py-3">L3</th>
                <th className="text-right px-4 py-3">推定電力</th>
                <th className="text-left px-4 py-3">最終受信</th>
                <th className="text-center px-4 py-3">状態</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const latest = latestByDevice.get(device.enocean_device_id)
                const isOnline = latest && latest.observed_at >= tenMinAgo

                const powerSettings: PowerSettings = {
                  phaseType: (device.phase_type ?? '3phase') as '3phase' | '1phase3w',
                  voltageV: Number(device.voltage_v ?? 200),
                  powerFactor: Number(device.power_factor ?? 0.80),
                }
                const power = latest
                  ? calcTotalPowerKw(
                      latest.phase_l1_current_a,
                      latest.phase_l2_current_a,
                      latest.phase_l3_current_a,
                      powerSettings,
                    )
                  : null

                return (
                  <tr key={device.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/devices/${device.id}`}
                        className="text-[var(--color-primary)] hover:text-[#33ddff] font-medium transition-colors"
                      >
                        {device.machine_name ?? device.enocean_device_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-dim)] text-xs font-mono">
                      {powerSettings.phaseType === '3phase' ? '3φ3W' : '1φ3W'} {powerSettings.voltageV}V
                    </td>
                    <td className="px-4 py-3 text-right font-[JetBrains_Mono,monospace] text-[var(--color-line-l1)]">
                      {formatCurrent(latest?.phase_l1_current_a)}
                    </td>
                    <td className="px-4 py-3 text-right font-[JetBrains_Mono,monospace] text-[var(--color-line-l2)]">
                      {formatCurrent(latest?.phase_l2_current_a)}
                    </td>
                    <td className="px-4 py-3 text-right font-[JetBrains_Mono,monospace] text-[var(--color-line-l3)]">
                      {formatCurrent(latest?.phase_l3_current_a)}
                    </td>
                    <td className="px-4 py-3 text-right font-[JetBrains_Mono,monospace] text-[var(--color-power)]">
                      {formatPower(power)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-dim)] text-xs font-mono">
                      {latest ? formatJST(latest.observed_at) : '---'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {latest == null ? (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-text-dim)]" title="データ未受信" />
                      ) : isOnline ? (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-success)] pulse-live" title="通信中" />
                      ) : (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-danger)] pulse-danger" title="通信断" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
