import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header userEmail={user?.email} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
