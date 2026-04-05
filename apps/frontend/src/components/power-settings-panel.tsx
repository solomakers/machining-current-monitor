'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

interface Props {
  deviceId: string
  phaseType: '3phase' | '1phase3w'
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
        <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1.5">交流種別</label>
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as '3phase' | '1phase3w')}
          className="input-hmi text-sm"
        >
          <option value="3phase">三相3線式</option>
          <option value="1phase3w">単相3線式</option>
        </select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1.5">電圧 (V)</label>
        <input
          type="number"
          step="1"
          min="1"
          value={voltage}
          onChange={(e) => setVoltage(e.target.value)}
          className="input-hmi text-sm w-20 font-[JetBrains_Mono,monospace]"
        />
      </div>
      <div>
        <label className={`text-[10px] uppercase tracking-wider block mb-1.5 ${phase === '1phase3w' ? 'text-[var(--color-text-dim)] opacity-40' : 'text-[var(--color-text-dim)]'}`}>力率 (cosφ)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max="1.00"
          value={pf}
          onChange={(e) => setPf(e.target.value)}
          disabled={phase === '1phase3w'}
          className={`input-hmi text-sm w-20 font-[JetBrains_Mono,monospace] ${phase === '1phase3w' ? 'opacity-40 cursor-not-allowed' : ''}`}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="btn-primary text-sm"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        {saved && <span className="text-xs text-[var(--color-success)]">保存しました</span>}
        {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
      </div>
      <div className="w-full text-xs text-[var(--color-text-dim)] mt-1 font-[JetBrains_Mono,monospace]">
        {phase === '3phase'
          ? `P = √3 × ${voltage}V × avg(L1,L2,L3) × ${pf}`
          : `P = ${voltage}V × (L1+L2)`
        }
      </div>
    </div>
  )
}
