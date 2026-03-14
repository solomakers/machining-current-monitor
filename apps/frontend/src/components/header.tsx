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
    <header className="h-14 bg-white border-b border-[var(--color-border)] flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        {userEmail && <span className="text-sm text-gray-500">{userEmail}</span>}
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}
