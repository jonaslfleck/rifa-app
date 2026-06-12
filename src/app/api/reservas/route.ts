import { createServiceClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reservaId, status, rifaId } = await request.json()
  if (!['pago', 'cancelado'].includes(status))
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })

  const { data: rifa } = await supabase.from('rifas').select('admin_emails').eq('id', rifaId).single()
  const isAdmin = (rifa?.admin_emails ?? []).map((e: string) => e.toLowerCase()).includes(user.email?.toLowerCase() ?? '')
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  if (status === 'cancelado') {
    const { error } = await service.from('reservas').delete().eq('id', reservaId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await service.from('reservas').update({ status }).eq('id', reservaId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
