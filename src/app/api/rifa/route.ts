import { createServiceClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { rifaId, ...fields } = body

  const { data: rifa } = await supabase
    .from('rifas')
    .select('admin_emails, start_number, total_numbers')
    .eq('id', rifaId)
    .single()

  const isAdmin = (rifa?.admin_emails ?? [])
    .map((e: string) => e.toLowerCase())
    .includes(user.email?.toLowerCase() ?? '')
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Não permite reduzir total_numbers abaixo do maior número já reservado/pago
  if (fields.total_numbers !== undefined && rifa) {
    const { data: maxReserva } = await supabase
      .from('reservas')
      .select('numero')
      .eq('rifa_id', rifaId)
      .in('status', ['reservado', 'pago'])
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxReserva) {
      const minTotal = maxReserva.numero - rifa.start_number + 1
      if (fields.total_numbers < minTotal) {
        return NextResponse.json(
          { error: `Não é possível reduzir: número ${maxReserva.numero} já está reservado.` },
          { status: 400 }
        )
      }
    }
  }

  const service = createServiceClient()
  const { error } = await service.from('rifas').update(fields).eq('id', rifaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
