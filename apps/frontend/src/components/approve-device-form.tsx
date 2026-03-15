'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface Props {
  deviceId: string
  gatewayId: string | null
  onApproved: () => void
}

export function ApproveDeviceForm({ deviceId, gatewayId, onApproved }: Props) {
  const [open, setOpen] = useState(false)
  const [machineName, setMachineName] = useState('')
  const [machineId, setMachineId] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-primary text-xs py-1 px-3"
      >
        登録
      </button>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!machineName.trim()) {
      setError('設備名は必須です')
      return
    }
    setSubmitting(true)
    setError(null)

    // Insert into devices table
    const { error: insertErr } = await supabase.from('devices').insert({
      enocean_device_id: deviceId,
      machine_name: machineName.trim(),
      machine_id: machineId.trim() || null,
      site_code: siteCode.trim() || null,
      is_active: true,
      installed_at: new Date().toISOString(),
    })

    if (insertErr) {
      setError(insertErr.message)
      setSubmitting(false)
      return
    }

    // Remove from unknown_devices
    await supabase.from('unknown_devices').delete().eq('device_id', deviceId)

    setSubmitting(false)
    onApproved()
  }

  return (
    <div className="card-hmi p-3 mt-1">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1">設備名 *</label>
          <input
            type="text"
            value={machineName}
            onChange={(e) => setMachineName(e.target.value)}
            placeholder="例: MC-001 横型マシニングセンタ"
            className="input-hmi w-full text-sm"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1">設備ID</label>
            <input
              type="text"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              placeholder="例: mc-001"
              className="input-hmi w-full text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1">サイトコード</label>
            <input
              type="text"
              value={siteCode}
              onChange={(e) => setSiteCode(e.target.value)}
              placeholder="例: tokyo-factory"
              className="input-hmi w-full text-sm"
            />
          </div>
        </div>
        <p className="text-[10px] text-[var(--color-text-dim)] font-mono">GW: {gatewayId ?? '不明'}</p>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-xs py-1"
          >
            {submitting ? '登録中...' : '設備を登録'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-ghost text-xs py-1"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}
