'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function Header({ userEmail }: { userEmail?: string }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        {userEmail && (
          <span className="text-xs text-[var(--color-text-dim)] font-mono">{userEmail}</span>
        )}
        <button
          onClick={handleLogout}
          className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}
