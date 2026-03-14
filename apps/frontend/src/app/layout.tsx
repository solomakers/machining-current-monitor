import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '電流監視システム',
  description: 'EnOcean CWD-3-1 電流監視ダッシュボード',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-[var(--color-bg)]">{children}</body>
    </html>
  )
}
