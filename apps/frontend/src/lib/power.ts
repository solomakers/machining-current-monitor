/**
 * 三相/単相の電力計算
 *
 * 三相: P(kW) = √3 × V × I × cosφ / 1000
 * 単相: P(kW) = V × I × cosφ / 1000
 */

export interface PowerSettings {
  phaseType: '3phase' | '1phase'
  voltageV: number
  powerFactor: number
}

const SQRT3 = Math.sqrt(3)

/** 単一相の電力 (kW) */
export function calcPowerKw(
  currentA: number | null,
  settings: PowerSettings,
): number | null {
  if (currentA == null) return null
  const multiplier = settings.phaseType === '3phase' ? SQRT3 : 1
  return (multiplier * settings.voltageV * currentA * settings.powerFactor) / 1000
}

/** 三相合計電力 (kW) - 各相の電流平均値から算出 */
export function calcTotalPowerKw(
  l1: number | null,
  l2: number | null,
  l3: number | null,
  settings: PowerSettings,
): number | null {
  if (settings.phaseType === '3phase') {
    // 三相: √3 × V × I_avg × cosφ (I_avg = 3相の平均電流)
    const vals = [l1, l2, l3].filter((v): v is number => v != null)
    if (vals.length === 0) return null
    const avgCurrent = vals.reduce((a, b) => a + b, 0) / vals.length
    return (SQRT3 * settings.voltageV * avgCurrent * settings.powerFactor) / 1000
  } else {
    // 単相3線式: V × (I_L1 + I_L2)
    const vals = [l1, l2].filter((v): v is number => v != null)
    if (vals.length === 0) return null
    const totalCurrent = vals.reduce((a, b) => a + b, 0)
    return (settings.voltageV * totalCurrent) / 1000
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
