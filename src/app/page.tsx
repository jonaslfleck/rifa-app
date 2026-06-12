import { createClient } from '@/lib/supabase/server'
import RifaClient from '@/components/RifaClient'

export const revalidate = 0

export default async function RifaPage() {
  const supabase = createClient()

  const { data: rifa } = await supabase
    .from('rifas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const { data: reservas } = await supabase
    .from('reservas')
    .select('numero, status')
    .eq('rifa_id', rifa?.id ?? '')
    .in('status', ['reservado', 'pago'])

  return <RifaClient rifa={rifa} reservas={reservas ?? []} />
}
