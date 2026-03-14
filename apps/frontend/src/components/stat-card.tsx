interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: 'default' | 'success' | 'warning' | 'danger'
}

const colorMap = {
  default: 'text-gray-900',
  success: 'text-green-600',
  warning: 'text-amber-500',
  danger: 'text-red-600',
}

export function StatCard({ label, value, sub, color = 'default' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
