'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { formatJST, formatRelative } from '@/lib/format'

interface Alert {
  id: string
  machine_name: string | null
  alert_type: string
  severity: string
  message: string
  value_a: number | null
  threshold_a: number | null
  started_at: string
  ended_at: string | null
  acknowledged: boolean
}

interface AlertRule {
  id: string
  device_id: string
  phase: string
  condition: string
  threshold_a: number
  is_active: boolean
  device?: { machine_name: string | null; enocean_device_id: string }
}

interface Device {
  id: string
  machine_name: string | null
  enocean_device_id: string
}

const severityStyle: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
}

const phaseLabel: Record<string, string> = {
  l1: 'L1', l2: 'L2', l3: 'L3', any: '全相',
}

export default function AlertsPage() {
  const [tab, setTab] = useState<'history' | 'rules'>('history')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  // New rule form
  const [showForm, setShowForm] = useState(false)
  const [newDeviceId, setNewDeviceId] = useState('')
  const [newPhase, setNewPhase] = useState('any')
  const [newCondition, setNewCondition] = useState('above')
  const [newThreshold, setNewThreshold] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const fetchData = useCallback(async () => {
    const [alertsRes, rulesRes, devicesRes] = await Promise.all([
      supabase.from('alerts').select('*').order('started_at', { ascending: false }).limit(100),
      supabase.from('alert_rules').select('*, device:devices(machine_name, enocean_device_id)').order('created_at', { ascending: false }),
      supabase.from('devices').select('id, machine_name, enocean_device_id').eq('is_active', true).order('machine_name'),
    ])
    setAlerts(alertsRes.data ?? [])
    setRules(rulesRes.data ?? [])
    setDevices(devicesRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDeviceId || !newThreshold) return
    await supabase.from('alert_rules').insert({
      device_id: newDeviceId,
      phase: newPhase,
      condition: newCondition,
      threshold_a: parseFloat(newThreshold),
    })
    setShowForm(false)
    setNewThreshold('')
    fetchData()
  }

  const handleDeleteRule = async (id: string) => {
    await supabase.from('alert_rules').delete().eq('id', id)
    fetchData()
  }

  const handleToggleRule = async (id: string, isActive: boolean) => {
    await supabase.from('alert_rules').update({ is_active: !isActive }).eq('id', id)
    fetchData()
  }

  const handleAcknowledge = async (id: string) => {
    await supabase.from('alerts').update({ acknowledged: true }).eq('id', id)
    fetchData()
  }

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-6">アラート</h2>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center text-gray-500">
          読み込み中...
        </div>
      </div>
    )
  }

  const activeAlerts = alerts.filter((a) => !a.ended_at && !a.acknowledged)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">アラート</h2>
        {activeAlerts.length > 0 && (
          <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
            {activeAlerts.length} 件のアクティブアラート
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setTab('history')}
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${
            tab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          アラート履歴
        </button>
        <button
          onClick={() => setTab('rules')}
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${
            tab === 'rules' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          アラートルール
        </button>
      </div>

      {tab === 'history' ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">アラート履歴はありません</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">重要度</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">設備</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">内容</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">発生日時</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">状態</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${severityStyle[a.severity] ?? severityStyle.info}`}>
                        {a.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">{a.machine_name ?? '---'}</td>
                    <td className="px-4 py-3 text-gray-600">{a.message}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatJST(a.started_at)}
                      <br />
                      <span className="text-gray-400">{formatRelative(a.started_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {a.ended_at ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">解消</span>
                      ) : a.acknowledged ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">確認済</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">未確認</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!a.acknowledged && !a.ended_at && (
                        <button
                          onClick={() => handleAcknowledge(a.id)}
                          className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          確認
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                + ルールを追加
              </button>
            ) : (
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                <form onSubmit={handleAddRule} className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">設備</label>
                    <select
                      value={newDeviceId}
                      onChange={(e) => setNewDeviceId(e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1.5"
                      required
                    >
                      <option value="">選択...</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.machine_name ?? d.enocean_device_id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">対象相</label>
                    <select
                      value={newPhase}
                      onChange={(e) => setNewPhase(e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1.5"
                    >
                      <option value="any">全相</option>
                      <option value="l1">L1</option>
                      <option value="l2">L2</option>
                      <option value="l3">L3</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">条件</label>
                    <select
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1.5"
                    >
                      <option value="above">超過</option>
                      <option value="below">未満</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">閾値 (A)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newThreshold}
                      onChange={(e) => setNewThreshold(e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1.5 w-24"
                      placeholder="10.0"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-sm px-4 py-1.5 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300"
                  >
                    キャンセル
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
            {rules.length === 0 ? (
              <div className="p-8 text-center text-gray-500">アラートルールがありません</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">設備</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">対象</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">条件</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">有効</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => {
                    const dev = r.device as unknown as { machine_name: string | null; enocean_device_id: string } | null
                    return (
                      <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {dev?.machine_name ?? dev?.enocean_device_id ?? '---'}
                        </td>
                        <td className="px-4 py-3 font-mono">{phaseLabel[r.phase] ?? r.phase}</td>
                        <td className="px-4 py-3">
                          {r.condition === 'above' ? '>' : '<'} {r.threshold_a} A
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleRule(r.id, r.is_active)}
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {r.is_active ? 'ON' : 'OFF'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteRule(r.id)}
                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
