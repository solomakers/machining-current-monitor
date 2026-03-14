import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatJST } from '@/lib/format'

export const revalidate = 30

export default async function UnknownDevicesPage() {
  const supabase = await createSupabaseServerClient()

  const { data: unknowns } = await supabase
    .from('unknown_devices')
    .select('*')
    .order('last_seen_at', { ascending: false })

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">未登録デバイス</h2>

      {!unknowns || unknowns.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center text-gray-500">
          未登録デバイスはありません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">デバイスID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ゲートウェイ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">初回検知</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">最終検知</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">検知回数</th>
              </tr>
            </thead>
            <tbody>
              {unknowns.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-mono text-xs">{d.device_id}</td>
                  <td className="px-4 py-3 text-gray-500">{d.gateway_id ?? '---'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatJST(d.first_seen_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatJST(d.last_seen_at)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{d.seen_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
