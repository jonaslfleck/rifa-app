import { createServiceClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type NumberRange = { start: number; end: number }

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function normalizeRanges(input: unknown): NumberRange[] {
  if (!Array.isArray(input)) return []

  const parsed = input
    .map((r): NumberRange | null => {
      const start = Number((r as { start?: unknown })?.start)
      const end = Number((r as { end?: unknown })?.end)
      if (!isPositiveInt(start) || !isPositiveInt(end) || end < start) return null
      return { start, end }
    })
    .filter((r): r is NumberRange => r !== null)
    .sort((a, b) => a.start - b.start)

  const merged: NumberRange[] = []
  for (const range of parsed) {
    const last = merged.at(-1)
    if (!last || range.start > last.end + 1) {
      merged.push({ ...range })
      continue
    }
    last.end = Math.max(last.end, range.end)
  }
  return merged
}

function containsNumber(ranges: NumberRange[], n: number) {
  return ranges.some(r => n >= r.start && n <= r.end)
}

function toOptionalTrimmedText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  return ''
}

export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { rifaId, append_range, ...rawFields } = body
  const fields = { ...rawFields } as Record<string, unknown>

  const { data: rifa } = await supabase
    .from('rifas')
    .select('admin_emails, start_number, total_numbers, number_ranges')
    .eq('id', rifaId)
    .single()

  const isAdmin = (rifa?.admin_emails ?? [])
    .map((e: string) => e.toLowerCase())
    .includes(user.email?.toLowerCase() ?? '')
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (rifa) {
    const legacyRanges: NumberRange[] = [{
      start: rifa.start_number,
      end: rifa.start_number + rifa.total_numbers - 1,
    }]
    const existingRanges = normalizeRanges(rifa.number_ranges)
    const baseRanges = existingRanges.length > 0 ? existingRanges : legacyRanges

    let nextRanges = baseRanges

    const startFromFields = Number(fields.start_number)
    const totalFromFields = Number(fields.total_numbers)
    if (isPositiveInt(startFromFields) && isPositiveInt(totalFromFields)) {
      nextRanges = [{
        start: startFromFields,
        end: startFromFields + totalFromFields - 1,
      }]
    }

    if (fields.number_ranges !== undefined) {
      nextRanges = normalizeRanges(fields.number_ranges)
      if (nextRanges.length === 0) {
        return NextResponse.json({ error: 'Faixas inválidas.' }, { status: 400 })
      }
    }

    if (append_range !== undefined) {
      const append = normalizeRanges([append_range])
      if (append.length === 0) {
        return NextResponse.json({ error: 'Nova faixa inválida.' }, { status: 400 })
      }
      nextRanges = normalizeRanges([...nextRanges, ...append])
    }

    const minStart = nextRanges[0]?.start
    const maxEnd = nextRanges.at(-1)?.end
    if (!isPositiveInt(minStart) || !isPositiveInt(maxEnd) || maxEnd < minStart) {
      return NextResponse.json({ error: 'Faixa final inválida.' }, { status: 400 })
    }

    const { data: ocupadas } = await supabase
      .from('reservas')
      .select('numero')
      .eq('rifa_id', rifaId)
      .in('status', ['reservado', 'pago'])
      .order('numero', { ascending: true })

    const foraDaFaixa = (ocupadas ?? []).find(r => !containsNumber(nextRanges, r.numero))
    if (foraDaFaixa) {
      return NextResponse.json(
        { error: `Não é possível remover a faixa: número ${foraDaFaixa.numero} já está reservado.` },
        { status: 400 }
      )
    }

    fields.number_ranges = nextRanges
    fields.start_number = minStart
    fields.total_numbers = maxEnd - minStart + 1
  }

  if (fields.total_numbers !== undefined) {
    const value = Number(fields.total_numbers)
    if (!isPositiveInt(value)) {
      return NextResponse.json({ error: 'total_numbers inválido.' }, { status: 400 })
    }
  }

  if (fields.start_number !== undefined) {
    const value = Number(fields.start_number)
    if (!isPositiveInt(value)) {
      return NextResponse.json({ error: 'start_number inválido.' }, { status: 400 })
    }
  }

  if (fields.price !== undefined) {
    const value = Number(fields.price)
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: 'price inválido.' }, { status: 400 })
    }
  }

  if (fields.admin_emails !== undefined && !Array.isArray(fields.admin_emails)) {
    return NextResponse.json({ error: 'admin_emails inválido.' }, { status: 400 })
  }

  if (fields.admin_emails !== undefined) {
    fields.admin_emails = (fields.admin_emails as unknown[])
      .map(e => String(e).trim())
      .filter(Boolean)
  }

  if (fields.title !== undefined) {
    const title = toOptionalTrimmedText(fields.title)
    if (!title) return NextResponse.json({ error: 'title inválido.' }, { status: 400 })
    fields.title = title
  }

  if (fields.description !== undefined) {
    fields.description = toOptionalTrimmedText(fields.description)
  }

  if (fields.pix_key !== undefined) {
    fields.pix_key = toOptionalTrimmedText(fields.pix_key)
  }

  if (fields.pix_name !== undefined) {
    fields.pix_name = toOptionalTrimmedText(fields.pix_name)
  }

  if (fields.pix_city !== undefined) {
    const city = toOptionalTrimmedText(fields.pix_city)
    fields.pix_city = city || 'SAO PAULO'
  }

  if (fields.draw_date === '') {
    fields.draw_date = null
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  const updatePayload = fields as {
    [key: string]: unknown
  }

  const service = createServiceClient()
  const { error } = await service.from('rifas').update(updatePayload).eq('id', rifaId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
