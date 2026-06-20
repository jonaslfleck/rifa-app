import { createServiceClient } from '@/lib/supabase/server'
import { getTransport, smtpConfigurado } from '@/lib/mailer'
import { NextResponse } from 'next/server'

// Notifica os admins por email quando alguém faz uma reserva.
// Chamada (fire-and-forget) pelo cliente após a reserva ser inserida.
export async function POST(request: Request) {
  // Se o SMTP não estiver configurado, não quebra a reserva — apenas ignora.
  if (!smtpConfigurado()) return NextResponse.json({ skipped: 'smtp' })

  const { rifaId, nome, telefone, numeros } = await request.json().catch(() => ({}))
  if (!rifaId || !Array.isArray(numeros) || numeros.length === 0)
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const service = createServiceClient()

  const { data: rifa } = await service
    .from('rifas')
    .select('title, admin_emails')
    .eq('id', rifaId)
    .single()
  if (!rifa) return NextResponse.json({ error: 'Rifa não encontrada' }, { status: 404 })

  const admins: string[] = rifa.admin_emails ?? []
  if (admins.length === 0) return NextResponse.json({ skipped: 'sem-admin' })

  // Anti-spam: confirma que as reservas realmente existem para este telefone.
  const tel = String(telefone ?? '').replace(/\D/g, '')
  const { data: existentes } = await service
    .from('reservas')
    .select('numero')
    .eq('rifa_id', rifaId)
    .eq('telefone', tel)
    .in('numero', numeros)
  if (!existentes || existentes.length === 0)
    return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })

  const nums = existentes.map(e => e.numero).sort((a, b) => a - b).join(', ')
  const nomeLimpo = String(nome ?? '').trim() || '(sem nome)'

  try {
    await getTransport().sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: admins.join(', '),
      subject: `🎟 Nova reserva — ${rifa.title}`,
      text:
        `Nova reserva na rifa "${rifa.title}".\n\n` +
        `Nome: ${nomeLimpo}\nTelefone: ${tel}\nNúmero(s): ${nums}\n\n` +
        `Acesse o painel admin para confirmar o pagamento.`,
      html:
        `<h2>🎟 Nova reserva</h2>` +
        `<p><strong>Rifa:</strong> ${rifa.title}</p>` +
        `<p><strong>Nome:</strong> ${nomeLimpo}</p>` +
        `<p><strong>Telefone:</strong> ${tel}</p>` +
        `<p><strong>Número(s):</strong> ${nums}</p>` +
        `<p>Acesse o painel admin para confirmar o pagamento.</p>`,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Falha ao enviar email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
