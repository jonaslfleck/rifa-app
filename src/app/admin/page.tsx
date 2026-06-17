import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from '@/components/AdminClient'

export const revalidate = 0

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  // Logado = role authenticated → enxerga admin_emails e as reservas (RLS admin).
  const { data: rifa } = await supabase
    .from('rifas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const adminEmails: string[] = rifa?.admin_emails ?? []
  const isAdmin = adminEmails.map((e: string) => e.toLowerCase()).includes(user.email?.toLowerCase() ?? '')
  if (!isAdmin) redirect('/admin/unauthorized')

  const { data: reservas } = await supabase
    .from('reservas')
    .select('*')
    .eq('rifa_id', rifa?.id ?? '')
    .order('created_at', { ascending: false })

  return <AdminClient rifa={rifa} reservas={reservas ?? []} user={user} />
}
