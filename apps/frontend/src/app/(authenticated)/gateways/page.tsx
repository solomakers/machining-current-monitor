import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatJST, formatRelative } from '@/lib/format'

export const revalidate = 30

export default async function GatewaysPage() {
  const supabase = await createSupabaseServerClient()

  const { data: gateways } = await supabase
    .from('gateways')
    .select('*')
    .order('name', { ascending: true })

  // Get latest heartbeat per gateway
  const latestHeartbeats = new Map<
    string,
    { status: string; spool_depth: number; sent_at: string; uptime_sec: number | null }
  >()

  if (gateways && gateways.length > 0) {
    const gwNames = gateways.map((g) => g.name)
    const { data: heartbeats } = await supabase
      .from('gateway_heartbeats')
      .select('gateway_id, status, spool_depth, sent_at, uptime_sec')
      .in('gateway_id', gwNames)
      .order('sent_at', { ascending: false })
      .limit(gwNames.length * 2)

    for (const hb of heartbeats ?? []) {
      if (!latestHeartbeats.has(hb.gateway_id)) {
        latestHeartbeats.set(hb.gateway_id, hb)
      }
    }
  }

  const statusColors: Record<string, string> = {
    online: 'bg-green-100 text-green-700',
    degraded: 'bg-amber-100 text-amber-700',
    offline: 'bg-red-100 text-red-700',
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">ゲートウェイ状態</h2>

      {!gateways || gateways.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center text-gray-500">
          登録済みゲートウェイがありません
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gateways.map((gw) => {
            const hb = latestHeartbeats.get(gw.name)
            const statusClass = statusColors[gw.status] ?? statusColors.offline

            return (
              <div
                key={gw.id}
                className="bg-white rounded-xl border border-[var(--color-border)] p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-800">{gw.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass}`}>
                    {gw.status}
                  </span>
                </div>
                <dl className="text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">サイト</dt>
                    <dd className="text-gray-800">{gw.site_code ?? '---'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">最終通信</dt>
                    <dd className="text-gray-800">
                      {gw.last_seen_at
                        ? `${formatJST(gw.last_seen_at, 'MM/dd HH:mm:ss')} (${formatRelative(gw.last_seen_at)})`
                        : '---'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">スプール件数</dt>
                    <dd className="text-gray-800 font-mono">{hb?.spool_depth ?? '---'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">稼働時間</dt>
                    <dd className="text-gray-800">
                      {hb?.uptime_sec != null
                        ? `${Math.floor(hb.uptime_sec / 3600)}h ${Math.floor((hb.uptime_sec % 3600) / 60)}m`
                        : '---'}
                    </dd>
                  </div>
                </dl>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
