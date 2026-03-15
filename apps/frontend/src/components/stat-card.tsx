interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: 'default' | 'success' | 'warning' | 'danger'
}

const colorMap = {
  default: 'text-[var(--color-text)]',
  success: 'text-[var(--color-success)] glow-green',
  warning: 'text-[var(--color-warning)] glow-amber',
  danger: 'text-[var(--color-danger)] glow-red',
}

export function StatCard({ label, value, sub, color = 'default' }: StatCardProps) {
  return (
    <div className="card-hmi p-5">
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2 font-medium">
        {label}
      </p>
      <p className={`text-2xl font-bold font-[JetBrains_Mono,monospace] ${colorMap[color]}`}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-[var(--color-text-dim)] mt-1 font-mono">{sub}</p>
      )}
    </div>
  )
}
