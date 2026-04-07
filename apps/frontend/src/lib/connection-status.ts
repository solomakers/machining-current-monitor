/** 全3相がこの値未満なら設備停止（idle）と判定 */
export const IDLE_CURRENT_THRESHOLD_A = 0.5

/** CWD-3-1 センサの検出下限。この値未満の電流はセンサが検出できずデータ送信されない */
export const SENSOR_MIN_DETECTION_A = 2.0

/** データ鮮度の判定ウィンドウ（10分） */
export const STALE_THRESHOLD_MS = 10 * 60 * 1000

export type ConnectionStatus =
  | 'online'
  | 'idle'
  | 'sensor-down'
  | 'wifi-down'
  | 'no-data'

/** 3相の電流値がすべてしきい値未満かどうか */
export function isCurrentIdle(
  l1: number | null,
  l2: number | null,
  l3: number | null,
): boolean {
  return [l1, l2, l3].every(
    (v) => v == null || Math.abs(Number(v)) < IDLE_CURRENT_THRESHOLD_A,
  )
}

/** 最後の電流値がセンサ検出下限付近かどうか（停止によりデータが途切れた可能性） */
export function isBelowSensorThreshold(
  l1: number | null,
  l2: number | null,
  l3: number | null,
): boolean {
  return [l1, l2, l3].every(
    (v) => v == null || Math.abs(Number(v)) < SENSOR_MIN_DETECTION_A,
  )
}

export const STATUS_CONFIG = {
  online: {
    label: '稼働中',
    dotColor: 'bg-[var(--color-success)] pulse-live',
    badge: 'badge-success',
    title: '稼働中',
  },
  idle: {
    label: '停止中',
    dotColor: 'bg-[var(--color-primary)]',
    badge: 'badge-info',
    title: '停止中（通信正常）',
  },
  'sensor-down': {
    label: 'センサ断',
    dotColor: 'bg-[var(--color-warning)]',
    badge: 'badge-warning',
    title: 'センサ断',
  },
  'wifi-down': {
    label: 'WiFi断',
    dotColor: 'bg-[var(--color-danger)] pulse-danger',
    badge: 'badge-danger',
    title: 'WiFi断',
  },
  'no-data': {
    label: 'データ未受信',
    dotColor: 'bg-[var(--color-text-dim)]',
    badge: 'badge-neutral',
    title: 'データ未受信',
  },
} as const
