import { format, formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

const JST = 'Asia/Tokyo'

export function toJST(iso: string): Date {
  return toZonedTime(new Date(iso), JST)
}

export function formatJST(iso: string, fmt: string = 'yyyy/MM/dd HH:mm:ss'): string {
  return format(toJST(iso), fmt)
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ja })
}

export function formatCurrent(value: number | null | undefined): string {
  if (value == null) return '---'
  return `${value.toFixed(1)} A`
}
