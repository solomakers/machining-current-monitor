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

const severityBadge: Record<string, string> = {
  critical: 'badge-danger',
  warning: 'badge-warning',
  info: 'badge-info',
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
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-6">アラート</h2>
        <div className="card-hmi p-8 text-center text-[var(--color-text-dim)] font-mono text-sm animate-pulse">
          LOADING...
        </div>
      </div>
    )
  }

  const activeAlerts = alerts.filter((a) => !a.ended_at && !a.acknowledged)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">アラート</h2>
        {activeAlerts.length > 0 && (
          <span className="badge badge-danger font-[JetBrains_Mono,monospace]">
            {activeAlerts.length} 件のアクティブアラート
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setTab('history')}
          className={`tab-hmi ${tab === 'history' ? 'tab-hmi-active' : 'tab-hmi-inactive'}`}
        >
          アラート履歴
        </button>
        <button
          onClick={() => setTab('rules')}
          className={`tab-hmi ${tab === 'rules' ? 'tab-hmi-active' : 'tab-hmi-inactive'}`}
        >
          アラートルール
        </button>
      </div>

      {tab === 'history' ? (
        <div className="card-hmi overflow-hidden">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-text-dim)] font-mono text-sm">アラート履歴はありません</div>
          ) : (
            <table className="w-full text-sm table-hmi">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3">重要度</th>
                  <th className="text-left px-4 py-3">設備</th>
                  <th className="text-left px-4 py-3">内容</th>
                  <th className="text-left px-4 py-3">発生日時</th>
                  <th className="text-left px-4 py-3">状態</th>
                  <th className="text-center px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <span className={`badge ${severityBadge[a.severity] ?? severityBadge.info}`}>
                        {a.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text)]">{a.machine_name ?? '---'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{a.message}</td>
                    <td className="px-4 py-3 text-xs font-mono">
                      <span className="text-[var(--color-text-muted)]">{formatJST(a.started_at)}</span>
                      <br />
                      <span className="text-[var(--color-text-dim)]">{formatRelative(a.started_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {a.ended_at ? (
                        <span className="badge badge-success">解消</span>
                      ) : a.acknowledged ? (
                        <span className="badge badge-neutral">確認済</span>
                      ) : (
                        <span className="badge badge-danger">未確認</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!a.acknowledged && !a.ended_at && (
                        <button
                          onClick={() => handleAcknowledge(a.id)}
                          className="btn-ghost text-xs px-3 py-1"
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
                className="btn-primary text-sm"
              >
                + ルールを追加
              </button>
            ) : (
              <div className="card-hmi p-4">
                <form onSubmit={handleAddRule} className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1.5">設備</label>
                    <select
                      value={newDeviceId}
                      onChange={(e) => setNewDeviceId(e.target.value)}
                      className="input-hmi text-sm"
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
                    <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1.5">対象相</label>
                    <select
                      value={newPhase}
                      onChange={(e) => setNewPhase(e.target.value)}
                      className="input-hmi text-sm"
                    >
                      <option value="any">全相</option>
                      <option value="l1">L1</option>
                      <option value="l2">L2</option>
                      <option value="l3">L3</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1.5">条件</label>
                    <select
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value)}
                      className="input-hmi text-sm"
                    >
                      <option value="above">超過</option>
                      <option value="below">未満</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1.5">閾値 (A)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newThreshold}
                      onChange={(e) => setNewThreshold(e.target.value)}
                      className="input-hmi text-sm w-24 font-[JetBrains_Mono,monospace]"
                      placeholder="10.0"
                      required
                    />
                  </div>
                  <button type="submit" className="btn-primary text-sm">
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-ghost text-sm"
                  >
                    キャンセル
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="card-hmi overflow-hidden">
            {rules.length === 0 ? (
              <div className="p-8 text-center text-[var(--color-text-dim)] font-mono text-sm">アラートルールがありません</div>
            ) : (
              <table className="w-full text-sm table-hmi">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3">設備</th>
                    <th className="text-left px-4 py-3">対象</th>
                    <th className="text-left px-4 py-3">条件</th>
                    <th className="text-center px-4 py-3">有効</th>
                    <th className="text-center px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => {
                    const dev = r.device as unknown as { machine_name: string | null; enocean_device_id: string } | null
                    return (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-[var(--color-text)]">
                          {dev?.machine_name ?? dev?.enocean_device_id ?? '---'}
                        </td>
                        <td className="px-4 py-3 font-[JetBrains_Mono,monospace] text-[var(--color-primary)]">
                          {phaseLabel[r.phase] ?? r.phase}
                        </td>
                        <td className="px-4 py-3 font-[JetBrains_Mono,monospace] text-[var(--color-text-muted)]">
                          {r.condition === 'above' ? '>' : '<'} {r.threshold_a} A
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleRule(r.id, r.is_active)}
                            className={`badge cursor-pointer ${r.is_active ? 'badge-success' : 'badge-neutral'}`}
                          >
                            {r.is_active ? 'ON' : 'OFF'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteRule(r.id)}
                            className="btn-danger-ghost"
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
