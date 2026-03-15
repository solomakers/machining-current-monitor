import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatJST, formatRelative } from '@/lib/format'
import { ConnectionTestButton } from '@/components/connection-test-button'

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

  const statusBadge: Record<string, string> = {
    online: 'badge-success',
    degraded: 'badge-warning',
    offline: 'badge-danger',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">ゲートウェイ状態</h2>
        <ConnectionTestButton />
      </div>

      {!gateways || gateways.length === 0 ? (
        <div className="card-hmi p-8 text-center text-[var(--color-text-dim)] font-mono text-sm">
          登録済みゲートウェイがありません
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gateways.map((gw) => {
            const hb = latestHeartbeats.get(gw.name)
            const badgeClass = statusBadge[gw.status] ?? statusBadge.offline

            return (
              <div key={gw.id} className="card-hmi p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-[var(--color-text)]">{gw.name}</h3>
                  <span className={`badge ${badgeClass}`}>
                    {gw.status}
                  </span>
                </div>
                <dl className="text-sm space-y-2.5">
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-muted)]">サイト</dt>
                    <dd className="text-[var(--color-text)]">{gw.site_code ?? '---'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-muted)]">最終通信</dt>
                    <dd className="text-[var(--color-text)] font-mono text-xs">
                      {gw.last_seen_at
                        ? `${formatJST(gw.last_seen_at, 'MM/dd HH:mm:ss')} (${formatRelative(gw.last_seen_at)})`
                        : '---'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-muted)]">スプール件数</dt>
                    <dd className="text-[var(--color-text)] font-[JetBrains_Mono,monospace]">{hb?.spool_depth ?? '---'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-muted)]">稼働時間</dt>
                    <dd className="text-[var(--color-text)] font-[JetBrains_Mono,monospace]">
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
