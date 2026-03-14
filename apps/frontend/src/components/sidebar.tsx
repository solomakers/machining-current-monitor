'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: '📊' },
  { href: '/devices', label: '設備一覧', icon: '🏭' },
  { href: '/gateways', label: 'ゲートウェイ', icon: '📡' },
  { href: '/unknown-devices', label: '未登録デバイス', icon: '❓' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 bg-white border-r border-[var(--color-border)] min-h-screen flex flex-col">
      <div className="p-4 border-b border-[var(--color-border)]">
        <h1 className="text-lg font-bold text-gray-800">電流監視</h1>
        <p className="text-xs text-gray-500 mt-1">EnOcean CWD-3-1</p>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
