import { createClient } from '@/lib/supabase/server'
import RifaClient from '@/components/RifaClient'

export const revalidate = 0

export default async function RifaPage() {
  const supabase = createClient()

  // Não seleciona admin_emails: a chave anon é pública.
  const { data: rifa } = await supabase
    .from('rifas')
    .select('id, title, description, total_numbers, start_number, number_ranges, price, draw_date, pix_type, pix_key, pix_name, pix_city, prizes, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Números ocupados via RPC (expõe só numero/status, sem nome/telefone).
  let reservas: { numero: number; status: 'reservado' | 'pago' }[] = []
  if (rifa) {
    const { data } = await supabase.rpc('numeros_ocupados', { p_rifa_id: rifa.id })
    reservas = (data ?? []) as { numero: number; status: 'reservado' | 'pago' }[]
  }

  return <RifaClient rifa={rifa} reservas={reservas} />
}
