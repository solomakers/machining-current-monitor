'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

interface Props {
  deviceId: string
  phaseType: '3phase' | '1phase'
  voltageV: number
  powerFactor: number
}

export function PowerSettingsPanel({ deviceId, phaseType, voltageV, powerFactor }: Props) {
  const [phase, setPhase] = useState(phaseType)
  const [voltage, setVoltage] = useState(String(voltageV))
  const [pf, setPf] = useState(String(powerFactor))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const handleSave = async () => {
    const v = parseFloat(voltage)
    const p = parseFloat(pf)
    if (isNaN(v) || v <= 0) { setError('電圧は正の数を入力してください'); return }
    if (isNaN(p) || p <= 0 || p > 1) { setError('力率は 0.01〜1.00 の範囲で入力してください'); return }

    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: err } = await supabase
      .from('devices')
      .update({
        phase_type: phase,
        voltage_v: v,
        power_factor: p,
      })
      .eq('id', deviceId)

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const hasChanges =
    phase !== phaseType ||
    voltage !== String(voltageV) ||
    pf !== String(powerFactor)

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div>
        <label className="text-xs text-gray-600 block mb-1">交流種別</label>
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as '3phase' | '1phase')}
          className="text-sm border border-gray-300 rounded px-2 py-1.5"
        >
          <option value="3phase">三相交流</option>
          <option value="1phase">単相交流</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-600 block mb-1">線間電圧 (V)</label>
        <select
          value={voltage}
          onChange={(e) => setVoltage(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1.5"
        >
          <option value="100">100V</option>
          <option value="200">200V</option>
          <option value="400">400V</option>
          <option value="440">440V</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-600 block mb-1">力率 (cosφ)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max="1.00"
          value={pf}
          onChange={(e) => setPf(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1.5 w-20 font-mono"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        {saved && <span className="text-xs text-green-600">保存しました</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      <div className="w-full text-xs text-gray-400 mt-1">
        {phase === '3phase'
          ? `計算式: P = √3 × ${voltage}V × I_avg × ${pf}`
          : `計算式: P = ${voltage}V × I × ${pf}`
        }
      </div>
    </div>
  )
}
