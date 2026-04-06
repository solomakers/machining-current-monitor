/** 全3相がこの値未満なら設備停止（idle）と判定 */
export const IDLE_CURRENT_THRESHOLD_A = 0.5

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
