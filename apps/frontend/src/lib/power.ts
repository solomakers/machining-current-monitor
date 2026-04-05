/**
 * 電力計算
 *
 * 単相3線式: P(kW) = V × (L1 + L2) × cosφ / 1000
 * 三相3線式: P(kW) = √3 × V × avg(L1, L2, L3) × cosφ / 1000
 */

export interface PowerSettings {
  phaseType: '3phase' | '1phase3w'
  voltageV: number
  powerFactor: number
}

const SQRT3 = Math.sqrt(3)

/** 合計電力 (kW) */
export function calcTotalPowerKw(
  l1: number | null,
  l2: number | null,
  l3: number | null,
  settings: PowerSettings,
): number | null {
  if (settings.phaseType === '3phase') {
    // 三相3線式: √3 × V × avg(L1, L2, L3) × cosφ
    const vals = [l1, l2, l3].filter((v): v is number => v != null)
    if (vals.length === 0) return null
    const avgCurrent = vals.reduce((a, b) => a + b, 0) / vals.length
    return (SQRT3 * settings.voltageV * avgCurrent * settings.powerFactor) / 1000
  } else {
    // 単相3線式: V × (L1 + L2) × cosφ
    const vals = [l1, l2].filter((v): v is number => v != null)
    if (vals.length === 0) return null
    const totalCurrent = vals.reduce((a, b) => a + b, 0)
    return (settings.voltageV * totalCurrent * settings.powerFactor) / 1000
  }
}

export function formatPower(kw: number | null): string {
  if (kw == null) return '---'
  return `${kw.toFixed(2)} kW`
}

export const DEFAULT_POWER_SETTINGS: PowerSettings = {
  phaseType: '3phase',
  voltageV: 200,
  powerFactor: 0.80,
}
