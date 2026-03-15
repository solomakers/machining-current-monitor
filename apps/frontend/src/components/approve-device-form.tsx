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
        className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
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
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-1">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block mb-0.5">設備名 *</label>
          <input
            type="text"
            value={machineName}
            onChange={(e) => setMachineName(e.target.value)}
            placeholder="例: MC-001 横型マシニングセンタ"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-600 block mb-0.5">設備ID</label>
            <input
              type="text"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              placeholder="例: mc-001"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-0.5">サイトコード</label>
            <input
              type="text"
              value={siteCode}
              onChange={(e) => setSiteCode(e.target.value)}
              placeholder="例: tokyo-factory"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">ゲートウェイ: {gatewayId ?? '不明'}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '登録中...' : '設備を登録'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs px-3 py-1 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}
