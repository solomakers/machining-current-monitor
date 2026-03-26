import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DashboardLive } from '@/components/dashboard-live'

export const revalidate = 60

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const { data: devices } = await supabase
    .from('devices')
    .select('enocean_device_id, phase_type, voltage_v, power_factor')
    .eq('is_active', true)

  const { data: gateways } = await supabase.from('gateways').select('status')
  const onlineGateways = gateways?.filter((g) => g.status === 'online').length ?? 0

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-6">ダッシュボード</h2>
      <DashboardLive
        devices={devices ?? []}
        gatewayCount={gateways?.length ?? 0}
        onlineGateways={onlineGateways}
      />
    </div>
  )
}
